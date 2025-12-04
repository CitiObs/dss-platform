<script setup>
import { ref, computed, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { FeatureCollection, GiBtn, Scale, createScaleItem, GiScale } from "@geoint/geoint-vue";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import { generateGrid, Extent } from "../helpers/grid";
import { transformExtent } from "ol/proj";
import { Circle, Fill, Stroke, Style } from "ol/style.js";
import { useI18n } from "vue-i18n";

import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import MapFilters from "@/components/MapFilters.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";
import SensorOverviewDialog from "@/components/sensor/SensorOverviewDialog.vue";

const sensorThingsApi = useSensorThingsApi();
const { t } = useI18n();

const mapGrid = ref();
const allThingsByCollection = ref([]);
const sensorMetric = ref(Object.keys(SENSOR_DEFINITIONS)[0]);
const mapRef = ref();
const clusterRef = ref();
const apiCode = ref();
const datastreamLink = ref();
const thingLink = ref();
const isSensorOverviewDialog = ref(false);
const isLoading = ref(false);
const showTooltip = ref(false);
const tooltipPosition = ref({ x: 0, y: 0 });
const tooltipContent = ref("");

const occupiedHeight = STYLES_CONFIG.header_height + STYLES_CONFIG.footer_height;

let pendingRequests = 0;

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
    const sensorDef = SENSOR_DEFINITIONS[sensorMetric.value];
    if (!sensorDef.scale) return null;

    // Recreate the scale to pick up new translations
    const scaleItems = sensorDef.scale._items.map(item => {
        // Update common case labels dynamically for translation
        if (item._definition === "[-99999,-999999]") {
            let label = item._attributes.label;
            if (item._attributes.color === "#8a8888") {
                label = t("sensor.oldData");
            } else if (item._attributes.color === "#000000") {
                label = t("sensor.noData");
            } else if (item._attributes.color === "#00000000") {
                label = ""; // Empty label remains empty
            }
            return createScaleItem(item._definition, {
                color: item._attributes.color,
                label: label
            });
        }
        // Return other items as-is
        return item;
    });

    return new Scale(scaleItems);
});

const currentSensorLabelWithUnit = computed(() => {
    const label = SENSOR_DEFINITIONS[sensorMetric.value]?.label() || sensorMetric.value;
    const unit = SENSOR_DEFINITIONS[sensorMetric.value]?.unit || "";
    return `${label} ${unit ? `(${unit})` : ""}`;
});

function hasObservationData(feature) {
    const observations = feature.get("Observations");
    return observations !== null && observations !== undefined;
}

function thingsRawStyle(feature) {
    const observations = feature.get("Observations");

    if (!observations) {
        return new Style({
            image: new Circle({
                fill: new Fill({ color: "#00000000" }),
                stroke: new Stroke({ color: "#555", width: 2 }),
                radius: 10,
            }),
        });
    }

    const date = new Date(observations.phenomenonTime);
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    if (date < fiveDaysAgo) {
        return new Style({
            image: new Circle({
                fill: new Fill({ color: "#8a8888" }),
                stroke: new Stroke({ color: "#555", width: 2 }),
                radius: 10,
            }),
        });
    }

    let color = "#30c050"; // Default color if no scale is defined

    if (scale.value) {
        const matchingItem = scale.value.getAttributes(observations.result);
        if (matchingItem) {
            color = matchingItem.color;
        }
    }

    return new Style({
        image: new Circle({
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "#555", width: 2 }),
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
    const featuresAtPixel = mapRef.value.map.getFeaturesAtPixel(event.pixel);

    if (!featuresAtPixel.length) return;

    const feature = featuresAtPixel[0];
    const hasData = hasObservationData(feature);

    // Only open dialog if the sensor has data
    if (!hasData) return;

    const clickedThings = getFeatureProperties(event);

    apiCode.value = "SWNP";
    datastreamLink.value = clickedThings[0].datastreamSelfLink;
    thingLink.value = clickedThings[0].selfLink;
    isSensorOverviewDialog.value = true;
}

/**
 * Handles pointer movement on the map and updates the hover behavior for individual sensors.
 *
 * - Detects whether the pointer is currently over an individual (non-aggregated) sensor feature.
 * - Shows a tooltip displaying the sensor ID (and "No data" when applicable).
 * - Changes the cursor to a pointer only for sensors with observation data.
 * - Resets tooltip and cursor state when no features are hovered.
 *
 * @param {Object} event - The OpenLayers pointer event containing pixel coordinates.
 */
function handleMapPointerMove(event) {
    // Get all layers from the map
    const layers = mapRef.value.map.getLayers().getArray();

    // Find the vector layer used for individual (non-aggregated) sensors
    const individualSensorsLayer = layers[3];

    // Restrict hit detection to that layer only
    const featuresAtPixel = mapRef.value.map.getFeaturesAtPixel(event.pixel, {
        layerFilter: (layer) => layer === individualSensorsLayer
    });

    if (featuresAtPixel.length > 0) {
        const feature = featuresAtPixel[0];
        const hasData = hasObservationData(feature);
        const sensorId = feature.get("id") || t("sensor.unknown");

        showTooltip.value = true;
        tooltipPosition.value = {
            x: event.pixel[0],
            y: event.pixel[1]
        };

        if (hasData) {
            // Has data - show pointer cursor and sensorId
            mapRef.value.map.getTargetElement().style.cursor = "pointer";
            tooltipContent.value = sensorId;
        } else {
            // No data - show default cursor and sensorId: No data
            mapRef.value.map.getTargetElement().style.cursor = "default";
            tooltipContent.value = `${sensorId}: ${t("sensor.noData")}`;
        }
    } else {
        // No features - reset everything
        mapRef.value.map.getTargetElement().style.cursor = "";
        showTooltip.value = false;
        tooltipContent.value = "";
    }
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
    pendingRequests++;
    isLoading.value = true;
    allThingsByCollection.value = [];

    try {
        for (const cell of mapGrid.value) {
            const features = await sensorThingsApi.getThings(sensorMetric.value, cell);

            if (!features) continue;

            allThingsByCollection.value.push(features);
        }

        // For simple (non-grouped) Things, retrieve the corresponding Datastream ID
        // based on the selected metric. Then, fetch their latest observations so that
        // their map markers can be updated with the appropriate color.
        allThingsByCollection.value.forEach(collection => {
            if (collection.size() && collection.first("type") !== "count") {
                collection.all().forEach(async (feature) => {
                    const metric = SENSOR_DEFINITIONS[sensorMetric.value].link;
                    const datastream = feature.get("datastreams").find(
                        datastream => datastream.ObservedProperty.definition === metric
                    );
                    const datastreamId = datastream["@iot.id"];
                    const data = await sensorThingsApi.getSimpleThingData(datastreamId);
                    feature.set("Observations", data);
                });
            }
        });
    } finally {
        pendingRequests--;
        if (pendingRequests === 0){
            isLoading.value = false;
        }
    }
}

async function onMapViewChanged() {
    setMapGrid();
    await fetchAllThings();
}

function zoomIn() {
    const view = mapRef.value.map.getView();
    const zoom = view.getZoom();
    view.animate({ zoom: zoom + 1, duration: 250 });
}

function zoomOut() {
    const view = mapRef.value.map.getView();
    const zoom = view.getZoom();
    view.animate({ zoom: zoom - 1, duration: 250 });
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
        <div style="height: 4px;">
            <v-progress-linear
                v-if="isLoading"
                color="secondary"
                indeterminate
            />
        </div>

        <template #drawer>
            <LayersDrawer class="pa-5">
                <MapFilters v-model:sensor-metric="sensorMetric" />
                <v-card variant="tonal">
                    <v-card-text>
                        <h2 class="mb-5 gi-text-h6 gi-font-weight-regular">
                            {{ currentSensorLabelWithUnit }}
                        </h2>
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

        <div
            class="map-container text-center text-h1"
            style="position: relative;"
        >
            <ol-map
                ref="mapRef"
                :controls="[]"
                :style="mapSize"
                @click="handleMapClick"
                @moveend="onMapViewChanged"
                @pointermove="handleMapPointerMove"
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

            <!-- Custom Zoom Controls -->
            <div class="custom-zoom-controls d-flex flex-column ga-1 ">
                <GiBtn
                    icon="mdi-plus"
                    class="gi-primary"
                    @click="zoomIn"
                />
                <GiBtn
                    icon="mdi-minus"
                    class="gi-primary"
                    @click="zoomOut"
                />
            </div>

            <!-- Tooltip for all sensors -->
            <v-tooltip
                v-model="showTooltip"
                class="sensor-tooltip"
                :style="{
                    left: tooltipPosition.x + 'px',
                    top: tooltipPosition.y + 'px'
                }"
                location="top"
            >
                <template #activator="{ props }">
                    <div
                        v-bind="props"
                        class="tooltip-activator"
                        :style="{
                            left: tooltipPosition.x + 'px',
                            top: tooltipPosition.y + 'px'
                        }"
                    ></div>
                </template>
                <span>{{ tooltipContent }}</span>
            </v-tooltip>
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

<style scoped>
.map-container {
  position: relative;
}

.custom-zoom-controls {
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
}

.sensor-tooltip {
  position: absolute;
  pointer-events: none;
}

.tooltip-activator {
  position: absolute;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
::v-deep(.gi-scale-item__color) {
  width: 24px;
}

::v-deep(.gi-scale-item__label) {
  margin-left: 24px;
}

:deep(.gi-scale-item__marker) {
    display: none !important;
}
</style>
