<script setup>
import { ref, computed, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { FeatureCollection } from "@geoint/geoint-vue";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import { generateGrid, Extent } from "../helpers/grid";
import { transformExtent } from "ol/proj";
import { Circle, Fill, Stroke, Style } from "ol/style.js";

import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import MapFilters from "@/components/MapFilters.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";
import SensorOverviewDialog from "@/components/sensor/SensorOverviewDialog.vue";
import GiScale from "@geoint/geoint-vue/src/components/geoint/scale/GiScale.vue";

const sensorThingsApi = useSensorThingsApi();

const mapGrid = ref();
const allThingsByCollection = ref([]);
const sensorMetric = ref(Object.keys(SENSOR_DEFINITIONS)[0]);
const mapRef = ref();
const clusterRef = ref();
const apiCode = ref();
const datastreamLink = ref();
const thingLink = ref();
const isSensorOverviewDialog = ref(false);

const occupiedHeight = STYLES_CONFIG.header_height + STYLES_CONFIG.footer_height;

const mapSize = computed(() => {
    return {
        width: "100%",
        height: `calc(100vh - ${occupiedHeight}px)`,
    };
});

const gridFeatures = computed(() => {
    if (!mapGrid.value) return new FeatureCollection();

    return new FeatureCollection(mapGrid.value.toFeatures());
});

const thingsAggregated = computed(() => {
    const things = new FeatureCollection();

    allThingsByCollection.value.forEach(features => {
        if (features.size() == 1 && features.first("count")) {
            things.push(features.first());
        }
    });

    return things;
});

const thingsRaw = computed(() => {
    const things = new FeatureCollection();

    allThingsByCollection.value.forEach(features => {
        if (!features.first("count")) {
            features.all().forEach(feature => {
                things.push(feature);
            });
        }
    });

    return things;
});

const scale = computed(() => {
    if (SENSOR_DEFINITIONS[sensorMetric.value].scale) {
        return SENSOR_DEFINITIONS[sensorMetric.value].scale;
    }
    return null;
});

function thingsRawStyle(feature) {
    const observations = feature.get("datastreams")?.[0]?.Observations;

    if (!observations?.length) {
        return new Style({
            image: new Circle({
                fill: new Fill({ color: "#555" }),
                stroke: new Stroke({ color: "#555", width: 1 }),
                radius: 10,
            }),
        });
    }

    const date = new Date(observations[0].phenomenonTime);
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    if (date < fiveDaysAgo) {
        return new Style({
            image: new Circle({
                fill: new Fill({ color: "#8a8888" }),
                stroke: new Stroke({ color: "#8a8888", width: 1 }),
                radius: 10,
            }),
        });
    }

    let color = "#30c050"; // Default color if no scale is defined

    if (scale.value) {
        const matchingItem = scale.value.getAttributes(observations[0].result);
        if (matchingItem) {
            color = matchingItem.color;
        }
    }

    return new Style({
        image: new Circle({
            fill: new Fill({ color }),
            stroke: new Stroke({ color, width: 1 }),
            radius: 10,
        }),
    });
}

function thingsAggregatedStyle(feature, style) {
    style.getText().setText(feature.get("count").toString());
    return style;
}

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

function setMapGrid () {
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

    const roundedZoom = Math.round(zoom);
    mapGrid.value = generateGrid(viewExtent, roundedZoom);
}

async function fetchAllThings () {
    allThingsByCollection.value = [];

    for (const cell of mapGrid.value) {
        const features = await sensorThingsApi.getThings(sensorMetric.value, cell);

        if (!features) continue;

        allThingsByCollection.value.push(features);
    }
}

async function onMapViewChanged() {
    setMapGrid();
    await fetchAllThings();
}

watch(sensorMetric, async () => {
    await fetchAllThings();
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
                <MapFilters v-model:sensor-metric="sensorMetric" />
                <v-card variant="tonal">
                    <v-card-text>
                        <GiScale
                            v-if="scale"
                            :scale="scale"
                            value="-9999"
                            vertical
                        />
                    </v-card-text>
                </v-card>
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
                    :extent="[-20000000, -15000000, 20000000, 19000000]"
                    :max-zoom="17"
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
            :sensor-metric="sensorMetric"
        />
    </LayoutMap>
</template>
