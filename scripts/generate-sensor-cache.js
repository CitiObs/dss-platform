#!/usr/bin/env node
/**
 * Generate static JSON cache files for sensor data.
 * 
 * This script fetches all sensors from the virtualair API and saves them
 * as static JSON files in public/sensor-cache/. The frontend will load
 * these for instant first paint, then refresh from live API in background.
 * 
 * Usage:
 *   node scripts/generate-sensor-cache.js                             # All metrics (full scan)
 *   node scripts/generate-sensor-cache.js airTemperature              # Single metric (full scan)
 *   node scripts/generate-sensor-cache.js airTemperature --quick      # Incremental update (active sensors only)
 *   node scripts/generate-sensor-cache.js airTemperature --sample=100 # 100 random sensors
 *   node scripts/generate-sensor-cache.js airTemperature --debug      # Verbose logging
 *   node scripts/generate-sensor-cache.js --update airTemperature     # Update ALL sensors in existing cache
 *   node scripts/generate-sensor-cache.js --check=KTUY_8046           # Check single sensor's cache data
 * 
 * Quick Mode (--quick):
 *   - Only re-checks sensors that were active or had data in the previous cache
 *   - Preserves inactive sensors with no data from existing cache
 *   - Reduces update time from ~5-6 min per metric to ~1-2 min
 *   - Ideal for hourly updates; use full scan every 6 hours for new sensor discovery
 * 
 * Available metrics: airTemperature, relativeHumidity, atmosphericPressure, pm25, pm10, no2
 * 
 * Output:
 *   public/sensor-cache/airTemperature.json
 *   public/sensor-cache/relativeHumidity.json
 *   public/sensor-cache/atmosphericPressure.json
 *   public/sensor-cache/pm25.json
 *   public/sensor-cache/pm10.json
 *   public/sensor-cache/no2.json
 */

import { chmod, chown, mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import { constants as osConstants } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'sensor-cache');

const BASE_URL = 'https://api-virtualair.nilu.no/v1.1';

// Refuse a datastream list smaller than this share of the existing cache, after this many tries
const LIST_MIN_RATIO = 0.9;
const LIST_MAX_ATTEMPTS = 3;

// Same metric definitions as sensorDefinitions.js
// NOTE: NO2 uses lowercase 'envthes' - the API is case-sensitive!
const METRICS = {
    airTemperature: 'http://vocabs.lter-europe.net/EnvThes/22035',
    relativeHumidity: 'http://vocabs.lter-europe.net/EnvThes/21579',
    atmosphericPressure: 'https://qudt.org/vocab/quantitykind/Pressure',
    pm25: 'https://www.eea.europa.eu/help/glossary/eea-glossary/pm2.5',
    pm10: 'https://www.eea.europa.eu/help/glossary/eea-glossary/pm10',
    no2: 'https://vocabs.lter-europe.net/envthes/en/page/20842',  // lowercase 'envthes' - API is case-sensitive
};

/**
 * fetch() with a hard deadline that also covers reading the body.
 *
 * AbortSignal.timeout() runs on an unref'd timer. When a request stalls in a state that keeps
 * nothing else alive, Node finds an empty event loop and exits with code 0 in the middle of a
 * run, before that timeout fires (seen in production on 2026-11-10). The timer here is ref'd,
 * so the process stays alive until the deadline, and the race rejects even when the abort
 * does not settle the request.
 *
 * Returns the status fields plus json(), which parses the body that was already read.
 */
async function fetchWithDeadline(url, timeoutMs, options = {}) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    const request = (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const body = await response.text();

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            json: () => JSON.parse(body),
        };
    })();
    // After the deadline wins the race, the aborted request rejects with nobody listening
    request.catch(() => {});

    try {
        return await Promise.race([request, deadline]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Write a cache file through a temporary file and a rename.
 * A run that dies, or a full disk, in the middle of the write then leaves the previous file
 * in place, and nginx never serves a half-written one.
 */
async function writeFileAtomic(path, content) {
    const tempPath = `${path}.tmp`;

    try {
        await writeFile(tempPath, content, 'utf-8');

        // The rename replaces the file, so carry over the owner and mode of the one it
        // replaces. Cron writes as root inside a container, the files belong to the host user.
        try {
            const { uid, gid, mode } = await stat(path);
            await chown(tempPath, uid, gid);
            await chmod(tempPath, mode);
        } catch {
            // No previous file, or not allowed to change the owner: keep the defaults
        }

        await rename(tempPath, path);
    } catch (error) {
        await rm(tempPath, { force: true }).catch(() => {});
        throw error;
    }
}

/**
 * Fetch ObservedProperties with chunked Datastreams pagination.
 * The API limits Datastreams per request, so we need to fetch in chunks
 * using $top/$skip on the Datastreams expand (same as frontend code).
 * 
 * Does NOT include Observations - active status is determined separately via:
 * - fetchActiveThingIds() for FIJI sources (via /Observations endpoint)
 * - fetchActiveNonFijiThingIds() for KTUY/SWNP/RIVM sources (individual datastream queries)
 */
async function fetchObservedProperties(metricLink) {
    // Same chunk config as frontend for consistency
    const CHUNK_CONFIG = [
        { top: 200, skip: 0 },
        { top: 2000, skip: 200 },
        { top: 2000, skip: 2200 },
        { top: 2000, skip: 4200 },
        { top: 2000, skip: 6200 },
    ];
    
    // Fetch all chunks in parallel
    const chunkPromises = CHUNK_CONFIG.map(async ({ top, skip }) => {
        // NO Observations expand - active status determined separately
        // This avoids timeouts on large metrics
        const expandParams = `Datastreams($top=${top};$skip=${skip}),Datastreams/Thing/Locations`;
        const params = new URLSearchParams({
            $filter: `definition eq '${metricLink}'`,
            $expand: expandParams,
            $top: '1000',
        });
        
        let allProps = [];
        let nextUrl = `${BASE_URL}/ObservedProperties?${params}`;
        
        while (nextUrl) {
            console.log(`  [skip=${skip}] Fetching: ${nextUrl.substring(0, 80)}...`);
            
            // 3 minute timeout per request
            const response = await fetchWithDeadline(nextUrl, 180000, {
                headers: {
                    'Accept': 'application/json',
                },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.value) {
                allProps = allProps.concat(data.value);
            }
            
            nextUrl = data['@iot.nextLink'] || null;
        }
        
        return allProps;
    });
    
    console.log(`  Fetching ${CHUNK_CONFIG.length} chunks in parallel...`);
    const allChunks = await Promise.all(chunkPromises);
    
    // Merge all chunks - combine Datastreams for same ObservedProperty
    const merged = new Map();
    
    for (const chunk of allChunks) {
        for (const op of chunk) {
            const id = op['@iot.id'];
            if (merged.has(id)) {
                // Add new datastreams to existing
                const existing = merged.get(id);
                existing.Datastreams.push(...(op.Datastreams || []));
            } else {
                merged.set(id, { ...op, Datastreams: [...(op.Datastreams || [])] });
            }
        }
    }
    
    const result = Array.from(merged.values());
    
    // Count total datastreams
    let totalDs = 0;
    for (const op of result) {
        totalDs += (op.Datastreams || []).length;
    }
    console.log(`  Merged: ${result.length} ObservedProperties, ${totalDs} total Datastreams`);
    
    return result;
}

/**
 * Fetch Thing IDs that have observations in the last N days.
 * This queries the Observations endpoint directly with a time filter,
 * which is much faster than nested $expand with $orderby.
 * 
 * Returns a Map of thingId -> { isActive, lastObservationResult, phenomenonTime }
 * 
 * Note: The virtualair API has a bug where @iot.nextLink skips too many records,
 * so we manually paginate using $skip instead.
 */

async function fetchActiveThingData(metricLink, daysBack = 5) {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`  Fetching active sensors with values (observations since ${cutoffISO.split('T')[0]})...`);

    // Map: thingId -> { result, phenomenonTime }
    const thingObservations = new Map();
    let totalObservations = 0;
    let skip = 0;
    const pageSize = 1000;
    const maxPages = 50;

    for (let page = 0; page < maxPages; page++) {
        try {
            const params = new URLSearchParams({
                // Filter: recent time, correct metric, AND valid result (not null and not -99)
                $filter: `phenomenonTime gt ${cutoffISO} and Datastream/ObservedProperty/definition eq '${metricLink}' and result ne null`,
                $expand: 'Datastream($select=@iot.id;$expand=Thing($select=@iot.id))',
                $select: 'phenomenonTime,result',
                $top: String(pageSize),
                $skip: String(skip),
            });

            const url = `${BASE_URL}/Observations?${params}`;
            const response = await fetchWithDeadline(url, 60000, {
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                console.log(`  Warning: Observations query returned ${response.status}, stopping`);
                break;
            }

            const data = await response.json();
            const items = data.value || [];

            if (items.length === 0) {
                break;
            }

            for (const obs of items) {
                const thingId = obs.Datastream?.Thing?.['@iot.id'];
                // Skip -99 sentinel values (means "no data")
                if (thingId && obs.result !== -99) {
                    const existing = thingObservations.get(thingId);
                    const obsTime = new Date(obs.phenomenonTime);

                    // Keep the most recent observation for each thing
                    if (!existing || obsTime > new Date(existing.phenomenonTime)) {
                        thingObservations.set(thingId, {
                            result: obs.result,
                            phenomenonTime: obs.phenomenonTime,
                            isActive: true,  // Already filtered by time, so active
                        });
                    }
                }
            }

            totalObservations += items.length;
            skip += items.length;

        } catch (error) {
            console.log(`  Warning: Error on page ${page + 1}: ${error.message}`);
            break;
        }
    }

    console.log(`  Found ${thingObservations.size} active sensors with values from ${totalObservations} observations (FIJI sources)`);
    return thingObservations;
}

/**
 * Check ALL non-FIJI datastreams (KTUY, SWNP, RIVM, KNJV, FIJI) for observations.
 * 
 * The federated API doesn't support for these sources:
 * - $expand=Observations (returns null)
 * - $filter=phenomenonTime on Observations (returns 0)
 * 
 * We must check each datastream individually for accuracy.
 * Returns a Map of thingId -> { result, phenomenonTime, isActive }
 * - isActive: true if observation is within daysBack
 * - result/phenomenonTime: latest observation (even if old) for gray display
 */
async function fetchActiveNonFijiThingData(datastreams, daysBack = 5, debugMode = false, failed = []) {
    if (datastreams.length === 0) {
        return new Map();
    }
    
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const BATCH_SIZE = 50;  // Reduced to 50 for better reliability with retries
    
    console.log(`  Checking ALL ${datastreams.length} non-FIJI datastreams for recent data...`);
    
    // Map: thingId -> { result, phenomenonTime, isActive }
    const thingObservations = new Map();
    let checked = 0;
    let active = 0;
    
    for (let i = 0; i < datastreams.length; i += BATCH_SIZE) {
        const batch = datastreams.slice(i, i + BATCH_SIZE);
        
        const results = await Promise.all(batch.map(async ({ dsId, thingId }) => {
            // Retry up to 3 times for failed requests
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    // Fetch 200 most recent observations (desc order) to find the latest valid one
                    // Some sensors have many null readings before valid data
                    const url = `${BASE_URL}/Datastreams('${dsId}')/Observations?$top=200&$orderby=phenomenonTime%20desc&$select=phenomenonTime,result`;
                    if (debugMode) console.log(`\n[DEBUG ${dsId}] Attempt ${attempt}: ${url}`);
                    // 20s timeout for reliability
                    const res = await fetchWithDeadline(url, 20000, {
                        headers: { 'Accept': 'application/json' },
                    });
                    if (debugMode) console.log(`[DEBUG ${dsId}] Response status: ${res.status}`);
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }
                    const data = await res.json();
                    if (debugMode) console.log(`[DEBUG ${dsId}] Raw observations count: ${(data.value || []).length}`);
                    let observations = data.value || [];
                
                    // Filter out invalid values
                    observations = observations.filter(obs => 
                        obs.result !== null && obs.result !== undefined && obs.result !== -99
                    );
                    if (debugMode) console.log(`[DEBUG ${dsId}] Valid observations after filter: ${observations.length}`);
                
                    if (observations.length === 0) {
                        // RIVM fallback: virtualair proxy sometimes returns empty for KTUY
                        // datastreams that have data at the RIVM source. Try direct RIVM query.
                        if (dsId.startsWith('KTUY_')) {
                            const numericId = dsId.replace('KTUY_', '');
                            const rivmUrl = `https://api-samenmeten.rivm.nl/v1.0/Datastreams(${numericId})/Observations?$top=5&$orderby=phenomenonTime%20desc&$select=phenomenonTime,result`;
                            if (debugMode) console.log(`[DEBUG ${dsId}] Virtualair empty, trying RIVM fallback: ${rivmUrl}`);
                            try {
                                const rivmRes = await fetchWithDeadline(rivmUrl, 15000, {
                                    headers: { 'Accept': 'application/json' },
                                });
                                if (rivmRes.ok) {
                                    const rivmData = await rivmRes.json();
                                    observations = (rivmData.value || []).filter(obs =>
                                        obs.result !== null && obs.result !== undefined && obs.result !== -99
                                    );
                                    if (debugMode) console.log(`[DEBUG ${dsId}] RIVM fallback returned ${observations.length} valid observations`);
                                } else if (rivmRes.status >= 500) {
                                    throw new Error(`RIVM HTTP ${rivmRes.status}: ${rivmRes.statusText}`);
                                }
                            } catch (rivmErr) {
                                if (debugMode) console.log(`[DEBUG ${dsId}] RIVM fallback error: ${rivmErr.message}`);
                                // Network errors, timeouts and 5xx are not "no data": let the retry
                                // loop handle them so a persistent failure ends up in `failed`
                                throw rivmErr;
                            }
                        }
                    }

                    if (observations.length === 0) {
                        if (debugMode) console.log(`[DEBUG ${dsId}] No valid observations, returning null`);
                        return { thingId, data: null };
                    }
                
                    // Find the most recent observation (already sorted desc, but verify)
                    const latestObs = observations.reduce((latest, obs) => {
                        if (!latest) return obs;
                        return new Date(obs.phenomenonTime) > new Date(latest.phenomenonTime) ? obs : latest;
                }, null);
                
                if (!latestObs) {
                    if (debugMode) console.log(`[DEBUG ${dsId}] latestObs is null, returning null`);
                    return { thingId, data: null };
                }
                
                const obsDate = new Date(latestObs.phenomenonTime);
                const isActive = obsDate >= cutoffDate;
                
                if (debugMode) console.log(`[DEBUG ${dsId}] SUCCESS! result=${latestObs.result}, time=${latestObs.phenomenonTime}, isActive=${isActive}`);
                
                // Always return the latest observation (for gray display of old sensors)
                return { 
                    thingId, 
                    data: { 
                        result: latestObs.result, 
                        phenomenonTime: latestObs.phenomenonTime,
                        isActive,
                    } 
                };
            } catch (e) {
                if (debugMode) console.log(`[DEBUG ${dsId}] ERROR on attempt ${attempt}: ${e.message}`);
                // Retry on failure (except on last attempt)
                if (attempt < 3) {
                    // Wait before retry (exponential backoff)
                    await new Promise(r => setTimeout(r, attempt * 1000));
                    continue;
                }
                // Final attempt failed
                failed.push({ dsId, thingId });
                return { thingId, data: null };
            }
            }
            // Should not reach here
            return { thingId, data: null };
        }));
        
        for (const { thingId, data } of results) {
            if (data) {
                const existing = thingObservations.get(thingId);
                // Keep the most recent observation per thing
                if (!existing || new Date(data.phenomenonTime) > new Date(existing.phenomenonTime)) {
                    thingObservations.set(thingId, data);
                }
                active++;
            }
        }
        
        checked += batch.length;
        const pct = ((checked / datastreams.length) * 100).toFixed(1);
        process.stdout.write(`\r  Checked ${checked}/${datastreams.length} (${pct}%) - ${active} active so far...`);
    }
    
    console.log(`\n  Found ${thingObservations.size} active non-FIJI sensors with values`);
    return thingObservations;
}

/**
 * Minimize the data to only what's needed for map display.
 * This reduces file size significantly.
 * 
 * Uses thingObservations Map (thingId -> { result, phenomenonTime, isActive }) which combines:
 * 1. FIJI sensors from /Observations endpoint query (always active if present)
 * 2. KTUY/SWNP/RIVM/KNJV/FIJI sensors from individual datastream checks (isActive flag varies)
 * 
 * Color logic in frontend:
 * - Black: lastObservationResult is null (no data ever)
 * - Gray: lastObservationResult exists but isActive is false (old data)
 * - Colored: lastObservationResult exists and isActive is true (recent data)
 */
function minimizeData(observedProperties, thingObservations) {
    return observedProperties.map(op => ({
        '@iot.id': op['@iot.id'],
        Datastreams: (op.Datastreams || []).map(ds => {
            const thingId = ds.Thing?.['@iot.id'];
            const obsData = thingId ? thingObservations.get(thingId) : null;
            
            // Use isActive from obsData if available, otherwise false if no data
            const isActive = obsData?.isActive ?? false;
            const lastObservationResult = obsData?.result ?? null;

            return {
                '@iot.id': ds['@iot.id'],
                '@iot.selfLink': ds['@iot.selfLink'],
                isActive,
                lastObservationResult,  // For color scale on first load
                ...(obsData?.refreshFailed ? { refreshFailed: true } : {}),  // Value copied from the previous cache
                Thing: ds.Thing ? {
                    '@iot.id': ds.Thing['@iot.id'],
                    name: ds.Thing.name,
                    description: ds.Thing.description,
                    Locations: (ds.Thing.Locations || []).map(loc => ({
                        location: loc.location,
                    })),
                } : null,
            };
        }),
    }));
}

async function main() {
    console.log('=== Generating Sensor Cache Files ===\n');
    
    // Support single metric and test mode via CLI arguments:
    // node generate-sensor-cache.js airTemperature                    # Single metric (full)
    // node generate-sensor-cache.js airTemperature --sample=100       # 100 random sensors
    // node generate-sensor-cache.js airTemperature --test             # Same as --sample=50
    // node generate-sensor-cache.js airTemperature --debug            # Verbose logging
    // node generate-sensor-cache.js --check=KTUY_8046                 # Check single sensor
    // node generate-sensor-cache.js --quick                           # Quick mode: only active sensors (~5-10 min)
    const args = process.argv.slice(2);
    const testMode = args.includes('--test');
    const debugMode = args.includes('--debug');
    const quickMode = args.includes('--quick');  // NEW: Quick incremental update
    const sampleArg = args.find(a => a.startsWith('--sample='));
    const sampleSize = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : (testMode ? 50 : 0);
    const checkArg = args.find(a => a.startsWith('--check='));
    const singleMetric = args.find(a => !a.startsWith('--'));
    
    // Quick sensor check mode - show cache data for a specific sensor
    if (checkArg) {
        const sensorId = checkArg.split('=')[1];
        console.log(`=== Checking sensor: ${sensorId} ===\n`);
        
        for (const [metric, _link] of Object.entries(METRICS)) {
            const cacheFile = join(OUTPUT_DIR, `${metric}.json`);
            try {
                const cacheData = JSON.parse(await readFile(cacheFile, 'utf8'));
                for (const op of cacheData.data || []) {
                    for (const ds of op.Datastreams || []) {
                        if (ds.Thing?.['@iot.id'] === sensorId || ds['@iot.id'] === sensorId) {
                            console.log(`[${metric}] Found in cache:`);
                            console.log(`  Datastream: ${ds['@iot.id']}`);
                            console.log(`  Thing ID: ${ds.Thing?.['@iot.id']}`);
                            console.log(`  isActive: ${ds.isActive}`);
                            console.log(`  lastObservationResult: ${ds.lastObservationResult}`);
                            console.log(`  Location: ${JSON.stringify(ds.Thing?.Locations?.[0]?.location?.coordinates)}`);
                            
                            // Also fetch LIVE data from API for comparison
                            console.log(`\n  Fetching LIVE data from API...`);
                            try {
                                const url = `${BASE_URL}/Datastreams('${ds['@iot.id']}')/Observations?$top=5&$orderby=phenomenonTime%20desc&$select=phenomenonTime,result`;
                                const res = await fetchWithDeadline(url, 20000);
                                const data = await res.json();
                                const obs = (data.value || []).filter(o => o.result !== null && o.result !== -99);
                                if (obs.length > 0) {
                                    console.log(`  LIVE latest: result=${obs[0].result}, time=${obs[0].phenomenonTime}`);
                                } else {
                                    console.log(`  LIVE: No valid observations`);
                                }
                            } catch (e) {
                                console.log(`  LIVE: Error fetching - ${e.message}`);
                            }
                            console.log();
                        }
                    }
                }
            } catch (e) {
                console.log(`[${metric}] Cache not found: ${cacheFile}`);
            }
        }
        return;
    }
    
    if (singleMetric && singleMetric === 'caqi') {
        // CAQI is computed from pollutant caches, not fetched from API
        await generateCaqiCache();
        return;
    }
    
    if (singleMetric && !METRICS[singleMetric]) {
        console.error(`Unknown metric: ${singleMetric}`);
        console.error(`Available: ${Object.keys(METRICS).join(', ')}, caqi`);
        process.exit(1);
    }
    
    if (sampleSize > 0) {
        console.log(`*** SAMPLE MODE: Processing only ${sampleSize} datastreams ***\n`);
    }
    if (debugMode) {
        console.log('*** DEBUG MODE: Verbose logging enabled ***\n');
    }
    if (quickMode) {
        console.log('*** QUICK MODE: Only updating active sensors (incremental) ***\n');
    }
    
    // Create output directory
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Output directory: ${OUTPUT_DIR}\n`);
    
    const results = {};
    const metricsToProcess = singleMetric 
        ? [[singleMetric, METRICS[singleMetric]]]
        : Object.entries(METRICS);
    
    for (const [metric, link] of metricsToProcess) {
        console.log(`\n[${metric}] Fetching from ${link}`);
        
        try {
            const startTime = Date.now();
            
            // Load the existing cache. Quick mode only updates active sensors and merges
            // with it; both modes use it as a fallback for requests that fail.
            let existingCache = null;
            let existingDataMap = new Map();  // dsId -> datastream data
            const cacheFile = join(OUTPUT_DIR, `${metric}.json`);

            try {
                existingCache = JSON.parse(await readFile(cacheFile, 'utf8'));
                console.log(`  Loaded existing cache: ${existingCache.sensorCount} sensors, ${existingCache.activeSensorCount} active`);

                // Build a map of existing datastream data for fast lookup
                for (const op of existingCache.data || []) {
                    for (const ds of op.Datastreams || []) {
                        existingDataMap.set(ds['@iot.id'], ds);
                    }
                }
            } catch (e) {
                if (quickMode) {
                    console.log(`  [QUICK] No existing cache found, falling back to full scan`);
                }
            }
            
            // Step 1: Fetch all sensors (with observations for non-KTUY sources).
            // The API sometimes returns a partial list with HTTP 200 (seen: 331 and 3820 of
            // ~7800 datastreams). A full scan would write that list as is and drop most sensors
            // from the map, so retry and, if the list stays short, keep the existing cache.
            const countDatastreams = (ops) => ops.reduce((n, op) => n + (op.Datastreams || []).length, 0);
            const expectedDatastreams = countDatastreams(existingCache?.data || []);

            let data = [];
            for (let attempt = 1; attempt <= LIST_MAX_ATTEMPTS; attempt++) {
                data = await fetchObservedProperties(link);
                const received = countDatastreams(data);
                if (received >= expectedDatastreams * LIST_MIN_RATIO) break;

                console.log(`  WARNING: API returned ${received} datastreams, existing cache has ${expectedDatastreams} (attempt ${attempt}/${LIST_MAX_ATTEMPTS})`);
                if (attempt === LIST_MAX_ATTEMPTS) {
                    throw new Error(`Incomplete datastream list from the API (${received} of ${expectedDatastreams}), keeping the existing cache`);
                }
            }

            // Step 2: Fetch active sensor data with observation values from /Observations endpoint (works for FIJI)
            const thingObservations = await fetchActiveThingData(link, 5);
            
            // Step 3: Collect datastreams that need individual queries
            // Non-FIJI sources (KTUY, SWNP, RIVM, KNJV) don't support $expand=Observations
            // FIJI sensors missed by the 5-day /Observations query also go here
            // All are queried individually to get latest observation regardless of age
            let nonFijiDatastreams = [];
            const NON_FIJI_PREFIXES = ['KTUY_', 'SWNP_', 'RIVM_', 'KNJV_'];

            // QUICK MODE: Only re-check sensors that were previously active or recently had data
            const THIRTY_DAYS_AGO = 30 * 24 * 60 * 60 * 1000;
            let skippedInactive = 0;

            for (const op of data) {
                for (const ds of op.Datastreams || []) {
                    const dsId = ds['@iot.id']?.toString() || '';
                    const thingId = ds.Thing?.['@iot.id'];
                    if (!thingId) continue;

                    if (NON_FIJI_PREFIXES.some(prefix => dsId.startsWith(prefix))) {
                        // In QUICK MODE: Skip sensors that were inactive AND had old/no data
                        if (quickMode && existingDataMap.size > 0) {
                            const existingDs = existingDataMap.get(dsId);
                            if (existingDs) {
                                // Skip if: was inactive AND (no data OR data older than 30 days)
                                const wasActive = existingDs.isActive === true;
                                const hasRecentData = existingDs.lastObservationResult !== null;

                                if (!wasActive && !hasRecentData) {
                                    // No data at all - skip (check in full scan)
                                    skippedInactive++;
                                    continue;
                                }
                            }
                        }
                        nonFijiDatastreams.push({ dsId, thingId });
                    } else if (dsId.startsWith('FIJI_') && !thingObservations.has(thingId)) {
                        // FIJI sensor not found in 5-day window — query individually
                        // to get latest observation (will show as gray instead of black)
                        // Treated the same as non-FIJI: fetch latest observation regardless of age
                        nonFijiDatastreams.push({ dsId, thingId });
                    }
                }
            }
            
            if (quickMode && skippedInactive > 0) {
                console.log(`  [QUICK] Skipped ${skippedInactive} sensors with no data (will check in full scan)`);
                console.log(`  [QUICK] Checking ${nonFijiDatastreams.length} sensors (active + with data)`);
            }
            
            // SAMPLE MODE: Limit to N random datastreams for faster testing
            if (sampleSize > 0 && nonFijiDatastreams.length > sampleSize) {
                // Shuffle and take first N for random sampling
                nonFijiDatastreams = nonFijiDatastreams
                    .sort(() => Math.random() - 0.5)
                    .slice(0, sampleSize);
                console.log(`  [SAMPLE MODE] Processing ${nonFijiDatastreams.length} randomly selected datastreams`);
            }
            
            // Step 4: Batch check all remaining datastreams (non-FIJI + missed FIJI) for latest observations
            const failedDatastreams = [];
            const nonFijiThingData = await fetchActiveNonFijiThingData(nonFijiDatastreams, 5, debugMode, failedDatastreams);

            // Merge observation data from both sources (keep most recent per thing)
            for (const [thingId, obsData] of nonFijiThingData) {
                const existing = thingObservations.get(thingId);
                if (!existing || new Date(obsData.phenomenonTime) > new Date(existing.phenomenonTime)) {
                    thingObservations.set(thingId, obsData);
                }
            }

            // Datastreams whose request failed after all retries keep their previous cache
            // value instead of being written as no-data (which would also make the next quick
            // run skip them until the next full scan). They stay active only on the first
            // failed quick run; a second consecutive failure, or any failure in a full scan,
            // marks them inactive so an old reading is not shown as current for long.
            // Having a value, they are re-checked on the next quick run.
            let fallbackCount = 0;
            for (const { dsId, thingId } of failedDatastreams) {
                const previous = existingDataMap.get(dsId);
                if (thingObservations.has(thingId) || previous?.lastObservationResult == null) continue;

                thingObservations.set(thingId, {
                    result: previous.lastObservationResult,
                    isActive: quickMode && previous.isActive === true && !previous.refreshFailed,
                    refreshFailed: true,
                });
                fallbackCount++;
            }
            if (failedDatastreams.length > 0) {
                console.log(`  ${failedDatastreams.length} requests failed after retries, ${fallbackCount} kept their previous cache value`);
            }

            const fetchTime = Date.now() - startTime;
            
            // Minimize data and add isActive flag + lastObservationResult
            let minimized = minimizeData(data, thingObservations);
            
            // QUICK MODE: Merge with existing cache data for sensors that weren't re-checked
            if (quickMode && existingCache?.data) {
                console.log(`  Quick mode: Merging with existing cache data...`);
                
                // Build a map of updated sensor IDs from the new data
                const updatedThingIds = new Set();
                for (const op of minimized) {
                    for (const ds of op.Datastreams || []) {
                        if (ds.Thing?.['@iot.id']) {
                            updatedThingIds.add(ds.Thing['@iot.id']);
                        }
                    }
                }
                
                // Add sensors from existing cache that weren't updated
                for (const op of existingCache.data) {
                    for (const ds of op.Datastreams || []) {
                        const thingId = ds.Thing?.['@iot.id'];
                        if (thingId && !updatedThingIds.has(thingId)) {
                            // Find or create matching ObservedProperty in minimized
                            let targetOp = minimized.find(m => m['@iot.id'] === op['@iot.id']);
                            if (!targetOp) {
                                targetOp = { '@iot.id': op['@iot.id'], name: op.name, Datastreams: [] };
                                minimized.push(targetOp);
                            }
                            targetOp.Datastreams.push(ds);
                        }
                    }
                }
                console.log(`  ✓ Merged: ${updatedThingIds.size} updated, ${existingCache.sensorCount - updatedThingIds.size} preserved from cache`);
            }
            
            // Count unique sensors and active sensors
            const thingIds = new Set();
            let activeCount = 0;
            for (const op of minimized) {
                for (const ds of op.Datastreams || []) {
                    if (ds.Thing?.['@iot.id']) {
                        thingIds.add(ds.Thing['@iot.id']);
                        if (ds.isActive) activeCount++;
                    }
                }
            }
            
            // Generate cache version for cache-busting (timestamp-based)
            const cacheVersion = Date.now().toString(36);
            
            const output = {
                generatedAt: new Date().toISOString(),
                cacheVersion,  // For cache-busting in frontend
                updateType: quickMode ? 'incremental' : 'full',  // Track update type
                ...(quickMode && existingCache?.generatedAt ? { baseFullScan: existingCache.generatedAt } : {}),
                metric,
                metricLink: link,
                sensorCount: thingIds.size,
                activeSensorCount: activeCount,
                data: minimized,
            };
            
            const outputPath = join(OUTPUT_DIR, `${metric}.json`);
            const jsonString = JSON.stringify(output);
            await writeFileAtomic(outputPath, jsonString);
            
            const fileSizeKB = Math.round(jsonString.length / 1024);
            console.log(`  ✓ Saved ${thingIds.size} sensors (${activeCount} active) (${fileSizeKB} KB) in ${fetchTime}ms`);
            
            results[metric] = {
                sensors: thingIds.size,
                active: activeCount,
                sizeKB: fileSizeKB,
                fetchTimeMs: fetchTime,
            };
        } catch (error) {
            console.error(`  ✗ Error: ${error.message}`);
            results[metric] = { error: error.message };
        }
    }
    
    console.log('\n=== Summary ===');
    console.table(results);

    // A metric that failed was not refreshed. Report it through the exit code too.
    const failedMetrics = Object.keys(results).filter(metric => 'error' in results[metric]);
    if (failedMetrics.length > 0) {
        console.error(`\nERROR: ${failedMetrics.length} of ${metricsToProcess.length} metrics failed: ${failedMetrics.join(', ')}`);
        process.exitCode = 1;
        return;
    }

    console.log('\nDone! Static JSON files generated in public/sensor-cache/');
}

/**
 * Update mode: Fetch observation data for sensors that are missing lastObservationResult
 * in an existing cache file. Much faster than full regeneration.
 */
async function updateMode(metric, debugMode) {
    console.log(`\n=== UPDATE MODE: ${metric} ===\n`);
    
    const inputPath = join(OUTPUT_DIR, `${metric}.json`);
    
    // Load existing cache
    let existingData;
    try {
        const content = await readFile(inputPath, 'utf-8');
        existingData = JSON.parse(content);
        console.log(`Loaded existing cache: ${existingData.sensorCount} sensors`);
    } catch (e) {
        console.error(`Error loading cache file: ${e.message}`);
        console.error(`Run without --update to generate a new cache file.`);
        process.exit(1);
    }
    
    // Collect datastreams that need observation data
    const datastreamsToUpdate = [];
    const NON_FIJI_PREFIXES = ['KTUY_', 'SWNP_', 'RIVM_', 'KNJV_'];
    
    for (const op of existingData.data) {
        for (const ds of op.Datastreams || []) {
            const dsId = ds['@iot.id']?.toString() || '';
            const thingId = ds.Thing?.['@iot.id'];
            
            // Only update non-FIJI sensors that have no observation data
            if (thingId && 
                ds.lastObservationResult === null && 
                NON_FIJI_PREFIXES.some(prefix => dsId.startsWith(prefix))) {
                datastreamsToUpdate.push({ dsId, thingId });
            }
        }
    }
    
    console.log(`Found ${datastreamsToUpdate.length} sensors without observation data`);
    
    if (datastreamsToUpdate.length === 0) {
        console.log('Nothing to update!');
        return;
    }
    
    // Fetch observation data
    const startTime = Date.now();
    const thingObservations = await fetchActiveNonFijiThingData(datastreamsToUpdate, 5, debugMode);
    
    const fetchTime = Date.now() - startTime;
    
    console.log(`\nFetched observations for ${thingObservations.size} sensors in ${fetchTime}ms`);
    
    // Update the cache data
    let updated = 0;
    for (const op of existingData.data) {
        for (const ds of op.Datastreams || []) {
            const thingId = ds.Thing?.['@iot.id'];
            if (thingId && thingObservations.has(thingId)) {
                const obsData = thingObservations.get(thingId);
                ds.isActive = obsData.isActive;
                ds.lastObservationResult = obsData.result;
                delete ds.refreshFailed;
                updated++;
            }
        }
    }
    
    // Update metadata
    existingData.generatedAt = new Date().toISOString();
    let newActiveCount = 0;
    for (const op of existingData.data) {
        for (const ds of op.Datastreams || []) {
            if (ds.isActive) newActiveCount++;
        }
    }
    existingData.activeSensorCount = newActiveCount;
    
    // Save updated cache
    const jsonString = JSON.stringify(existingData);
    await writeFileAtomic(inputPath, jsonString);
    
    const fileSizeKB = Math.round(jsonString.length / 1024);
    console.log(`\n✓ Updated ${updated} sensors (${newActiveCount} active) (${fileSizeKB} KB)`);
}

async function run() {
    const args = process.argv.slice(2);
    const updateModeFlag = args.includes('--update');
    const debugMode = args.includes('--debug');
    const singleMetric = args.find(a => !a.startsWith('--'));
    
    if (updateModeFlag) {
        if (!singleMetric) {
            console.error('--update requires a metric name');
            console.error('Usage: node generate-sensor-cache.js --update airTemperature');
            process.exit(1);
        }
        await updateMode(singleMetric, debugMode);
    } else {
        await main();
        // Generate CAQI cache after all pollutant caches (unless running a single non-CAQI metric)
        if (!singleMetric || singleMetric === 'caqi') {
            // Skip if main() already handled caqi via the early return
            if (singleMetric !== 'caqi') {
                await generateCaqiCache();
            }
        }
    }
}

/**
 * EU CAQI calculation — mirrors computeCAQI in sensorDefinitions.js
 */
const CAQI_BREAKPOINTS = {
    no2:  [[0, 50, 0, 25], [50, 100, 25, 50], [100, 200, 50, 75], [200, 400, 75, 100]],
    pm10: [[0, 25, 0, 25], [25, 50, 25, 50],  [50, 90, 50, 75],   [90, 180, 75, 100]],
    pm25: [[0, 15, 0, 25], [15, 30, 25, 50],  [30, 55, 50, 75],   [55, 110, 75, 100]],
};

function caqiSubIndex(pollutant, concentration) {
    if (concentration == null || concentration < 0) return null;
    const bp = CAQI_BREAKPOINTS[pollutant];
    if (!bp) return null;
    for (const [cLow, cHigh, iLow, iHigh] of bp) {
        if (concentration <= cHigh) {
            return iLow + ((concentration - cLow) / (cHigh - cLow)) * (iHigh - iLow);
        }
    }
    const last = bp[bp.length - 1];
    return last[3] + ((concentration - last[1]) / (last[1] - last[0])) * (last[3] - last[2]);
}

/**
 * Generate caqi.json from existing pm25.json, pm10.json, no2.json caches.
 * For each Thing that has at least one pollutant reading, compute CAQI and
 * store the result with the worst-pollutant's datastream link (so dialog works).
 */
async function generateCaqiCache() {
    console.log('\n=== Generating CAQI (Air Quality Index) Cache ===\n');
    
    const POLLUTANT_METRICS = ['pm25', 'pm10', 'no2'];
    
    // Load all pollutant caches: thingId → { metric, value, isActive, ds, location }
    const thingData = new Map(); // thingId → { pm25, pm10, no2, location, dsLinks }
    
    for (const metric of POLLUTANT_METRICS) {
        const cachePath = join(OUTPUT_DIR, `${metric}.json`);
        let cache;
        try {
            cache = JSON.parse(await readFile(cachePath, 'utf-8'));
        } catch (e) {
            console.warn(`  [CAQI] Cannot read ${metric}.json — skipping: ${e.message}`);
            continue;
        }
        
        const seen = new Set();
        for (const op of cache.data || []) {
            for (const ds of op.Datastreams || []) {
                const thingId = ds.Thing?.['@iot.id'];
                if (!thingId || seen.has(thingId)) continue;
                seen.add(thingId);
                
                if (!thingData.has(thingId)) {
                    thingData.set(thingId, {
                        thingId,
                        location: ds.Thing.Locations?.[0]?.location || null,
                        name: ds.Thing.name || '',
                        pollutants: {},
                    });
                }
                
                const entry = thingData.get(thingId);
                entry.pollutants[metric] = {
                    value: ds.lastObservationResult,
                    isActive: ds.isActive === true,
                    dsId: ds['@iot.id'],
                    dsSelfLink: ds['@iot.selfLink'] || `${BASE_URL}/Datastreams('${ds['@iot.id']}')`,
                };
            }
        }
        console.log(`  [CAQI] Loaded ${seen.size} Things from ${metric}.json`);
    }
    
    console.log(`  [CAQI] Total unique Things across pollutants: ${thingData.size}`);
    
    // Compute CAQI for each Thing
    const caqiDatastreams = [];
    let activeCount = 0;
    
    for (const [thingId, data] of thingData) {
        if (!data.location) continue;
        
        // Skip Null Island
        const coords = data.location.coordinates;
        if (coords && coords[0] === 0 && coords[1] === 0) continue;
        
        // Build concentration map
        const concentrations = {};
        let hasAnyValue = false;
        for (const [metric, pData] of Object.entries(data.pollutants)) {
            if (pData.value !== null && pData.value !== undefined) {
                concentrations[metric] = pData.value;
                hasAnyValue = true;
            }
        }
        if (!hasAnyValue) continue;
        
        // Compute CAQI
        let maxSubIndex = -1;
        let worstMetric = null;
        for (const [metric, conc] of Object.entries(concentrations)) {
            const sub = caqiSubIndex(metric, conc);
            if (sub !== null && sub > maxSubIndex) {
                maxSubIndex = sub;
                worstMetric = metric;
            }
        }
        if (worstMetric === null) continue;
        
        const caqiScore = Math.round(maxSubIndex);
        const worstDs = data.pollutants[worstMetric];
        const isActive = Object.values(data.pollutants).some(p => p.isActive);
        if (isActive) activeCount++;
        
        caqiDatastreams.push({
            '@iot.id': worstDs.dsId,  // Worst pollutant's DS for dialog click-through
            '@iot.selfLink': worstDs.dsSelfLink,
            isActive,
            lastObservationResult: caqiScore,
            _worstMetric: worstMetric,  // Extra: which pollutant drove the score
            Thing: {
                '@iot.id': thingId,
                name: data.name,
                Locations: [{ location: data.location }],
            },
        });
    }
    
    const output = {
        generatedAt: new Date().toISOString(),
        cacheVersion: Date.now().toString(36),
        updateType: 'computed',
        metric: 'caqi',
        metricLink: null,
        sensorCount: caqiDatastreams.length,
        activeSensorCount: activeCount,
        data: [{
            '@iot.id': 'CAQI',
            Datastreams: caqiDatastreams,
        }],
    };
    
    const outputPath = join(OUTPUT_DIR, 'caqi.json');
    const jsonString = JSON.stringify(output);
    await writeFileAtomic(outputPath, jsonString);
    
    const fileSizeKB = Math.round(jsonString.length / 1024);
    console.log(`  ✓ CAQI: ${caqiDatastreams.length} sensors (${activeCount} active) (${fileSizeKB} KB)`);
}

let runCompleted = false;

// A run that stops before the end must not look like a success. This also covers an event
// loop that empties while something is still pending, which ends the process with code 0
// and no message.
process.on('exit', (code) => {
    if (runCompleted || code !== 0) return;

    console.error(`\n[${new Date().toISOString()}] ERROR: the process is exiting before the run completed`);
    process.exitCode = 1;
});

// By default a signal ends the process without an 'exit' event, so report it here.
// SIGKILL and an out-of-memory kill cannot be caught: those runs leave no closing line.
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(signal, () => {
        console.error(`\n[${new Date().toISOString()}] ERROR: received ${signal} before the run completed`);
        process.exit(128 + osConstants.signals[signal]);
    });
}

console.log(`[${new Date().toISOString()}] Run started`);

run()
    .then(() => {
        runCompleted = true;
        console.log(`[${new Date().toISOString()}] ${process.exitCode ? 'Run finished with errors' : 'Run finished'}`);
    })
    .catch((error) => {
        console.error(`\n[${new Date().toISOString()}] ERROR: the run failed`);
        console.error(error);
        process.exitCode = 1;
    });
