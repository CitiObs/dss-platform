import { inject } from "vue";
import { GeoJSON } from "ol/format";
import { withAsync, FeatureCollection } from "@geoint/geoint-vue";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";
import { useSensorStore } from "@/stores/sensorStore.js";
import cloneDeep from "lodash-es/cloneDeep";

const BASE_URLS = [
    // "https://api-samenmeten.rivm.nl/v1.0",
    // "https://citiobs.demo.secure-dimensions.de/staplustest/v1.1",
    // "https://nsdpstaplus.nilu.no/FROST-Server/v1.1",
    "https://api-virtualair.nilu.no/v1.1",  // No trailing slash
];

// Maximum sensors per grid cell before falling back to a cluster count.
// Higher = more individual markers, but more observation requests per cell.
const MAX_ITEMS = 200;

// In-memory observation cache to avoid repeated per-datastream requests
const observationCache = new Map();
const OBSERVATION_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// IndexedDB cache for sensor locations (no size limit, survives page reloads)
const SENSOR_CACHE_DB = "sensorThingsCache";
const SENSOR_CACHE_STORE = "sensors";
const SENSOR_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Open IndexedDB database
 */
function openCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SENSOR_CACHE_DB, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(SENSOR_CACHE_STORE)) {
                db.createObjectStore(SENSOR_CACHE_STORE, { keyPath: "metric" });
            }
        };
    });
}

/**
 * Get cached sensor data from IndexedDB
 */
async function getCachedSensors(metric) {
    try {
        const db = await openCacheDB();
        
        return new Promise((resolve) => {
            const tx = db.transaction(SENSOR_CACHE_STORE, "readonly");
            const store = tx.objectStore(SENSOR_CACHE_STORE);
            const request = store.get(metric);
            
            request.onerror = () => {
                console.warn("[SensorCache] Error reading cache");
                resolve(null);
            };
            
            request.onsuccess = () => {
                const cached = request.result;
                if (!cached) {
                    resolve(null);
                    return;
                }
                
                if (Date.now() - cached.timestamp > SENSOR_CACHE_TTL) {
                    // Cache expired - delete it
                    const deleteTx = db.transaction(SENSOR_CACHE_STORE, "readwrite");
                    deleteTx.objectStore(SENSOR_CACHE_STORE).delete(metric);
                    resolve(null);
                    return;
                }
                
                console.log(`[SensorCache] Using cached data for ${metric} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
                resolve(cached.data);
            };
        });
    } catch (e) {
        console.warn("[SensorCache] IndexedDB error:", e);
        return null;
    }
}

/**
 * Cache sensor data to IndexedDB
 */
async function cacheSensors(metric, data) {
    try {
        const db = await openCacheDB();
        
        const tx = db.transaction(SENSOR_CACHE_STORE, "readwrite");
        const store = tx.objectStore(SENSOR_CACHE_STORE);
        
        store.put({
            metric,
            timestamp: Date.now(),
            data: data
        });
        
        console.log(`[SensorCache] Cached ${data.length} ObservedProperties for ${metric} (IndexedDB)`);
    } catch (e) {
        console.warn("[SensorCache] Error writing to IndexedDB:", e);
    }
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * Transform ObservedProperties response to GeoJSON features.
 * The response structure is: ObservedProperty -> Datastreams -> Thing/Locations/Observations
 */
function observedPropertiesToGeoJSON(observedProperties, projection) {
    const plainFeatures = {
        type: "FeatureCollection",
        features: [],
    };

    // Map to track unique Things (a Thing may have multiple Datastreams)
    const thingsMap = new Map();

    // Debug counters
    let totalDatastreams = 0;
    let noThing = 0;
    let noLocation = 0;
    let noDatastreamId = 0;

    for (const obsProp of observedProperties) {
        const datastreams = obsProp.Datastreams || [];
        totalDatastreams += datastreams.length;

        for (const ds of datastreams) {
            const thing = ds.Thing;
            if (!thing) {
                noThing++;
                continue;
            }

            const thingId = thing["@iot.id"];
            const locationData = thing.Locations?.[0]?.location;
            if (!locationData) {
                noLocation++;
                continue;
            }

            // Filter out "Null Island" sensors (coordinates [0, 0] = missing location data)
            const coords = locationData.coordinates;
            if (coords && coords[0] === 0 && coords[1] === 0) {
                noLocation++;
                continue;
            }

            // If we've already processed this Thing, skip duplicate datastreams
            // (We only need one datastream per Thing for the map marker)
            if (thingsMap.has(thingId)) {
                continue;
            }

            // PERFORMANCE: Avoid cloneDeep - just reference the geometry directly
            // and capitalize type in place
            const geometry = {
                type: capitalize(locationData.type),
                coordinates: locationData.coordinates,
            };

            // Extract datastream ID - try @iot.id first, then extract from @iot.selfLink URL
            let datastreamId = ds["@iot.id"];
            if (!datastreamId && ds["@iot.selfLink"]) {
                // Extract ID from URL like: https://api-virtualair.nilu.no/v1.1/Datastreams('KTUY_123')
                const match = ds["@iot.selfLink"].match(/Datastreams\(['"]?([^'"]+)['"]?\)/i);
                if (match) {
                    datastreamId = match[1];
                }
            }

            // Construct virtualair URLs to avoid CORS issues with federated sources
            const virtualairDatastreamLink = datastreamId 
                ? `https://api-virtualair.nilu.no/v1.1/Datastreams('${datastreamId}')`
                : null;

            // Also construct virtualair Thing URL (original selfLink may point to external sources)
            const virtualairThingLink = `https://api-virtualair.nilu.no/v1.1/Things('${thingId}')`;

            if (!virtualairDatastreamLink) {
                noDatastreamId++;
            }

            // Determine isActive - either from cache or from Observations
            let isActive = ds.isActive === true;
            let lastObservationResult = ds.lastObservationResult ?? null;
            
            // For live API queries, calculate from Observations
            if (ds.Observations?.length > 0) {
                const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
                const cutoffDate = new Date(Date.now() - FIVE_DAYS_MS);
                
                // Find the most recent valid observation (filter out -99 sentinel)
                const validObs = ds.Observations.filter(obs => 
                    obs.result !== null && obs.result !== undefined && obs.result !== -99
                );
                
                const latestObs = validObs.reduce((latest, obs) => {
                    if (!latest) return obs;
                    return new Date(obs.phenomenonTime) > new Date(latest.phenomenonTime) ? obs : latest;
                }, null);
                
                if (latestObs) {
                    isActive = new Date(latestObs.phenomenonTime) >= cutoffDate;
                    lastObservationResult = latestObs.result;
                }
            }

            // PERFORMANCE: Store only minimal properties needed for display
            const thingData = {
                geometry,
                properties: {
                    id: thingId,
                    selfLink: virtualairThingLink,  // Use virtualair URL to avoid CORS
                    datastreamSelfLink: virtualairDatastreamLink,
                    datastreamId: datastreamId,
                    name: thing.name || "",
                    description: thing.description || "",
                    isActive,  // Has data in last 5 days
                    lastObservationResult,  // Latest observation value for color scale
                },
            };

            thingsMap.set(thingId, thingData);
        }
    }

    console.log(
        `[observedPropertiesToGeoJSON] ${totalDatastreams} datastreams → ${thingsMap.size} unique sensors (noThing: ${noThing}, noLocation: ${noLocation}, noDatastreamId: ${noDatastreamId})`
    );

    // Build features from unique Things - simplified structure
    for (const [, thingData] of thingsMap) {
        const feature = {
            type: "Feature",
            geometry: thingData.geometry,
            properties: thingData.properties,
        };

        plainFeatures.features.push(feature);
    }

    const olFeatures = new GeoJSON().readFeatures(plainFeatures, { featureProjection: projection });

    return olFeatures;
}

function thingsToGeoJSON(things, projection, metricLink) {
    const plainFeatures = {
        type: "FeatureCollection",
        features: [],
    };

    for (const thing of things) {
        const locationData = thing.Locations[0]?.location;
        if (!locationData) continue;

        const geometry = cloneDeep(locationData);
        geometry.type = capitalize(geometry.type);

        // Find the datastream matching the selected metric
        const matchingDs =
            thing.Datastreams?.find((ds) => ds.ObservedProperty?.definition === metricLink) || thing.Datastreams?.[0];

        const properties = {
            ...cloneDeep(thing.properties),
            id: thing["@iot.id"],
            selfLink: thing["@iot.selfLink"],
            datastreamSelfLink: matchingDs?.["@iot.selfLink"],
            observationsNavigationLink: matchingDs?.["Observations@iot.navigationLink"],
            name: thing.name,
            description: thing.description,
            datastreams: thing.Datastreams,
        };

        const feature = {
            type: "Feature",
            geometry,
            properties,
        };

        plainFeatures.features.push(feature);
    }

    const olFeatures = new GeoJSON().readFeatures(plainFeatures, { featureProjection: projection });

    return olFeatures;
}

async function fetchThingsFromAllApis(params, api) {
    const requests = BASE_URLS.map(async (url) => {
        const { response, error } = await withAsync(api.get, `${url}/Things`, {
            params,
        });

        if (error) {
            console.error(error);
            return;
        }

        return response.data;
    });

    const responses = await Promise.all(requests);

    return responses;
}

export function useSensorThingsApi(projection = "EPSG:3857") {
    const sensorStore = useSensorStore();
    const geoint = inject("geoint");
    const api = geoint.api("virtualair");

    const getThings = async (metric, cell, zoom = 0) => {
        let collection = new FeatureCollection();

        // At high zoom the grid cells are small — allow more individual markers
        // before falling back to a cluster count.
        const maxItems = zoom >= 10 ? 1500 : zoom >= 7 ? 600 : zoom >= 6 ? 300 : MAX_ITEMS;

        const polygon = cell.toWKT();
        const metricLink = SENSOR_DEFINITIONS[metric].link;
        const cacheKey = `${metric}:${maxItems}:${polygon}`;

        const storedSensorData = sensorStore.getSensorData(cacheKey);
        if (storedSensorData) {
            storedSensorData.things.all().forEach((feature) => {
                collection.push(feature);
            });
            return collection;
        }

        // At high zoom, cells are small — skip the count query and fetch directly
        if (zoom >= 10) {
            const fetchParams = {
                $expand: `Datastreams($filter=ObservedProperty/definition eq '${metricLink}';$expand=ObservedProperty($select=definition),Observations($orderby=phenomenonTime desc;$top=1;$select=phenomenonTime,result)),Locations($select=location)`,
                $filter: `st_within(Locations/location, geography'${polygon}') and Datastreams/ObservedProperty/definition eq '${metricLink}'`,
                $top: maxItems,
            };

            const thingsResponses = await fetchThingsFromAllApis(fetchParams, api);

            thingsResponses.forEach((responseData) => {
                if (!responseData) return;
                for (const feature of thingsToGeoJSON(responseData.value, projection)) {
                    collection._features.push(feature);
                }
            });

            sensorStore.setSensorData(cacheKey, collection, new Date());
            return collection;
        }

        // Phase 1: Count + one sample Thing for accurate cluster positioning
        const countParams = {
            $expand: "Datastreams/ObservedProperty($select=definition),Locations($select=location)",
            $filter: `st_within(Locations/location, geography'${polygon}') and Datastreams/ObservedProperty/definition eq '${metricLink}'`,
            $count: true,
            $top: 1,
        };

        const countResponses = await fetchThingsFromAllApis(countParams, api);

        let totalCount = 0;
        let sampleLocation = null;
        countResponses.forEach((responseData) => {
            if (!responseData) return;
            totalCount += responseData["@iot.count"] || 0;
            if (!sampleLocation && responseData.value?.[0]?.Locations?.[0]?.location) {
                sampleLocation = responseData.value[0].Locations[0].location;
            }
        });

        if (totalCount === 0) {
            return collection;
        }

        // Too many items — show cluster count marker at an actual sensor location
        if (totalCount > maxItems) {
            let clusterFeatures;
            if (sampleLocation) {
                const geojson = {
                    type: "FeatureCollection",
                    features: [{ type: "Feature", properties: {}, geometry: sampleLocation }],
                };
                clusterFeatures = new GeoJSON().readFeatures(geojson, { featureProjection: projection });
            } else {
                clusterFeatures = cell.getCenter().toFeatures();
            }
            collection = new FeatureCollection(clusterFeatures);
            collection.attachProperties(
                {},
                {
                    type: "count",
                    count: totalCount,
                }
            );
            sensorStore.setSensorData(cacheKey, collection, new Date());
            return collection;
        }

        // Phase 2: Fetch actual Things with observations embedded
        const fetchParams = {
            $expand: `Datastreams($filter=ObservedProperty/definition eq '${metricLink}';$expand=ObservedProperty($select=definition),Observations($orderby=phenomenonTime desc;$top=1;$select=phenomenonTime,result)),Locations($select=location)`,
            $filter: `st_within(Locations/location, geography'${polygon}') and Datastreams/ObservedProperty/definition eq '${metricLink}'`,
            $top: maxItems,
        };

        const thingsResponses = await fetchThingsFromAllApis(fetchParams, api);

        thingsResponses.forEach((responseData) => {
            if (!responseData) return;
            for (const feature of thingsToGeoJSON(responseData.value, projection)) {
                collection._features.push(feature);
            }
        });

        sensorStore.setSensorData(cacheKey, collection, new Date());
        return collection;
    };

    const getSimpleThingData = async (id) => {
        // Check in-memory cache first
        const cached = observationCache.get(id);
        if (cached && Date.now() - cached.timestamp < OBSERVATION_CACHE_TTL) {
            return cached.data;
        }

        const url = "https://api-virtualair.nilu.no/v1.1";

        const { response, error } = await withAsync(
            api.get,
            `${url}/Datastreams(${id})?$expand=Observations($orderby=phenomenonTime%20desc;$top=1)&$select=Observations/result`
        );

        if (error) {
            console.error(error);
            return;
        }

        const data = response.data.Observations?.[0] || null;
        observationCache.set(id, { data, timestamp: Date.now() });
        return data;
    };

    /**
     * Convert any datastream link to use the virtualair proxy.
     * Federated sources (samenmeten.rivm.nl, etc.) block CORS, so we route through virtualair.
     * @param {string} datastreamLink - The original datastream link
     * @returns {string} The virtualair-proxied URL
     */
    const toVirtualairUrl = (datastreamLink) => {
        if (!datastreamLink) return null;
        
        // Already virtualair - use as is
        if (datastreamLink.includes("api-virtualair.nilu.no")) {
            return datastreamLink;
        }
        
        // Extract datastream ID from properties stored on feature (e.g., "KTUY_123")
        // For now, we can't reliably extract IDs from external URLs, so return null
        // The caller should use Thing-based endpoints instead
        console.warn("[toVirtualairUrl] Cannot convert non-virtualair URL:", datastreamLink);
        return null;
    };

    /**
     * Get the first (earliest) observation from a datastream
     * Uses $orderby for FIJI sources (fast), pagination for KTUY (avoid timeouts)
     * @param {string} datastreamLink - The full datastream link or datastream ID
     * @returns {Promise<Object|null>} The first observation with phenomenonTime and result
     */
    const getFirstObservation = async (datastreamLink) => {
        if (!datastreamLink) {
            console.error("datastreamLink is required");
            return null;
        }

        // Skip non-virtualair URLs to avoid CORS errors
        const safeUrl = toVirtualairUrl(datastreamLink);
        if (!safeUrl) {
            console.warn("[getFirstObservation] Skipping CORS-blocked URL");
            return null;
        }

        // Extract datastream ID to check source type
        const dsIdMatch = safeUrl.match(/Datastreams\('([^']+)'\)/);
        const dsId = dsIdMatch ? dsIdMatch[1] : "";
        const isKTUY = dsId.startsWith("KTUY_");

        const url = `${safeUrl}/Observations`;

        // For KTUY: Use $orderby asc to get oldest observation directly.
        // NOTE: $skip with large values returns empty on virtualair proxy,
        // so we use $orderby asc instead (~12s but returns correct data).
        if (isKTUY) {
            const { response: oldestRes, error: oldestErr } = await withAsync(api.get, url, {
                params: {
                    $top: 1,
                    $select: "phenomenonTime,result",
                    $orderby: "phenomenonTime asc",
                },
                timeout: 20000,  // 20s — KTUY $orderby asc is slow (~12s)
                headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
            });

            if (!oldestErr && oldestRes.data.value?.length > 0) {
                const obs = oldestRes.data.value[0];
                if (obs.result !== null && obs.result !== undefined && obs.result !== -99) {
                    console.log(`[getFirstObservation] KTUY first observation: ${obs.phenomenonTime}`);
                    return obs;
                }
            }

            if (oldestErr?.code !== "ERR_CANCELED" && oldestErr?.code !== "ECONNABORTED") {
                console.warn("[getFirstObservation] KTUY $orderby asc failed, falling back");
            }
        }

        // For FIJI or KTUY fallback: use $orderby (fast for FIJI)
        const params = {
            $top: 50,
            $select: "phenomenonTime,result",
            $orderby: "phenomenonTime asc",
        };

        const { response, error } = await withAsync(api.get, url, {
            params,
            timeout: 15000,  // 15 second timeout
            headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
        });

        if (error) {
            if (error.code !== "ERR_CANCELED" && error.code !== "ECONNABORTED") {
                console.error("Error fetching first observation:", error);
            }
            return null;
        }

        const observations = response.data.value || [];
        if (observations.length === 0) return null;

        // Filter out invalid results (-99 is "no data" sentinel, null means missing)
        const validObs = observations.filter(obs => 
            obs.result !== null && obs.result !== undefined && obs.result !== -99
        );
        if (validObs.length === 0) return null;

        return validObs[0];
    };

    /**
     * Get the last (latest) observation from a datastream
     * Uses $orderby for FIJI sources (fast), simple fetch for KTUY (newest first by default)
     * @param {string} datastreamLink - The full datastream link or datastream ID
     * @returns {Promise<Object|null>} The last observation with phenomenonTime and result
     */
    const getLastObservation = async (datastreamLink) => {
        if (!datastreamLink) {
            console.error("datastreamLink is required");
            return null;
        }

        // Skip non-virtualair URLs to avoid CORS errors
        const safeUrl = toVirtualairUrl(datastreamLink);
        if (!safeUrl) {
            console.warn("[getLastObservation] Skipping CORS-blocked URL");
            return null;
        }

        // Extract datastream ID to check source type
        const dsIdMatch = safeUrl.match(/Datastreams\('([^']+)'\)/);
        const dsId = dsIdMatch ? dsIdMatch[1] : "";
        const isKTUY = dsId.startsWith("KTUY_");

        const url = `${safeUrl}/Observations`;

        // For KTUY: data returns newest first by default, so top 50 is fine
        // For FIJI: use $orderby desc
        const params = {
            $top: 50,
            $select: "phenomenonTime,result",
        };
        
        if (!isKTUY) {
            params.$orderby = "phenomenonTime desc";
        }

        const { response, error } = await withAsync(api.get, url, {
            params,
            timeout: 15000,  // 15 second timeout
            headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
        });

        if (error) {
            // Don't log aborted requests (user navigated away)
            if (error.code !== "ERR_CANCELED" && error.code !== "ECONNABORTED") {
                console.error("Error fetching last observation:", error);
            }
            return null;
        }

        const observations = response.data.value || [];
        if (observations.length === 0) return null;

        // Filter out invalid results (-99 is "no data" sentinel, null means missing)
        const validObs = observations.filter(obs => 
            obs.result !== null && obs.result !== undefined && obs.result !== -99
        );
        if (validObs.length === 0) return null;

        // Sort to find the actual latest (KTUY may not be perfectly ordered)
        validObs.sort((a, b) => new Date(b.phenomenonTime) - new Date(a.phenomenonTime));
        return validObs[0];
    };

    /**
     * Get both first and last observations - OPTIMIZED for KTUY
     * For KTUY: Single $count, then parallel fetch of newest + oldest
     * For FIJI: Parallel $orderby queries (fast)
     * @param {string} datastreamLink - The full datastream link or datastream ID
     * @returns {Promise<{first: Object|null, last: Object|null}>}
     */
    const getFirstAndLastObservations = async (datastreamLink) => {
        if (!datastreamLink) {
            return { first: null, last: null };
        }

        const safeUrl = toVirtualairUrl(datastreamLink);
        if (!safeUrl) {
            return { first: null, last: null };
        }

        const dsIdMatch = safeUrl.match(/Datastreams\('([^']+)'\)/);
        const dsId = dsIdMatch ? dsIdMatch[1] : "";
        const isKTUY = dsId.startsWith("KTUY_");
        const url = `${safeUrl}/Observations`;

        // For KTUY: Parallel fetch of newest ($top) and oldest ($orderby asc)
        // NOTE: $skip with large values returns empty on virtualair proxy,
        // so we use $orderby asc for the oldest observation instead.
        if (isKTUY) {
            console.time("[getFirstAndLastObservations] KTUY");
            try {
                const [newestRes, oldestRes] = await Promise.all([
                    // Newest: KTUY returns newest-first by default, $top is fast
                    withAsync(api.get, url, {
                        params: { $top: 50, $select: "phenomenonTime,result" },
                        timeout: 15000,
                        headers: { "Cache-Control": "no-cache" },
                    }),
                    // Oldest: $orderby asc is slow (~12s) but returns correct data
                    withAsync(api.get, url, {
                        params: { $top: 1, $select: "phenomenonTime,result", $orderby: "phenomenonTime asc" },
                        timeout: 20000,  // 20s — KTUY $orderby asc is slow
                        headers: { "Cache-Control": "no-cache" },
                    }),
                ]);

                let last = null;
                let first = null;

                // Process newest (for last observation)
                if (!newestRes.error && newestRes.response?.data?.value?.length > 0) {
                    const validObs = newestRes.response.data.value.filter(obs =>
                        obs.result !== null && obs.result !== undefined && obs.result !== -99
                    );
                    if (validObs.length > 0) {
                        validObs.sort((a, b) => new Date(b.phenomenonTime) - new Date(a.phenomenonTime));
                        last = validObs[0];
                    }
                }

                // Process oldest (for first observation)
                if (!oldestRes.error && oldestRes.response?.data?.value?.length > 0) {
                    const obs = oldestRes.response.data.value[0];
                    if (obs.result !== null && obs.result !== undefined && obs.result !== -99) {
                        first = obs;
                    }
                }

                console.timeEnd("[getFirstAndLastObservations] KTUY");
                console.log(`[getFirstAndLastObservations] KTUY first: ${first?.phenomenonTime}, last: ${last?.phenomenonTime}`);
                return { first, last };

            } catch (e) {
                console.timeEnd("[getFirstAndLastObservations] KTUY");
                if (e?.code !== "ERR_CANCELED" && e?.code !== "ECONNABORTED") {
                    console.warn("[getFirstAndLastObservations] KTUY error:", e);
                }
            }
        }

        // For FIJI or fallback: parallel $orderby queries (fast)
        const [first, last] = await Promise.all([
            getFirstObservation(datastreamLink),
            getLastObservation(datastreamLink),
        ]);

        return { first, last };
    };

    /**
     * Get observations in a custom date range
     * @param {string} datastreamLink - Full Datastream @iot.link
     * @param {string|Date} startDate
     * @param {string|Date} endDate
     * @returns {Promise<Array>}
     */
    const getObservationsByPeriod = async (datastreamLink, startDate, endDate) => {
        if (!datastreamLink || !startDate || !endDate) {
            console.error("datastreamLink, startDate and endDate are required");
            return [];
        }

        // Skip non-virtualair URLs to avoid CORS errors
        const safeUrl = toVirtualairUrl(datastreamLink);
        if (!safeUrl) {
            console.warn("[getObservationsByPeriod] Skipping CORS-blocked URL");
            return [];
        }

        const startISO = new Date(startDate).toISOString();
        const endISO = new Date(endDate).toISOString();

        const params = {
            // Note: $orderby removed - causes 8+ second delays on KTUY sources
            // Sorting is done client-side after fetching
            $select: "phenomenonTime,result",
            $filter: `phenomenonTime ge ${startISO} and phenomenonTime le ${endISO}`,
        };

        const url = `${safeUrl}/Observations`;

        const { response, error } = await withAsync(api.get, url, {
            params,
            headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
        });

        if (error) {
            console.error("Error fetching period observations:", error);
            return [];
        }

        const rawObservations = response.data.value || [];
        console.log("[getObservationsByPeriod] Raw observations from API:", rawObservations.length);
        
        // Filter out -99 sentinel values (means "no data" in meteorological datasets)
        let observations = rawObservations.filter(obs => 
            obs.result !== -99 && obs.result !== null && obs.result !== undefined
        );
        
        console.log("[getObservationsByPeriod] After filtering -99/null:", observations.length);

        // Sort by phenomenonTime ascending (for charts)
        observations.sort((a, b) => new Date(a.phenomenonTime) - new Date(b.phenomenonTime));

        return observations;
    };

    /**
     * Fetches ALL sensors for a metric using the ObservedProperties endpoint.
     * OPTIMIZED: 
     * - Tries static JSON first for instant first load (~100ms)
     * - Falls back to IndexedDB cache for subsequent loads
     * - If no cache, uses parallel API loading (~3-4s total)
     * - Background refresh: updates from live API after showing cached data
     *
     * Returns: OL Feature[]
     * Calls onProgress(features, isPartial) when data is ready.
     */
    const getAllThings = async (metric, { onProgress, skipCache = false } = {}) => {
        const metricLink = SENSOR_DEFINITIONS[metric].link;

        // === STEP 1: Try static JSON for instant first load ===
        if (!skipCache) {
            try {
                console.time("[getAllThings] Static JSON fetch");
                // Add cache-busting query parameter to ensure fresh data
                const cacheBuster = Date.now();
                const staticUrl = `${window.location.origin}/sensor-cache/${metric}.json?_=${cacheBuster}`;
                const response = await fetch(staticUrl, { cache: "no-store" });
                
                if (response.ok) {
                    const staticData = await response.json();
                    console.timeEnd("[getAllThings] Static JSON fetch");
                    
                    if (staticData.data && staticData.data.length > 0) {
                        console.time("[getAllThings] Static JSON - GeoJSON conversion");
                        const features = observedPropertiesToGeoJSON(staticData.data, projection);
                        console.timeEnd("[getAllThings] Static JSON - GeoJSON conversion");
                        console.log(`[getAllThings] Loaded ${features.length} features from static JSON (generated: ${staticData.generatedAt}, version: ${staticData.cacheVersion || 'N/A'})`);
                        
                        // DEBUG: Log sample of features with their color-determining properties
                        if (features.length > 0) {
                            const sample = features.slice(0, 3).map(f => ({
                                id: f.get('id'),
                                isActive: f.get('isActive'),
                                lastObservationResult: f.get('lastObservationResult'),
                            }));
                            console.log('[getAllThings] Sample features:', sample);
                        }
                        
                        // Cache to IndexedDB for offline/faster subsequent loads
                        cacheSensors(metric, staticData.data);
                        
                        if (onProgress) onProgress(features, false);
                        return features;
                    }
                }
            } catch (e) {
                console.log("[getAllThings] Static JSON not available, falling back to API");
            }
        }

        // === STEP 2: Check IndexedDB cache ===
        if (!skipCache) {
            const cached = await getCachedSensors(metric);
            if (cached) {
                console.time("[getAllThings] Cache hit - GeoJSON conversion");
                const features = observedPropertiesToGeoJSON(cached, projection);
                console.timeEnd("[getAllThings] Cache hit - GeoJSON conversion");
                console.log(`[getAllThings] Loaded ${features.length} features from IndexedDB cache`);
                
                if (onProgress) onProgress(features, false);
                return features;
            }
        }

        // === STEP 3: Fetch from live API (existing logic) ===
        console.time("[getAllThings] Total fetch time");
        console.log(`[getAllThings] Querying metric: ${metric} (${metricLink})`);

        // Helper function to fetch ObservedProperties with given expand params
        async function fetchObservedProperties(baseUrl, expandParams) {
            const params = {
                $filter: `definition eq '${metricLink}'`,
                $expand: expandParams,
                $top: 1000,
            };
            
            let allProps = [];
            let nextUrl = `${baseUrl}/ObservedProperties`;
            let pageParams = params;
            
            while (nextUrl) {
                const { response, error } = await withAsync(api.get, nextUrl, {
                    params: pageParams,
                    timeout: 60000,
                });

                if (error) {
                    if (error.code === "ECONNABORTED" || error.code === "ERR_CANCELED") {
                        return null; // Aborted
                    }
                    console.error(error);
                    break;
                }

                const data = response.data;
                if (data.value) {
                    allProps = allProps.concat(data.value);
                }

                nextUrl = data["@iot.nextLink"] || null;
                pageParams = {};
            }
            
            return allProps;
        }

        // Merge datastreams from multiple chunks into unified ObservedProperties
        function mergeAllChunks(chunks) {
            const merged = new Map();
            
            for (const chunk of chunks) {
                if (!chunk) continue;
                
                for (const op of chunk) {
                    const id = op["@iot.id"];
                    if (merged.has(id)) {
                        // Add new datastreams to existing
                        const existing = merged.get(id);
                        existing.Datastreams.push(...(op.Datastreams || []));
                    } else {
                        merged.set(id, { ...op, Datastreams: [...(op.Datastreams || [])] });
                    }
                }
            }
            
            return Array.from(merged.values());
        }

        for (const baseUrl of BASE_URLS) {
            console.log(`[getAllThings] Request URL: ${baseUrl}/ObservedProperties`);

            // OPTIMIZED PARALLEL LOADING:
            // Fire ALL requests at once - smallest finishes first for fast first paint
            // Uses 5 chunks to stay within browser's 6-connection-per-origin limit
            // Chunk sizes tuned for progressive loading:
            // - First chunk: $top=200 (finishes in <1s, ~500 sensors for fast first paint)
            // - Rest: $top=2000 each (larger chunks = fewer requests = less overhead)
            
            const CHUNK_CONFIG = [
                { top: 200, skip: 0 },      // Priority: ~500 sensors in <1s
                { top: 2000, skip: 200 },   // ~1500 more sensors
                { top: 2000, skip: 2200 },  // ~1500 more sensors  
                { top: 2000, skip: 4200 },  // ~1500 more sensors
                { top: 2000, skip: 6200 },  // ~1000 more sensors (tail)
            ];
            
            // Track completed chunks for progressive updates
            const completedChunks = [];
            let updateScheduled = false;
            let firstUpdateDone = false;
            
            // Schedule a progressive update
            const scheduleProgressUpdate = () => {
                if (!onProgress) return;
                
                // First update - show immediately (fast first paint)
                if (!firstUpdateDone) {
                    firstUpdateDone = true;
                    const merged = mergeAllChunks(completedChunks);
                    const features = observedPropertiesToGeoJSON(merged, projection);
                    console.log(`[getAllThings] FIRST PAINT: ${features.length} sensors`);
                    onProgress(features, true);
                    return;
                }
                
                // Subsequent updates - debounce
                if (updateScheduled) return;
                updateScheduled = true;
                
                setTimeout(() => {
                    updateScheduled = false;
                    const merged = mergeAllChunks(completedChunks);
                    const features = observedPropertiesToGeoJSON(merged, projection);
                    const isPartial = completedChunks.length < CHUNK_CONFIG.length;
                    console.log(`[getAllThings] Progress: ${completedChunks.length}/${CHUNK_CONFIG.length} chunks, ${features.length} sensors`);
                    onProgress(features, isPartial);
                }, 150);
            };
            
            console.log(`[getAllThings] Firing ${CHUNK_CONFIG.length} parallel requests...`);
            
            // Fire ALL requests in parallel - smallest finishes first naturally
            const chunkPromises = CHUNK_CONFIG.map(async ({ top, skip }, index) => {
                console.time(`[getAllThings] Chunk ${index + 1} (top=${top}, skip=${skip})`);
                
                // Include Observations for active sensor detection
                // No $orderby (causes timeouts on KTUY) - sort client-side
                const result = await fetchObservedProperties(
                    baseUrl,
                    `Datastreams($top=${top};$skip=${skip};$expand=Observations($top=50;$select=phenomenonTime,result)),Datastreams/Thing/Locations`
                );
                
                console.timeEnd(`[getAllThings] Chunk ${index + 1} (top=${top}, skip=${skip})`);
                
                if (result) {
                    completedChunks.push(result);
                    scheduleProgressUpdate(); // Update UI
                }
                
                return result;
            });
            
            // Wait for all requests to complete
            const allResults = await Promise.all(chunkPromises);
            
            // Check if any request was aborted
            if (allResults.some(chunk => chunk === null)) {
                console.log("[getAllThings] Some requests aborted");
                // Return whatever we have
                const merged = mergeAllChunks(completedChunks);
                const features = observedPropertiesToGeoJSON(merged, projection);
                console.timeEnd("[getAllThings] Total fetch time");
                return features;
            }
            
            // Merge all chunks into final result
            const allObservedProperties = mergeAllChunks(allResults);
            
            // Cache the full API response for future loads
            cacheSensors(metric, allObservedProperties);
            
            console.timeEnd("[getAllThings] Total fetch time");
            
            const finalFeatures = observedPropertiesToGeoJSON(allObservedProperties, projection);
            console.log(`[getAllThings] Complete: ${finalFeatures.length} sensors`);
            
            // Final update with complete data
            if (onProgress) onProgress(finalFeatures, false);
            
            return finalFeatures;
        }

        return [];
    };

    return {
        getThings,
        getAllThings,
        getSimpleThingData,
        getFirstObservation,
        getLastObservation,
        getFirstAndLastObservations,
        getObservationsByPeriod,
    };
}
