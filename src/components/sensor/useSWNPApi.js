import { inject } from "vue";
import { withAsync } from "@geoint/geoint-vue";

const VIRTUALAIR_URL = "https://api-virtualair.nilu.no/v1.1";

// Upstream server per datastream ID prefix, for sources that do not set properties.origin.
// FIJI and KTUY are inferred (FIJI nextLinks point to nsdpstaplus, KTUY Things carry RIVM
// Samen Meten metadata), not confirmed by NILU.
const ORIGIN_BY_PREFIX = {
    FIJI: "https://nsdpstaplus.nilu.no/FROST-Server/v1.1",
    KTUY: "https://api-samenmeten.rivm.nl/v1.0",
};

/**
 * Resolve the upstream server a datastream comes from.
 * VirtualAir federates several servers; some set properties.origin, the rest are known by ID prefix.
 */
function resolveDataOrigin(datastream) {
    const origin = datastream.properties?.origin;
    if (origin) return origin;

    const prefix = datastream["@iot.id"]?.toString().split("_")[0];

    return ORIGIN_BY_PREFIX[prefix] || VIRTUALAIR_URL;
}

export function useSWNPApi () {
    const geoint = inject("geoint");
    const api = geoint.api("virtualair");

    let abortController = null;

    const MAX_OBSERVATION_REQUESTS = 2;

    function abortRequest () {
        if (abortController) {
            // Abort the request and clear the abortController
            abortController.abort();
            abortController = null;
        }
    }

    function getOldestTimeOfLastLocation (locations) {
        // Sort locations by time (latest first)
        const sortedLocations = locations.value.sort((a, b) => new Date(b.time) - new Date(a.time));
    
        let lastCoordinates = null;
        let oldestTime = null;
    
        for (let i = 0; i < sortedLocations.length; i++) {
            const currentLocation = sortedLocations[i].Locations?.[0]?.location;
            if (!currentLocation) continue;
    
            const currentCoordinates = JSON.stringify(currentLocation.coordinates);
    
            // If coordinates change, update the oldest time for the last location
            if (lastCoordinates !== null && lastCoordinates !== currentCoordinates) {
                break; // Stop at the first change
            }
    
            lastCoordinates = currentCoordinates;
            oldestTime = sortedLocations[i].time;
        }
    
        return oldestTime;
    }

    function filterObservationsByTime(oldestTime, observations) {
        const oldestDate = new Date(oldestTime);
        return observations.filter(obs => new Date(obs.phenomenonTime) >= oldestDate);
    }

    /**
     * Filter out sentinel/invalid values from observations.
     * -99 is commonly used as "no data" sentinel in meteorological data.
     */
    function filterInvalidObservations(observations) {
        return observations.filter(obs => {
            // Filter out -99 sentinel values (means "no data")
            if (obs.result === -99 || obs.result === -99.0) return false;
            // Filter out null/undefined results
            if (obs.result === null || obs.result === undefined) return false;
            return true;
        });
    }

    async function getSensorLocations (thingLink) {
        const params = { 
            $expand: "Locations($select=location)",
        };

        const { response, error } = await withAsync(
            api.get,
            `${thingLink}/HistoricalLocations`,
            {
                params,
                signal: abortController.signal,
            }
        );

        if (error) {
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
            return;
        }

        return response.data;
    }

    async function getMoreObservations (observationsLink) {
        const { response, error } = await withAsync(
            api.get,
            observationsLink,
            {
                signal: abortController.signal,
            }
        );

        if (error) {
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
            return;
        }

        return response.data;
    }

    /**
     * Fetch datastreams for a Thing via the virtualair proxy.
     * This avoids CORS issues with federated sources (samenmeten.rivm.nl, etc.)
     * @param {string} thingLink - The virtualair Thing link (e.g., https://api-virtualair.nilu.no/v1.1/Things('KTUY_XXX'))
     * @param {string} metric - The metric name to filter by (optional)
     */
    // Map metric keys to datastream name patterns
    // KTUY datastreams use abbreviations: temp, pres, rh, pm25, pm10
    const METRIC_TO_PATTERN = {
        airTemperature: ['temp'],
        relativeHumidity: ['rh'],
        atmosphericPressure: ['pres'],
        pm25: ['pm25', 'pm2.5'],  // Prefer non-calibrated (without _kal)
        pm10: ['pm10'],            // Prefer non-calibrated (without _kal)
        no2: ['no2'],
    };

    /**
     * Find the matching datastream from a list based on metric
     */
    function findMatchingDatastream(datastreams, metric) {
        if (!metric || datastreams.length <= 1) {
            return datastreams[0];
        }

        const patterns = METRIC_TO_PATTERN[metric] || [metric.toLowerCase()];
        
        // First try: exact pattern match (avoid _kal calibrated versions)
        let matched = datastreams.find(ds => {
            const name = ds.name?.toLowerCase() || '';
            return patterns.some(p => name.includes(p) && !name.includes('_kal'));
        });
        
        // Second try: allow calibrated versions if no uncalibrated found
        if (!matched) {
            matched = datastreams.find(ds => {
                const name = ds.name?.toLowerCase() || '';
                return patterns.some(p => name.includes(p));
            });
        }
        
        return matched || datastreams[0];
    }

    /**
     * Fetch datastreams for a Thing WITHOUT observations (fast).
     * Returns the matching datastream based on metric.
     */
    async function getSensorDatastream(thingLink, metric) {
        // First: fetch datastreams WITHOUT observations (fast ~0.5s)
        const params = {
            $expand: "Thing,Sensor",
        };

        const datastreamUrl = `${thingLink}/Datastreams`;

        const { response, error } = await withAsync(
            api.get,
            datastreamUrl,
            {
                params,
                signal: abortController.signal,
            }
        );

        if (error) {
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
            return null;
        }

        const datastreams = response.data.value || [];
        return findMatchingDatastream(datastreams, metric);
    }

    /**
     * Fetch observations for a single datastream
     * Note: KTUY sources are extremely slow with $orderby (8+ seconds), so we skip it for them.
     * FIJI and other sources work fine with $orderby, so we use it to get the most recent data.
     */
    async function getDatastreamObservations(datastreamId, limit = 100) {
        const url = `${VIRTUALAIR_URL}/Datastreams('${datastreamId}')/Observations`;
        
        // KTUY sources are slow with $orderby, others (FIJI, etc.) work fine
        const isKTUY = datastreamId.toString().startsWith('KTUY_');
        
        const params = {
            $top: limit,
            $select: "phenomenonTime,result",
        };
        
        // Use $orderby for non-KTUY sources to get most recent observations
        if (!isKTUY) {
            params.$orderby = "phenomenonTime desc";
        }

        const { response, error } = await withAsync(
            api.get,
            url,
            {
                params,
                signal: abortController.signal,
            }
        );

        if (error) {
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
            return { observations: [], nextLink: null };
        }

        return {
            observations: response.data.value || [],
            nextLink: response.data["@iot.nextLink"] || null,
        };
    }

    async function getOverviewData(datastreamLink, thingLink, metric) {
        //  Create a new AbortController for these requests
        abortController = new AbortController();

        // Step 1: Fetch datastream (without observations) and locations in parallel
        const [datastream, locations] = await Promise.all([
            getSensorDatastream(thingLink, metric),
            getSensorLocations(thingLink)
        ]);

        if (!datastream || !locations) {
            return;
        }

        // Step 2: Fetch observations for ONLY the matching datastream (fast)
        const datastreamId = datastream["@iot.id"];
        const isKTUY = datastreamId.toString().startsWith('KTUY_');
        
        // For KTUY: fetch more in initial request, skip pagination (slow)
        // For FIJI: use pagination (fast)
        const initialLimit = isKTUY ? 200 : 100;
        const { observations, nextLink } = await getDatastreamObservations(datastreamId, initialLimit);
        
        datastream.Observations = observations;

        // Load more observations via nextLink (skip for KTUY - pagination is slow)
        if (!isKTUY) {
            let currentNextLink = nextLink;
            for (let i = 0; i < MAX_OBSERVATION_REQUESTS; i++) {
                if (!currentNextLink) break;

                // Skip nextLinks that point to non-virtualair domains (CORS blocked)
                if (!currentNextLink.includes("api-virtualair.nilu.no")) {
                    console.log("[useSWNPApi] Skipping non-virtualair nextLink:", currentNextLink);
                    break;
                }

                const moreObservations = await getMoreObservations(currentNextLink);

                if (!moreObservations) break;

                currentNextLink = moreObservations?.["@iot.nextLink"];
                datastream.Observations.push(...(moreObservations.value || []));
            }
        }

        // Sort observations by time descending (newest first)
        // This is done client-side because $orderby is extremely slow on KTUY sources
        datastream.Observations.sort((a, b) => 
            new Date(b.phenomenonTime) - new Date(a.phenomenonTime)
        );

        // Filter out -99 sentinel values (means "no data" in meteorological datasets)
        datastream.Observations = filterInvalidObservations(datastream.Observations);

        const oldestTime = getOldestTimeOfLastLocation(locations);
        let lastLocationObservations = datastream.Observations;

        if (oldestTime) {
            const filtered = filterObservationsByTime(oldestTime, datastream.Observations);
            if (filtered.length > 0) {
                lastLocationObservations = filtered;
            }
        }

        const sensorInfo = {
            metric: datastream.name,
            unitOfMeasurement: datastream.unitOfMeasurement?.symbol || "",
            thingId: datastream.Thing?.["@iot.id"] || "",
            thingName: datastream.Thing?.name || "",
            sensorType: datastream.Sensor?.name || "",
            dataOrigin: resolveDataOrigin(datastream),
            license: datastream.License?.name || ""
        };

        // Return the actual datastream link used (for Data Exploration tab)
        const actualDatastreamLink = `${VIRTUALAIR_URL}/Datastreams('${datastreamId}')`;

        return { 
            sensorInfo, 
            observations: lastLocationObservations,
            datastreamLink: actualDatastreamLink
        };
    }

    return {
        getOverviewData,
        abortRequest
    };
}