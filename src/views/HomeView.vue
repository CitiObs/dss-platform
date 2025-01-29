<script setup>
import { ref, computed, inject } from "vue";
import { FeatureCollection, withAsync } from "@geoint/geoint-vue";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";

import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";

const geoint = inject("geoint");
const sensorThingsApi = useSensorThingsApi();
const occupiedHeight = STYLES_CONFIG.header_height + STYLES_CONFIG.footer_height;

const fois = ref(new FeatureCollection());
const stats = ref({});
const mapRef = ref();

sensorThingsApi.getFOIs(fois.value, stats.value);

const mapSize = computed(() => ({
    width: "100%",
    height: `calc(100vh - ${occupiedHeight}px)`,
}));

function getFeatures (event) {
    const featuresAtPixel = mapRef.value.map.getFeaturesAtPixel(event.pixel);
    const features = featuresAtPixel.map(feature => feature.getProperties());

    return features;
}

async function getFeatureObservations (observationsLink) {
    const api = geoint.api("virtualair");

    const params = {
        $expand: "Datastream($expand=ObservedProperty)",
    };

    const { response, error } = await withAsync(
        api.get, 
        observationsLink, 
        { params }
    );

    if (error) {
        console.error(error);
        return;
    }

    return response.data;
}

async function handleMapClick (event) {
    const features = getFeatures(event);

    if (!features.length) return;

    const featuresObservations = await getFeatureObservations(features[0].observationsNavigationLink); // Temporary get the first feature
    console.log(featuresObservations);
}

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
    </LayoutMap>
</template>
