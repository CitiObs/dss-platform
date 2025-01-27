<script setup>
import { ref, computed, inject } from "vue";
import { FeatureCollection } from "@geoint/geoint-vue";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";

import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";
import SensorOverviewDialog from "@/components/sensor/SensorOverviewDialog.vue";

const sensorThingsApi = useSensorThingsApi();
const occupiedHeight = STYLES_CONFIG.header_height + STYLES_CONFIG.footer_height;

const fois = ref(new FeatureCollection());
const stats = ref({});
const mapRef = ref();
const apiCode = ref();
const observationsLink = ref();
const isSensorOverviewDialog = ref(false);

const mapSize = computed(() => ({
    width: "100%",
    height: `calc(100vh - ${occupiedHeight}px)`,
}));

function getFeatures (event) {
    const featuresAtPixel = mapRef.value.map.getFeaturesAtPixel(event.pixel);
    const features = featuresAtPixel.map(feature => feature.getProperties());

    return features;
}

async function handleMapClick (event) {
    isSensorOverviewDialog.value = true;

    const features = getFeatures(event);
    if (!features.length) {
        apiCode.value = "";
        observationsLink.value = "";
        return;
    }

    apiCode.value = features[0].id.substring(0, 4);
    observationsLink.value = features[0].observationsNavigationLink;
}

sensorThingsApi.getFOIs(fois.value, stats.value);

</script>

<template>
    <LayoutMap>
        <template #drawer>
            <LayersDrawer>
                Total items: {{ fois.size() }} <br />
                Total request: {{ stats.totalRequests }} <br />
                Total time: {{ Math.round(stats.totalTime) }} sec<br />
            </LayersDrawer>
        </template>

        <div class="text-center text-h1">
            <ol-map
                ref="mapRef"
                :controls="[]"
                :style="mapSize"
                @click="handleMapClick"
            >
                <ol-view
                    :center="[0, 5000000]"
                    :zoom="3"
                />
                <ol-tile-layer>
                    <ol-source-osm />
                </ol-tile-layer>
                <ol-vector-layer>
                    <ol-source-vector :features="fois.all()" />
                </ol-vector-layer>
            </ol-map>
        </div>

        <SensorOverviewDialog
            v-model="isSensorOverviewDialog"
            :api-code="apiCode"
            :observations-link="observationsLink"
        />
    </LayoutMap>
</template>
