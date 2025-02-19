<script setup>
import { ref, computed } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { FeatureCollection, GiBtn } from "@geoint/geoint-vue";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi";
import { useSensorStore } from "@/stores/sensorStore.js";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import { generateGrid, Extent } from "../helpers/grid";
import { transformExtent } from "ol/proj";
import {Circle, Fill, Stroke, Style} from "ol/style.js";

import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";
import SensorOverviewDialog from "@/components/sensor/SensorOverviewDialog.vue";

const sensorThingsApi = useSensorThingsApi();
const sensorStore = useSensorStore();
const occupiedHeight = STYLES_CONFIG.header_height + STYLES_CONFIG.footer_height;

const gridFeatures = ref(new FeatureCollection());
const thingsRaw = ref(new FeatureCollection());
const thingsAggregated = ref(new FeatureCollection());
const stats = ref({});
const mapRef = ref();
const clusterRef = ref();
const apiCode = ref();
const datastreamLink = ref();
const thingLink = ref();
const isSensorOverviewDialog = ref(false);

const mapSize = computed(() => {
    return {
        width: "100%",
        height: `calc(100vh - ${occupiedHeight}px)`,
    };
});

function getFeatureProperties (event) {
    const featuresAtPixel = mapRef.value.map.getFeaturesAtPixel(event.pixel);
    const featureProperties = featuresAtPixel.map(feature => feature.getProperties());

    return featureProperties;
}

function handleMapClick (event) {
    const clickedThings = getFeatureProperties(event);

    if (!clickedThings.length) return;

    apiCode.value = "SWNP";
    datastreamLink.value = clickedThings[0].datastreamSelfLink;
    thingLink.value = clickedThings[0].selfLink;
    isSensorOverviewDialog.value = true;
}

function clearCache() {
    sensorStore.clearSensorData();
    window.location.reload();
}

async function onMapViewChanged() {
    const view = mapRef.value.map.getView();
    const zoom = view.getZoom();
    const extent3857 = view.calculateExtent();
    const extent4326 = transformExtent(extent3857, "EPSG:3857", "EPSG:4326");

    const viewExtent = new Extent(
        extent4326[0],
        extent4326[3],
        extent4326[2],
        extent4326[1]
    );
    const grid = generateGrid(viewExtent, zoom);
    const features = new FeatureCollection(grid.toFeatures());
    gridFeatures.value = features;

    thingsAggregated.value = new FeatureCollection();
    thingsRaw.value = new FeatureCollection();

    for (const cell of grid) {
        const features = await sensorThingsApi.getThings(stats.value, cell);

        if (features.size() == 1 && features.first("count")) {
            thingsAggregated.value.push(features.first());
        } else {
            features.all().forEach(feature => {
                thingsRaw.value.push(feature);
            });
        }
    }

    console.log("all agr", thingsAggregated.value.pluck(["count"]));
}

function thingsRawStyle(feature, style) {
    const fill1 = new Fill({
        color: "#555",
    });

    const stroke1 = new Stroke({
        color: "#555",
        width: 1,
    });

    const fill2 = new Fill({
        color: "#f00",
    });

    const stroke2 = new Stroke({
        color: "#f00",
        width: 1,
    });   

    if (feature.get("datastreams").length == 0) {
        return new Style({
            image: new Circle({
                fill: fill1,
                stroke: stroke1,
                radius: 10,
            })
        });        
    } else {
        return new Style({
            image: new Circle({
                fill: fill2,
                stroke: stroke2,
                radius: 10,
            })
        });
    }
}

function thingsAggregatedStyle(feature, style) {
    style.getText().setText(feature.get("count").toString());
    return style;
}

onBeforeRouteLeave(() => {
    const vectorSource = clusterRef.value.source.getSource();
    vectorSource.clear(true);
});

</script>

<template>
    <LayoutMap>
        <template #drawer>
            <LayersDrawer class="pa-5">
                Total items: {{ thingsAggregated.size() + thingsRaw.size() }} <br />
                Total request: {{ stats.totalRequests }} <br />
                Total time: {{ Math.round(stats.totalTime) }} sec<br />
                <GiBtn
                    class="mt-5"
                    size="small"
                    variant="outlined"
                    @click="clearCache"
                >
                    Clear Cache
                </GiBtn>
            </LayersDrawer>
        </template>

        <div class="text-center text-h1">
            <ol-map
                ref="mapRef"
                :controls="[]"
                :style="mapSize"
                @click="handleMapClick"
                @moveend="onMapViewChanged"
            >
                <ol-view
                    :center="[0, 5000000]"
                    :zoom="3"
                />

                <ol-tile-layer>
                    <ol-source-osm />
                </ol-tile-layer>

                <ol-vector-layer>
                    <ol-source-vector :features="gridFeatures.all()" />
                    <ol-style>
                        <ol-style-stroke
                            color="#abc"
                            :width="1"
                        />
                    </ol-style>
                </ol-vector-layer>

                <ol-vector-layer>
                    <ol-source-vector :features="thingsAggregated.all()" />
                    <ol-style :override-style-function="thingsAggregatedStyle">
                        <ol-style-circle radius="20">
                            <ol-style-fill color="#70d4d0" />
                            <ol-style-stroke
                                color="#70d4d0"
                                width="1"
                            />
                        </ol-style-circle>
                        <ol-style-text
                            text="10"
                            font="16px sans-serif"
                            fill="#000"
                        />
                    </ol-style>
                </ol-vector-layer>

                <ol-vector-layer>
                    <ol-source-vector :features="thingsRaw.all()" />
                    <ol-style :override-style-function="thingsRawStyle">
                        <ol-style-circle radius="10">
                            <ol-style-fill color="#008480" />
                            <ol-style-stroke
                                color="#008480"
                                width="1"
                            />
                        </ol-style-circle>
                    </ol-style>
                </ol-vector-layer>
            </ol-map>
        </div>

        <SensorOverviewDialog
            v-model="isSensorOverviewDialog"
            :api-code="apiCode"
            :datastream-link="datastreamLink"
            :thing-link="thingLink"
        />
    </LayoutMap>
</template>
