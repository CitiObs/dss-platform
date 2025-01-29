<script setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { GiSelect } from "@geoint/geoint-vue";
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
    observationsLink: {
        type: String,
        default: ""
    },
});

const isDialogOpen = defineModel({ type: Boolean, required: true });

const { t } = useI18n();
const apiMapping = {
    KTUY: useKTUYApi(),
    SWNP: useSWNPApi(),
};

const overviewData = ref();
const selectedMetric = ref();
const isLoading = ref(false);

const metricItems = computed(() => {
    if (!overviewData.value?.observations) return [];

    let items = [];

    for (const [key, value] of Object.entries(overviewData.value.observations)) {
        const metric = {
            name: value[0].Datastream.name,
            id: key
        };
        items.push(metric);
    }

    return items;
});

const chartData = computed(() => {
    if (!overviewData.value?.observations) return [];

    return sortByPhenomenonTime(overviewData.value.observations[selectedMetric.value]);
});

const sensorInfo = computed(() => {
    if (!overviewData.value?.sensorInfo) return;

    const lastIndex = chartData.value.length - 1;
    const latestData = chartData.value[lastIndex];

    const info = {
        ...overviewData.value.sensorInfo,
        metric: latestData.Datastream.name,
        result: latestData.result,
        unitOfMeasurement: latestData.Datastream.unitOfMeasurement.symbol,
        phenomenonTime: latestData.phenomenonTime,
    };

    // SWNP sensor names vary for each measurement, while KTUY sensor names appear to remain consistent
    if (props.apiCode === "SWNP") {
        info.sensorType = chartData.value[lastIndex].Datastream.Sensor.name;
    }

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
    overviewData.value = null;

    if (!props.observationsLink) return;

    isLoading.value = true;

    // Fetch overview data based on the provided API code
    overviewData.value = await apiMapping[props.apiCode].getOverviewData(props.observationsLink);

    // Set default selected metric if observations exist
    if (overviewData.value?.observations) {
        selectedMetric.value = metricItems.value[0]?.id;
    }

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

        <div v-else-if="metricItems.length">
            <v-row>
                <v-col
                    cols="12"
                    sm="3"
                >
                    <GiSelect
                        v-model="selectedMetric"
                        :label="t('sensor.metric')"
                        :items="metricItems"
                        item-title="name"
                        item-value="id"
                    />
                </v-col>
            </v-row>

            <v-row>
                <v-col
                    cols="12"
                    sm="5"
                >
                    <SensorInfoTable
                        v-if="sensorInfo"
                        :sensor-info="sensorInfo"
                    />
                </v-col>

                <v-col
                    cols="12"
                    sm="7"
                >
                    <SensorChart
                        v-if="chartData.length"
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
