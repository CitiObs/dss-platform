<script setup>
import { ref, computed, onMounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
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
const clusterRef = ref();
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

const overrideStyleFunction = (feature, style) => {
    const clusteredFeatures = feature.get("features");
    const size = clusteredFeatures.length;
    style.getText().setText(size.toString());
    return style;
};

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

    const feature = clusteredFeatures[0].features[0]?.get("feature");
    apiCode.value = feature.get("id").substring(0, 4);
    observationsLink.value = feature.get("observationsNavigationLink");
}

onMounted(async () => {
    const cached = sensorStore.getSensorData();

    if (cached.size()) {
        fois.value = cached;
        return;
    }

    isInitialLoading.value = true;
    await sensorThingsApi.getFOIs(fois.value, stats.value);
    sensorStore.setSensorData(fois.value);
    isInitialLoading.value = false;
});

onBeforeRouteLeave(() => {
    const vectorSource = clusterRef.value.source.getSource();
    vectorSource.clear(true);
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

                <ol-vector-layer v-if="!isInitialLoading">
                    <ol-source-cluster
                        ref="clusterRef"
                        :distance="60"
                    >
                        <ol-source-vector>
                            <ol-feature
                                v-for="(feature, index) in fois.all()"
                                :key="index"
                                :properties="{feature}"
                            >
                                <ol-geom-point :coordinates="feature.get('geometry').flatCoordinates" />
                            </ol-feature>
                        </ol-source-vector>
                    </ol-source-cluster>

                    <ol-style :override-style-function="overrideStyleFunction">
                        <ol-style-circle :radius="15">
                            <ol-style-fill color="#3399CC" />
                            <ol-style-stroke
                                color="#fff"
                                :width="1"
                            />
                        </ol-style-circle>
                        <ol-style-text font="14px sans-serif">
                            <ol-style-fill color="#fff" />
                        </ol-style-text>
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
