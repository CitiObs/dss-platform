<script setup>
import { ref, computed, onMounted } from "vue";
import { FeatureCollection, useGiColor } from "@geoint/geoint-vue";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi";
import { useSensorStore } from "@/stores/sensorStore.js";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";

import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";
import SensorOverviewDialog from "@/components/sensor/SensorOverviewDialog.vue";
import BaseDialog from "@/components/base/BaseDialog.vue";

const { getColor } = useGiColor();
const sensorThingsApi = useSensorThingsApi();
const sensorStore = useSensorStore();
const occupiedHeight = STYLES_CONFIG.header_height + STYLES_CONFIG.footer_height;

const fois = ref(new FeatureCollection());
const stats = ref({});
const mapRef = ref();
const apiCode = ref();
const observationsLink = ref();
const isSensorOverviewDialog = ref(false);
const isInitialLoading = ref(false);

const loadingProgress = computed(() => {
    if (!stats.value.totalRequests) return "";
    return Math.trunc((stats.value.totalRequests / 150) * 100);
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

onMounted(async () => {
    const cached = sensorStore.getSensorData();

    if (cached.size()) {
        fois.value = cached;
        return;
    }

    await sensorThingsApi.getFOIs(fois.value, stats.value, isInitialLoading);
    sensorStore.setSensorData(fois.value);
});

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

        <BaseDialog
            v-model="isInitialLoading"
            :title="$t('home.welcomeToCitiobs')"
            :max-width="800"
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
