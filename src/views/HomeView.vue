<script setup>
import { ref, computed, onMounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { FeatureCollection, useGiColor, GiBtn } from "@geoint/geoint-vue";
import { useSensorThingsApi, MAX_PAGES } from "@/composables/api/useSensorThingsApi";
import { useSensorStore } from "@/stores/sensorStore.js";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";

import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";
import SensorOverviewDialog from "@/components/sensor/SensorOverviewDialog.vue";
import BaseDialog from "@/components/base/BaseDialog.vue";

import { generateGrid, Extent } from "../helpers/grid";
import { transformExtent } from "ol/proj";
import {Circle, Fill, Stroke, Style} from "ol/style.js";

const { getColor } = useGiColor();
const sensorThingsApi = useSensorThingsApi();
const sensorStore = useSensorStore();
const occupiedHeight = STYLES_CONFIG.header_height + STYLES_CONFIG.footer_height;

const gridFeatures = ref(new FeatureCollection());
const thingsRaw = ref(new FeatureCollection());
const thingsAggregated = ref(new FeatureCollection());
const fois = ref(new FeatureCollection());
const stats = ref({});
const mapRef = ref();
const clusterRef = ref();
const apiCode = ref();
const observationsLink = ref();
const isSensorOverviewDialog = ref(false);
const isInitialLoading = ref(false);

const loadingProgress = computed(() => {
    if (!stats.value.totalRequests) return "";
    return Math.min(Math.trunc((stats.value.totalRequests / MAX_PAGES) * 100), 100);
});

const mapSize = computed(() => {
    return {
        width: "100%",
        height: `calc(100vh - ${occupiedHeight}px)`,
    };
});

function getFeatures (event) {
    const featuresAtPixel = mapRef.value.map.getFeaturesAtPixel(event.pixel);
    const features = featuresAtPixel.map(feature => feature.getProperties());

    return features;
}

function handleMapClick (event) {
    isSensorOverviewDialog.value = true;
    const clusteredFeatures = getFeatures(event);

    if (!clusteredFeatures.length) {
        apiCode.value = "";
        observationsLink.value = "";
        return;
    }

    const feature = clusteredFeatures[0];
    // apiCode.value = feature.get("id").substring(0, 4);
    apiCode.value = "SWNP";
    observationsLink.value = feature.datastreamSelfLink;
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

onMounted(async () => {
    // const cached = sensorStore.getSensorData();

    // if (cached.size()) {
    //     fois.value = cached;
    //     return;
    // }

    // isInitialLoading.value = true;
    // await sensorThingsApi.getFOIs(fois.value, stats.value);
    // sensorStore.setSensorData(fois.value);
    // isInitialLoading.value = false;
});

onBeforeRouteLeave(() => {
    const vectorSource = clusterRef.value.source.getSource();
    vectorSource.clear(true);
});

</script>

<template>
    <LayoutMap>
        <template #drawer>
            <LayersDrawer class="pa-5">
                Total items: {{ fois.size() }} <br />
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
            :observations-link="observationsLink"
        />

        <BaseDialog
            v-model="isInitialLoading"
            :title="$t('home.welcomeToCitiobs')"
            :max-width="800"
            :can-close="false"
            persistent
        >
            <p class="text-center mb-4">
                {{ $t("home.loadingMapData") }}
            </p>

            <v-progress-linear
                v-model="loadingProgress"
                :color="getColor('primary-300')"
                height="25"
                class="rounded"
            >
                <strong>{{ `${loadingProgress}%` }}</strong>
            </v-progress-linear>
        </BaseDialog>
    </LayoutMap>
</template>
