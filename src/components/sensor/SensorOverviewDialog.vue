<script setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useKTUYApi } from "@/components/sensor/useKTUYApi.js";
import { useSWNPApi } from "@/components/sensor/useSWNPApi.js";

import BaseDialog from "@/components/base/BaseDialog.vue";
import SensorInfoTable from "@/components/sensor/SensorInfoTable.vue";
import SensorChart from "@/components/sensor/SensorChart.vue";
import NoData from "@/components/NoData.vue";

const props = defineProps({
    apiCode: {
        type: String,
        default: ""
    },
    datastreamLink: {
        type: String,
        default: ""
    },
    thingLink: {
        type: String,
        default: ""
    },
    sensorMetric: {
        type: String,
        required: true
    }
});

const isDialogOpen = defineModel({ type: Boolean, required: true });

const { t } = useI18n();
const apiMapping = {
    KTUY: useKTUYApi(),
    SWNP: useSWNPApi(),
};

const overviewData = ref({});
const isLoading = ref(false);

const chartData = computed(() => {
    if (!overviewData.value.observations) return [];

    return sortByPhenomenonTime(overviewData.value.observations);
});

const sensorInfo = computed(() => {
    if (!overviewData.value.sensorInfo) return;

    const lastIndex = chartData.value.length - 1;
    const latestData = chartData.value[lastIndex];

    const info = {
        ...overviewData.value.sensorInfo,
        result: latestData.result,
        phenomenonTime: latestData.phenomenonTime,
    };

    return info;
});

const dialogTitle = computed(() => {
    return `${t("sensor.sensorId")}: ${sensorInfo.value?.thingId ?? ""}`;
});

function sortByPhenomenonTime (observations) {
    return observations.sort((a, b) => new Date(a.phenomenonTime) - new Date(b.phenomenonTime));
}

async function handleDialogOpen () {
    // Clear overview data
    overviewData.value = {};

    if (!props.datastreamLink || !props.thingLink) return;

    isLoading.value = true;

    // Fetch overview data based on the provided API code
    overviewData.value = await apiMapping[props.apiCode].getOverviewData(props.datastreamLink, props.thingLink, props.sensorMetric);

    isLoading.value = false;
}

watch(isDialogOpen, () => {
    if (!isDialogOpen.value) {
        // Abort the pending request when closing the dialog to avoid conflicts
        for (const api of Object.values(apiMapping)) {
            api.abortRequest();
        }
        return;
    }

    handleDialogOpen();
});

</script>

<template>
    <BaseDialog
        v-model="isDialogOpen"
        :title="dialogTitle"
        class="w-100"
    >
        <div
            v-if="isLoading"
            class="d-flex justify-center"
        >
            <v-progress-circular indeterminate />
        </div>

        <div v-else-if="sensorInfo && chartData.length">
            <v-row>
                <v-col
                    cols="12"
                    sm="5"
                >
                    <SensorInfoTable :sensor-info="sensorInfo" />
                </v-col>

                <v-col
                    cols="12"
                    sm="7"
                >
                    <SensorChart
                        :metric="sensorInfo.metric"
                        :chart-data="chartData"
                    />
                </v-col>
            </v-row>
        </div>

        <NoData v-else />
    </BaseDialog>
</template>

<style scoped>
</style>
