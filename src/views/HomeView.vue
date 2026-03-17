<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { FeatureCollection, GiBtn, Scale, createScaleItem, GiScale } from "@geoint/geoint-vue";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi";
import { useAlertStore } from "@/stores/alertStore.js";
import { useAuthStore } from "@/stores/authStore.js";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import { Circle, Fill, Stroke, Style, Text } from "ol/style.js";
import { useI18n } from "vue-i18n";

import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import MapFilters from "@/components/MapFilters.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";
import SensorOverviewDialog from "@/components/sensor/SensorOverviewDialog.vue";

const sensorThingsApi = useSensorThingsApi();
const alertStore = useAlertStore();
const authStore = useAuthStore();
const { t } = useI18n();

const showAlertSnackbar = ref(false);
const alertSnackbarText = ref("");

const allSensorFeatures = ref(new FeatureCollection());
const clusterDistance = ref(60); // pixels — OL cluster distance
let currentMetric = null;
let fetchAbortFlag = 0; // for cancellation

const sensorMetric = ref(Object.keys(SENSOR_DEFINITIONS)[0]);
const activeOnly = ref(false);
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

// --- Co-located sensor picker (revertable) ---
const showSensorPicker = ref(false);
const sensorPickerPosition = ref({ x: 0, y: 0 });
const sensorPickerItems = ref([]);

const occupiedHeight = STYLES_CONFIG.header_height + STYLES_CONFIG.footer_height;

// Stable references for ol-view/ol-map props — inline arrays like [0, 5000000]
// create new references on every parent re-render, which triggers vue3-openlayers'
// properties watcher to re-apply zoom/center via view.applyOptions_(), resetting the view.
const mapControls = [];
const initialCenter = [0, 5000000];
const initialExtent = [-20000000, -15000000, 20000000, 19000000];
const initialZoom = 3;
const maxZoom = 17;

const mapSize = computed(() => {
    return {
        width: "100%",
        height: `calc(100vh - ${occupiedHeight}px)`,
    };
});

// Compute the drawer height so that all content is displayed correctly.
// The "25px" offset harmonizes the drawer height with the footer's height.
const drawerHeight = computed(() => {
    return `calc(100vh - ${occupiedHeight - 25}px)`;
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

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

const displayedFeatures = computed(() => {
    const all = allSensorFeatures.value.all();
    if (!activeOnly.value) return all;
    return all.filter(hasRecentObservationData);
});

function hasObservationData(feature) {
    const observations = feature.get("Observations");
    return observations !== null && observations !== undefined;
}

function hasRecentObservationData(feature) {
    const observations = feature.get("Observations");
    if (!observations) return false;
    const date = new Date(observations.phenomenonTime);
    return date >= new Date(Date.now() - FIVE_DAYS_MS);
}

/**
 * Style function for the OL Cluster layer.
 * Handles both cluster markers (multiple sensors) and individual sensor markers.
 */
function clusterStyle(feature) {
    const subFeatures = feature.get("features");
    if (!subFeatures) return;

    const size = subFeatures.length;

    // Cluster with multiple sensors — show a circle with count label
    if (size > 1) {
        const radius = Math.min(10 + Math.log2(size) * 5, 35);
        return new Style({
            image: new Circle({
                radius: radius,
                fill: new Fill({ color: "#005e5b" }),
                stroke: new Stroke({ color: "#00b6df", width: 3 }),
            }),
            text: new Text({
                text: size.toString(),
                font: "14px sans-serif",
                fill: new Fill({ color: "#e6f3f2" }),
            }),
        });
    }

    // Single sensor — same logic as old thingsRawStyle
    const singleFeature = subFeatures[0];
    const observations = singleFeature.get("Observations");

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

/**
 * Handles pointer movement on the map.
 * Uses the cluster layer ref to filter hit detection to only that layer.
 * - For clusters, shows a tooltip with the count.
 * - For individual sensors, shows the sensor ID (and "no data" state).
 */
function handleMapPointerMove(event) {
    const clusterLayer = clusterRef.value?.vectorLayer;
    if (!clusterLayer) return;

    const featuresAtPixel = mapRef.value.map.getFeaturesAtPixel(event.pixel, {
        layerFilter: (layer) => layer === clusterLayer
    });

    if (featuresAtPixel.length > 0) {
        const clusterFeature = featuresAtPixel[0];
        const subFeatures = clusterFeature.get("features") || [clusterFeature];

        // If it's a cluster with multiple sensors, show count tooltip
        if (subFeatures.length > 1) {
            mapRef.value.map.getTargetElement().style.cursor = "pointer";
            showTooltip.value = true;
            tooltipPosition.value = { x: event.pixel[0], y: event.pixel[1] };
            tooltipContent.value = `${subFeatures.length} sensors`;
            return;
        }

        const feature = subFeatures[0];
        const hasData = hasObservationData(feature);
        const sensorId = feature.get("id") || t("sensor.unknown");

        showTooltip.value = true;
        tooltipPosition.value = {
            x: event.pixel[0],
            y: event.pixel[1]
        };

        if (hasData) {
            // Has data — show pointer cursor and sensor ID
            mapRef.value.map.getTargetElement().style.cursor = "pointer";
            tooltipContent.value = sensorId;
        } else {
            // No data — show default cursor and sensor ID with "no data"
            mapRef.value.map.getTargetElement().style.cursor = "default";
            tooltipContent.value = `${sensorId}: ${t("sensor.noData")}`;
        }
    } else {
        // No features under pointer — reset everything
        mapRef.value.map.getTargetElement().style.cursor = "";
        showTooltip.value = false;
        tooltipContent.value = "";
    }
}

/**
 * Handles click on the map.
 * - For clusters, zooms in to uncluster.
 * - For individual sensors with data, opens the sensor overview dialog.
 */
function handleMapClick(event) {
    // Close sensor picker if open and clicking elsewhere
    showSensorPicker.value = false;

    const clusterLayer = clusterRef.value?.vectorLayer;
    if (!clusterLayer) return;

    const featuresAtPixel = mapRef.value.map.getFeaturesAtPixel(event.pixel, {
        layerFilter: (layer) => layer === clusterLayer
    });

    if (!featuresAtPixel.length) return;

    const clusterFeature = featuresAtPixel[0];
    const subFeatures = clusterFeature.get("features") || [clusterFeature];

    // If cluster, try to zoom in — but if already zoomed in far enough,
    // open the first sensor with data (sensors share the same location)
    if (subFeatures.length > 1) {
        const view = mapRef.value.map.getView();
        const currentZoom = view.getZoom();

        if (currentZoom < maxZoom - 1) {
            // Still room to zoom — try to uncluster
            view.animate({
                center: clusterFeature.getGeometry().getCoordinates(),
                zoom: currentZoom + 2,
                duration: 300,
            });
            return;
        }

        // At max zoom and cluster won't break apart — show sensor picker
        const clickableSensors = subFeatures.filter(f => f.get("datastreamSelfLink"));
        if (!clickableSensors.length) return;

        // Only one clickable sensor — open directly
        if (clickableSensors.length === 1) {
            openSensorDialog(clickableSensors[0]);
            return;
        }

        // Multiple sensors — show picker popup (dialog fetches its own data)
        sensorPickerItems.value = clickableSensors.map(f => ({
            id: f.get("id") || t("sensor.unknown"),
            name: f.get("name") || "",
            hasData: hasObservationData(f),
            datastreamSelfLink: f.get("datastreamSelfLink"),
            selfLink: f.get("selfLink"),
        }));
        sensorPickerPosition.value = { x: event.pixel[0], y: event.pixel[1] };
        showSensorPicker.value = true;
        return;
    }

    // Single sensor — open dialog only if it has observation data
    const feature = subFeatures[0];
    if (!feature.get("datastreamSelfLink") || !hasObservationData(feature)) return;

    openSensorDialog(feature);
}

// --- Co-located sensor picker helpers (revertable) ---
function openSensorDialog(feature) {
    showSensorPicker.value = false;
    apiCode.value = "SWNP";
    datastreamLink.value = feature.get ? feature.get("datastreamSelfLink") : feature.datastreamSelfLink;
    thingLink.value = feature.get ? feature.get("selfLink") : feature.selfLink;
    isSensorOverviewDialog.value = true;
}

function onSensorPicked(sensor) {
    showSensorPicker.value = false;
    apiCode.value = "SWNP";
    datastreamLink.value = sensor.datastreamSelfLink;
    thingLink.value = sensor.selfLink;
    isSensorOverviewDialog.value = true;
}

/**
 * Fetches all sensors for the current metric in a single paginated request.
 * Uses fetchAbortFlag to discard results from superseded requests.
 */
async function loadSensors() {
    const requestId = ++fetchAbortFlag;
    const metric = sensorMetric.value;

    // Skip if same metric already loaded
    if (metric === currentMetric && allSensorFeatures.value.size() > 0) return;

    isLoading.value = true;

    try {
        const features = await sensorThingsApi.getAllThings(metric, {
            // Step 1 done — show markers immediately (no colors yet)
            onProgress: (earlyFeatures) => {
                if (requestId !== fetchAbortFlag) return;
                allSensorFeatures.value = new FeatureCollection(earlyFeatures);
            },
        });

        // Step 2 done — observations loaded, trigger re-render for colors
        if (requestId !== fetchAbortFlag) return;

        currentMetric = metric;
        // Force reactivity update so styles recalculate with observation data
        allSensorFeatures.value = new FeatureCollection(features);

        // Evaluate alert rules against loaded sensor data
        alertStore.clear();
        alertStore.loadRules(authStore.userId);
        const result = alertStore.evaluate(features, metric);
        if (result && result.count > 0) {
            alertSnackbarText.value = t("alerts.newAlerts", { count: result.count, threshold: result.threshold, unit: result.unit }, result.count);
            showAlertSnackbar.value = true;
        }
    } catch (e) {
        console.error("Failed to load sensors:", e);
    } finally {
        if (requestId === fetchAbortFlag) {
            isLoading.value = false;
        }
    }
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

watch(sensorMetric, () => {
    currentMetric = null; // Force reload for new metric
    loadSensors();
});

// Re-evaluate alerts when user logs in/out or rules are added/removed
watch(() => authStore.isAuthenticated, () => {
    alertStore.loadRules(authStore.userId);
    reEvaluateAlerts();
});

watch(() => alertStore.rulesVersion, () => {
    reEvaluateAlerts();
});

function reEvaluateAlerts() {
    if (allSensorFeatures.value.size() === 0) return;
    alertStore.clear();
    const result = alertStore.evaluate(allSensorFeatures.value.all(), sensorMetric.value);
    if (result && result.count > 0) {
        alertSnackbarText.value = t("alerts.newAlerts", { count: result.count, threshold: result.threshold, unit: result.unit }, result.count);
        showAlertSnackbar.value = true;
    }
}

watch(() => alertStore.selectedAlert, (alert) => {
    if (!alert) return;
    if (alert.datastreamSelfLink) {
        apiCode.value = "SWNP";
        datastreamLink.value = alert.datastreamSelfLink;
        thingLink.value = alert.selfLink;
        isSensorOverviewDialog.value = true;
    }
    alertStore.selectedAlert = null;
});

onMounted(() => {
    loadSensors();
});

onBeforeRouteLeave(() => {
    // Clean up is handled automatically by Vue reactivity
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
        <!-- Drawer menu -->
        <template #drawer>
            <LayersDrawer
                class="pa-5"
                :style="{ height: drawerHeight }"
            >
                <MapFilters v-model:sensor-metric="sensorMetric" v-model:active-only="activeOnly" />
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

        <!-- Map -->
        <div
            class="map-container text-center text-h1"
            style="position: relative;"
        >
            <ol-map
                ref="mapRef"
                :controls="mapControls"
                :style="mapSize"
                @click="handleMapClick"
                @pointermove="handleMapPointerMove"
            >
                <ol-view
                    :center="initialCenter"
                    :zoom="initialZoom"
                    :extent="initialExtent"
                    :max-zoom="maxZoom"
                />

                <ol-tile-layer>
                    <ol-source-osm />
                </ol-tile-layer>

                <ol-vector-layer ref="clusterRef">
                    <ol-source-cluster :distance="clusterDistance">
                        <ol-source-vector :features="displayedFeatures" />
                    </ol-source-cluster>
                    <ol-style :override-style-function="clusterStyle" />
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

            <!-- Floating Tooltip for all sensors -->
            <div
                v-if="showTooltip"
                class="sensor-tooltip rounded "
                :style="{
                    left: tooltipPosition.x + 'px',
                    top: tooltipPosition.y + 'px'
                }"
            >
                {{ tooltipContent }}
            </div>

            <!-- Co-located sensor picker popup (revertable) -->
            <v-card
                v-if="showSensorPicker"
                class="sensor-picker rounded-lg elevation-8"
                :style="{
                    left: sensorPickerPosition.x + 'px',
                    top: sensorPickerPosition.y + 'px'
                }"
            >
                <v-card-title class="gi-text-body-1 gi-font-weight-medium pa-3 pb-1">
                    {{ t("sensor.selectSensor") }}
                </v-card-title>
                <v-list
                    density="compact"
                    class="pa-1"
                >
                    <v-list-item
                        v-for="sensor in sensorPickerItems"
                        :key="sensor.id"
                        class="rounded"
                        @click="onSensorPicked(sensor)"
                    >
                        <template #prepend>
                            <v-icon
                                :color="sensor.hasData ? 'success' : 'grey'"
                                size="10"
                            >
                                mdi-circle
                            </v-icon>
                        </template>
                        <v-list-item-title class="gi-text-body-2">
                            {{ sensor.id }}
                        </v-list-item-title>
                        <v-list-item-subtitle
                            v-if="sensor.name"
                            class="gi-text-caption"
                        >
                            {{ sensor.name }}
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>
            </v-card>
        </div>

        <v-snackbar
            v-model="showAlertSnackbar"
            color="warning"
            timeout="5000"
            location="top"
            multi-line
            min-width="auto"
        >
            <v-icon class="mr-2">
                mdi-alert
            </v-icon>
            {{ alertSnackbarText }}
        </v-snackbar>

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

.sensor-tooltip {
  position: absolute;
  background: rgba(21, 21, 21, 0.9);
  color: var(--gi-white);
  padding: 8px 10px;
  white-space: nowrap;
  transform: translate(-50%, -120%); /* center horizontally, above cursor */
  z-index: 1000;
  font-size: 14px;
  letter-spacing: 0.1px;
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

/* Co-located sensor picker (revertable) */
.sensor-picker {
    position: absolute;
    transform: translate(-50%, -110%);
    z-index: 1001;
    min-width: 200px;
    max-width: 320px;
    max-height: 300px;
    overflow-y: auto;
}
</style>
