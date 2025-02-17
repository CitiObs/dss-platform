import { inject } from "vue";
import { GeoJSON } from "ol/format";
import { withAsync, FeatureCollection } from "@geoint/geoint-vue";
import cloneDeep from "lodash-es/cloneDeep";

const BASE_URLS = [
    // "https://api-samenmeten.rivm.nl/v1.0/",
    "https://citiobs.demo.secure-dimensions.de/staplustest/v1.1",
    // "https://nsdpstaplus.nilu.no/FROST-Server/v1.1",
    // "https://api-virtualair.nilu.no/v1.1/",
];

const MAX_ITEMS = 20;

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

export function useSensorThingsApi(projection = "EPSG:3857") {
    const geoint = inject("geoint");
    let abortController = null;

    const getThings = async (stats, cell) => {
        if (abortController) {
            abortController.abort();
        }

        abortController = new AbortController();
        stats.startTime = new Date().getTime();
        stats.totalRequests = 0;

        const api = geoint.api("virtualair");
        const polygon = cell.toWKT();

        let collection = new FeatureCollection();
        let areMoreItemsToFetch = false;
        let totalItems = 0;

        const requests = BASE_URLS.map(async (url) => {
            const { response, error } = await withAsync(api.get, `${url}/Things`, {
                params: {
                    $expand: "Datastreams($select=@iot.selfLink;$filter=ObservedProperty/definition eq 'http://vocabs.lter-europe.net/EnvThes/22035';$expand=ObservedProperty($select=definition),Observations($top=1;$orderby=phenomenonTime desc;$select=phenomenonTime,result),Thing($select=@iot.id),Sensor($select=@iot.id)), Locations($select=location)",
                    $filter: `st_within(Locations/location, geography'${polygon}')`,
                    $count: true,
                    $top: MAX_ITEMS,
                },
                signal: abortController.signal,
            });
            stats.totalRequests++;

            if (error) {
                // Only log unexpected errors
                if (error.code !== "ERR_CANCELED") {
                    console.error(error);
                }
                return;
            }

            if (response.data["@iot.count"] > MAX_ITEMS) {
                totalItems += response.data["@iot.count"];
                areMoreItemsToFetch = true;
                return;
            }

            for (const feature of thingsToGeoJSON(response.data.value, projection)) {
                collection._features.push(feature);
            }
        });

        await Promise.all(requests);

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

        stats.totalTime = (new Date().getTime() - stats.startTime) / 1000;
        return collection;
    };

    return {
        getThings,
    };
}
