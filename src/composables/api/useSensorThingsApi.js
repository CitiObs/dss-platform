import { inject } from "vue";
import { GeoJSON } from "ol/format";
import { withAsync, FeatureCollection } from "@geoint/geoint-vue";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";
import { useSensorStore } from "@/stores/sensorStore.js";
import cloneDeep from "lodash-es/cloneDeep";

const BASE_URLS = [
    // "https://api-samenmeten.rivm.nl/v1.0/",
    // "https://citiobs.demo.secure-dimensions.de/staplustest/v1.1",
    // "https://nsdpstaplus.nilu.no/FROST-Server/v1.1",
    "https://api-virtualair.nilu.no/v1.1/",
];

// Maximum sensors per grid cell before falling back to a cluster count.
// Higher = more individual markers, but more observation requests per cell.
const MAX_ITEMS = 200;

// In-memory observation cache to avoid repeated per-datastream requests
const observationCache = new Map();
const OBSERVATION_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
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
        const matchingDs = thing.Datastreams?.find(
            ds => ds.ObservedProperty?.definition === metricLink
        ) || thing.Datastreams?.[0];

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

        const url = "https://api-virtualair.nilu.no/v1.1/";

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
     * Get the first (earliest) observation from a datastream
     * @param {string} datastreamLink - The full datastream link or datastream ID
     * @returns {Promise<Object|null>} The first observation with phenomenonTime and result
     */
    const getFirstObservation = async (datastreamLink) => {
        if (!datastreamLink) {
            console.error("datastreamLink is required");
            return null;
        }

        const params = {
            $top: 1,
            $select: "phenomenonTime,result",
            $orderby: "phenomenonTime asc",
        };

        const url = `${datastreamLink}/Observations`;

        const { response, error } = await withAsync(api.get, url, {
            params,
            headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
        });

        if (error) {
            console.error("Error fetching first observation:", error);
            return null;
        }

        return response.data.value?.[0] || null;
    };

    /**
     * Get the last (latest) observation from a datastream
     * @param {string} datastreamLink - The full datastream link or datastream ID
     * @returns {Promise<Object|null>} The last observation with phenomenonTime and result
     */
    const getLastObservation = async (datastreamLink) => {
        if (!datastreamLink) {
            console.error("datastreamLink is required");
            return null;
        }

        const params = {
            $top: 1,
            $select: "phenomenonTime,result",
            $orderby: "phenomenonTime desc",
        };

        const url = `${datastreamLink}/Observations`;

        const { response, error } = await withAsync(api.get, url, {
            params,
            headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
        });

        if (error) {
            console.error("Error fetching last observation:", error);
            return null;
        }

        return response.data.value?.[0] || null;
    };

    /**
     * Get both first and last observations in parallel
     * @param {string} datastreamLink - The full datastream link or datastream ID
     * @returns {Promise<{first: Object|null, last: Object|null}>}
     */
    const getFirstAndLastObservations = async (datastreamLink) => {
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

        const startISO = new Date(startDate).toISOString();
        const endISO = new Date(endDate).toISOString();

        const params = {
            $orderby: "phenomenonTime asc",
            $select: "phenomenonTime,result",
            $filter: `phenomenonTime ge ${startISO} and phenomenonTime le ${endISO}`,
        };

        const url = `${datastreamLink}/Observations`;

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

        return response.data.value || [];
    };

    /**
     * Fetches ALL sensors for a metric using the 2-step approach:
     * Step 1: Light fetch with $skip pagination (gets all Things)
     * Step 2: Batch-fetch latest observation per datastream
     *
     * Returns an object: { features: OL Feature[], totalLoaded: number }
     * Calls onProgress(features) after Step 1 so the map can render immediately.
     */
    const getAllThings = async (metric, { onProgress } = {}) => {
        const metricLink = SENSOR_DEFINITIONS[metric].link;

        // Step 1: Light fetch — flat expand (Peter's recommended format)
        // Uses $skip pagination with fixed increments of $top
        const PAGE_SIZE = 500;
        const lightParams = {
            $expand: `Datastreams/ObservedProperty($select=definition),Locations($select=location)`,
            $filter: `Datastreams/ObservedProperty/definition eq '${metricLink}'`,
            $top: PAGE_SIZE,
        };

        let allThings = [];

        for (const baseUrl of BASE_URLS) {
            let skip = 0;

            while (true) {
                const params = { ...lightParams, $skip: skip };
                const { response, error } = await withAsync(api.get, `${baseUrl}/Things`, { params });

                if (error) {
                    console.error(error);
                    break;
                }

                const data = response.data;
                if (!data.value || data.value.length === 0) break;

                allThings = allThings.concat(data.value);

                // Use @iot.nextLink to detect if more pages exist
                // (the API may return fewer items than $top due to server limits)
                if (!data["@iot.nextLink"]) break;

                skip += PAGE_SIZE;
            }
        }

        // Deduplicate by @iot.id
        const ids = allThings.map(t => t["@iot.id"]);
        const uniqueIds = new Set(ids);

        const features = thingsToGeoJSON(allThings, projection, metricLink);

        // Notify caller so map can render markers immediately (without colors)
        if (onProgress) onProgress(features);

        // Step 2: Batch-fetch latest observation per datastream
        const CONCURRENCY = 15;
        const queue = [];
        let noMatchingDs = 0;

        for (const feature of features) {
            const datastreams = feature.get("datastreams");
            const ds = datastreams?.find(d => d.ObservedProperty?.definition === metricLink);
            if (!ds) {
                noMatchingDs++;
                continue;
            }

            queue.push({ feature, datastreamId: ds["@iot.id"] });
        }


        // Process observation requests with concurrency limit
        let idx = 0;
        let obsFound = 0;
        let obsMissing = 0;
        async function processNext() {
            while (idx < queue.length) {
                const { feature, datastreamId } = queue[idx++];
                const obs = await getSimpleThingData(datastreamId);
                if (obs) {
                    obsFound++;
                    feature.set("Observations", obs);
                } else {
                    obsMissing++;
                }
            }
        }

        const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => processNext());
        await Promise.all(workers);


        return features;
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
