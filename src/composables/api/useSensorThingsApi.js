import { inject } from "vue";
import { GeoJSON } from "ol/format";
import { withAsync, FeatureCollection } from "@geoint/geoint-vue";
// import merge from "lodash-es/merge";
import cloneDeep from "lodash-es/cloneDeep";

const MAX_PAGES = 150;

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function useSensorThingsApi(projection = "EPSG:3857") {
    const geoint = inject("geoint");

    const foisToGeoJSON = (fois) => {
        const plainFeatures = {
            type: "FeatureCollection",
            features: [],
        };

        for (const foi of fois) {
            const isFeatureObject = foi.feature.type === "Feature";
            const geometry = isFeatureObject ? cloneDeep(foi.feature.geometry) : cloneDeep(foi.feature);

            geometry.type = capitalize(geometry.type);

            const properties = {
                ...cloneDeep(foi.properties), // Clone original properties
                id: foi["@iot.id"],
                selfLink: foi["@iot.selfLink"],
                observationsNavigationLink: foi["Observations@iot.navigationLink"],
                name: foi.name,
                description: foi.description,
                encodingType: foi.encodingType,
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
    };

    const getFOIs = async (collection, stats) => {
        stats.startTime = new Date().getTime();
        stats.totalRequests = 0;

        let page = 1;
        const api = geoint.api("virtualair");

        const { response, error } = await withAsync(api.get, "https://api-virtualair.nilu.no/v1.1/FeaturesOfInterest");
        stats.totalRequests++;

        if (error) {
            console.error(error);
            return;
        }

        let data = response.data;
        for (const feature of foisToGeoJSON(data.value)) {
            collection._features.push(feature);
        }

        while (data["@iot.nextLink"]) {
            const { response, error } = await withAsync(api.get, data["@iot.nextLink"]);
            stats.totalRequests++;
            stats.totalTime = (new Date().getTime() - stats.startTime) / 1000;

            if (error) {
                console.error(error);
            } else {
                data = response.data;
                for (const feature of foisToGeoJSON(data.value)) {
                    collection._features.push(feature);
                }
            }

            page++;
            if (page >= MAX_PAGES) {
                console.log("Max pages reached");
                break;
            }
        }

        stats.totalTime = (new Date().getTime() - stats.startTime) / 1000;
    };

    /**
     * Get ol/Features from a WFS server either as a FeatureCollection or
     * a simple array. (The default option is the FeatureCollection).
     * @param {*} layer The name of the required layer (GeoServer terminology) or the typeName in WFS terminology.
     * @param {*} wfsParams Extra WFS params required for this request e.g. cql_filter, sortby, count.
     * @param {*} asCollection Select if the features will be returned in a simple array or a FeatureCollection.
     * @returns The response promise.
     */
    // const getFeatures = (layer, wfsParams, asCollection = true) => {
    //     const params = merge(
    //         {
    //             service: "wfs",
    //             version: "2.0.0",
    //             request: "GetFeature",
    //             outputformat: "json",
    //             typeNames: layer,
    //         },
    //         wfsParams
    //     );

    //     return geoint.api("wfs").get("", {
    //         params,
    //         transformResponse: (response) => {
    //             try {
    //                 const features = new GeoJSON().readFeatures(response, { featureProjection: projection });
    //                 if (asCollection) {
    //                     return new FeatureCollection(features);
    //                 } else {
    //                     return features;
    //                 }
    //             } catch (error) {
    //                 // Failed to parse the response as GeoJSON
    //                 return response;
    //             }
    //         },
    //     });
    // };

    return {
        getFOIs,
    };
}
