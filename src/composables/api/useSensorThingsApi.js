import { inject } from "vue";
import { GeoJSON } from "ol/format";
import { withAsync, FeatureCollection } from "@geoint/geoint-vue";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";
import { useSensorStore } from "@/stores/sensorStore.js";
import cloneDeep from "lodash-es/cloneDeep";

const BASE_URLS = [
    // "https://api-samenmeten.rivm.nl/v1.0/",
    "https://citiobs.demo.secure-dimensions.de/staplustest/v1.1",
    // "https://nsdpstaplus.nilu.no/FROST-Server/v1.1",
    // "https://api-virtualair.nilu.no/v1.1/",
];

const MAX_ITEMS = 20;

let abortController = null;

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function thingsToGeoJSON (things, projection) {
    const plainFeatures = {
        type: "FeatureCollection",
        features: [],
    };

    for (const thing of things) {
        const locationData = thing.Locations[0]?.location;
        if (!locationData) continue;

        const geometry = cloneDeep(locationData);
        geometry.type = capitalize(geometry.type);

        const properties = {
            ...cloneDeep(thing.properties), // Clone original properties
            id: thing["@iot.id"],
            selfLink: thing["@iot.selfLink"],
            datastreamSelfLink: thing.Datastreams[0]?.["@iot.selfLink"],
            observationsNavigationLink: thing.Datastreams[0]?.["Observations@iot.navigationLink"],
            name: thing.name,
            description: thing.description,
            datastreams: thing.Datastreams
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

async function fetchThingsFromAllApis (params, api) {
    if (abortController) {
        abortController.abort();
    }

    // const getThings = async (metric, cell) => {
    //     if (abortController) {
    //         abortController.abort();
    //     }

    //     abortController = new AbortController();
    // abortController = new AbortController();

    const requests = BASE_URLS.map(async (url) => {
        const { response, error } = await withAsync(api.get, `${url}/Things`, {
            params,
            signal: abortController.signal,
        });

        if (error) {
            // Only log unexpected errors
            if (error.code !== "ERR_CANCELED") {
                console.error(error);
            }
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

    const getThingCollections = async (metric, cell) => {
        // stats.startTime = new Date().getTime();
        // stats.totalRequests = 0;

        let allCollections = [];

        // for (const cell of grid) {
        let collection = new FeatureCollection();
        let totalItems = 0;
        let areMoreItemsToFetch = false;

        // const requests = BASE_URLS.map(async (url) => {
        //     const { response, error } = await withAsync(api.get, `${url}/Things`, {
        //         params: {
        //             $expand: `Datastreams($select=@iot.selfLink;$filter=ObservedProperty/definition eq '${SENSOR_DEFINITIONS[metric].link}';$expand=ObservedProperty($select=definition),Observations($top=1;$orderby=phenomenonTime desc;$select=phenomenonTime,result),Thing($select=@iot.id),Sensor($select=@iot.id)), Locations($select=location)`,
        //             $filter: `st_within(Locations/location, geography'${polygon}')`,
        //             $count: true,
        //             $top: MAX_ITEMS,
        //         },
        //         signal: abortController.signal,

        const polygon = cell.toWKT();
        const params = {
            $expand: `Datastreams($select=@iot.selfLink;$filter=ObservedProperty/definition eq '${SENSOR_DEFINITIONS[metric].link}';$expand=ObservedProperty($select=definition),Observations($top=1;$orderby=phenomenonTime desc;$select=phenomenonTime,result),Thing($select=@iot.id),Sensor($select=@iot.id)), Locations($select=location)`,
            $filter: `st_within(Locations/location, geography'${polygon}')`,
            $count: true,
            $top: MAX_ITEMS,
        };

        const paramsKey = JSON.stringify(params);
        const storedSensorData = sensorStore.getSensorData(paramsKey);

        if (storedSensorData) {
            storedSensorData.things.all().forEach(feature => {
                collection.push(feature);
            });

            allCollections.push(collection);
            // continue;
            return allCollections;
        }

        const thingsFromAllApis = await fetchThingsFromAllApis(params, api);

        thingsFromAllApis.forEach(responseData => {
            if (!responseData) return;

            if (responseData["@iot.count"] > MAX_ITEMS) {
                totalItems += responseData["@iot.count"];
                areMoreItemsToFetch = true;
                return;
            }

            for (const feature of thingsToGeoJSON(responseData.value, projection)) {
                collection._features.push(feature);
            }
        });

        if (areMoreItemsToFetch) {
            collection = new FeatureCollection(cell.getCenter().toFeatures());
            collection.attachProperties(
                {},
                {
                    type: "count",
                    count: totalItems,
                }
            );
        }

        allCollections.push(collection);
        sensorStore.setSensorData(paramsKey, collection, new Date());
        // }

        // return collection;
        // stats.totalTime = (new Date().getTime() - stats.startTime) / 1000;
        return allCollections;
    };

    return {
        getThingCollections,
    };
}
