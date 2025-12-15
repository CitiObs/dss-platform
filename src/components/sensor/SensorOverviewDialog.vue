<script setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useKTUYApi } from "@/components/sensor/useKTUYApi.js";
import { useSWNPApi } from "@/components/sensor/useSWNPApi.js";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi.js";
import { GiPeriodSelect } from "@geoint/geoint-vue";

import BaseDialog from "@/components/base/BaseDialog.vue";
import SensorInfoSection from "@/components/sensor/SensorInfoSection.vue";
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
const sensorThingsApi = useSensorThingsApi();

const AGGREGATION_OPTIONS = {
    time: { show: false },
    type: { show: false },
};

const overviewData = ref({});
const isLoading = ref(false);
const activeTab = ref("latest");
const dateRangeBounds = ref(null);
const selectedPeriod = ref([]);

const chartData = computed(() => {
    if (!overviewData.value) return [];

    let base =
        activeTab.value === "latest"
            ? overviewData.value.observations
            : overviewData.value.fullHistory;

    if (!base) return [];

    let data = Array.isArray(base) ? base : Object.values(base).flat();

    return sortByPhenomenonTime([...data]);
});

const sensorInfo = computed(() => {
    if (!overviewData.value.sensorInfo) return;

    const lastIndex = chartData.value.length - 1;
    const latestData = chartData.value[lastIndex];

    return {
        ...overviewData.value.sensorInfo,
        result: latestData?.result,
        phenomenonTime: latestData?.phenomenonTime,
        sensorMetric: props.sensorMetric
    };
});

const dialogTitle = computed(() => {
    return `${t("sensor.sensorId")}: ${sensorInfo.value?.thingId ?? ""}`;
});

const availableDateRange = computed(() => {
    if (!dateRangeBounds.value) return null;

    return {
        min: new Date(dateRangeBounds.value.first.phenomenonTime),
        max: new Date(dateRangeBounds.value.last.phenomenonTime)
    };
});

// Builds the default date range for the datepicker.
// The component expects a 2-item array:
// ['YYYY-MM-DDT00:00:00.000Z', 'YYYY-MM-DDT23:59:59.999Z']
//
// We take the latest available phenomenonTime and create a range
// covering the full day—from the start (00:00:00.000) to the end
// of that same day (23:59:59.999).
const defaultDateRange = computed(() => {
    if (!dateRangeBounds.value?.last?.phenomenonTime) return null;

    const lastDate = new Date(dateRangeBounds.value.last.phenomenonTime);

    // Set to start of day (00:00:00.000)
    const startOfDay = new Date(lastDate);
    startOfDay.setHours(0, 0, 0, 0);

    // Set to end of day (23:59:59.999)
    const endOfDay = new Date(lastDate);
    endOfDay.setHours(23, 59, 59, 999);

    return [
        startOfDay.toISOString(),
        endOfDay.toISOString(),
    ];
});

const noSensorsMessage = computed(() => {
    // No selection, default message
    if (!selectedPeriod.value || selectedPeriod.value.length === 0) {
        return t("sensor.noSensorsDataSingle");
    }

    const [start, end] = selectedPeriod.value;
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Check if the selected range is a single day
    if (startDate.toDateString() === endDate.toDateString()) {
        return t("sensor.noSensorsDataSingle"); // Single day
    }

    return t("sensor.noSensorsDataRange"); // Multiple days
});

function sortByPhenomenonTime (observations) {
    return observations.sort((a, b) => new Date(a.phenomenonTime) - new Date(b.phenomenonTime));
}

async function handleDialogOpen() {
    // Clear overview data
    overviewData.value = {};
    activeTab.value = "latest";
    selectedPeriod.value = [];
    dateRangeBounds.value = null;
    if (!props.datastreamLink || !props.thingLink) return;

    isLoading.value = true;

    // Fetch overview data based on the provided API code
    overviewData.value = await apiMapping[props.apiCode].getOverviewData(props.datastreamLink, props.thingLink, props.sensorMetric);

    isLoading.value = false;
}

async function onTabChanged(tab) {
    if (tab !== "dataExploration") return;

    if (dateRangeBounds.value) return; // Prevent re-loading

    isLoading.value = true;

    try {
        dateRangeBounds.value = await sensorThingsApi.getFirstAndLastObservations(
            props.datastreamLink
        );
    } finally {
        isLoading.value = false;
    }
}

async function onPeriodChange(range) {
    if (!range || !Array.isArray(range) || range.length < 2) {
        // No valid range yet → reset or skip
        selectedPeriod.value = null;
        return;
    }

    let start = range[0];
    let end = range[1];

    // If user selected only ONE date:
    // - Make start = beginning of that day
    // - Make end = end of that day
    if (!end) {
        const single = new Date(start);

        start = new Date(single);
        start.setHours(0, 0, 0, 0);

        end = new Date(single);
        end.setHours(23, 59, 59, 999);
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Update selectedPeriod so UI reflects the correct full-day range
    selectedPeriod.value = [startDate.toISOString(), endDate.toISOString()];

    try {
        const obs = await sensorThingsApi.getObservationsByPeriod(
            props.datastreamLink,
            startDate,
            endDate
        );

        overviewData.value.fullHistory = obs;

    } catch (error) {
        console.error("Error loading selected period:", error);
    } finally {
        isLoading.value = false;
    }
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
        class="w-100 sensor-dialog"
        :max-width="1300"
    >
        <!------------------------- Tabs  ------------------------->
        <v-tabs
            v-model="activeTab"
            @update:model-value="onTabChanged"
        >
            <v-tab
                value="latest"
                class="text-capitalize"
                :class="{ 'gi-text-primary-500': activeTab === 'latest' }"
            >
                {{ t("sensor.latestData") }}
            </v-tab>

            <v-tab
                value="dataExploration"
                class="text-capitalize"
                :class="{ 'gi-text-primary-500': activeTab === 'dataExploration' }"
            >
                {{ t("sensor.dataExploration") }}
            </v-tab>
        </v-tabs>

        <!--------------------- Tabs Content --------------------->
        <v-window
            v-model="activeTab"
            class="py-6"
        >
            <!------------- Latest Data Tab ------------->
            <v-window-item value="latest">
                <!-- Loading state -->
                <v-row
                    v-if="isLoading"
                    class="state-container"
                >
                    <v-col class="d-flex justify-center align-center">
                        <v-progress-circular
                            indeterminate
                            color="primary"
                            :size="62"
                            :width="6"
                        />
                    </v-col>
                </v-row>
                <!-- Sensor content -->
                <v-row v-else-if="sensorInfo && chartData.length">
                    <v-col
                        cols="12"
                        sm="5"
                        md="4"
                        class="d-flex flex-column justify-end align-content-end"
                    >
                        <SensorInfoSection :sensor-info="sensorInfo" />
                    </v-col>

                    <v-col
                        cols="12"
                        sm="7"
                        md="8"
                        class="d-flex flex-column justify-end align-content-end"
                    >
                        <SensorChart
                            :metric="sensorInfo.metric"
                            :chart-data="chartData"
                        />
                    </v-col>
                </v-row>
                <!-- No data/ Empty state -->
                <v-row
                    v-else
                    class="state-container"
                >
                    <v-col class="d-flex justify-center align-center">
                        <NoData />
                    </v-col>
                </v-row>
            </v-window-item>

            <!------------- Data Exploration Tab ------------->
            <v-window-item value="dataExploration">
                <!-- Loading state -->
                <v-row
                    v-if="isLoading"
                    class="state-container"
                >
                    <v-col class="d-flex justify-center align-center">
                        <v-progress-circular
                            indeterminate
                            color="primary"
                            :size="62"
                            :width="6"
                        />
                    </v-col>
                </v-row>
                <!-- Data Exploration date picker and chart -->
                <v-row
                    v-else-if="sensorInfo && availableDateRange"
                    class="exploration-container px-2 d-flex flex-column"
                >
                    <!-- Data Period Selector -->
                    <v-col class="flex-grow-0 pa-0">
                        <GiPeriodSelect
                            v-model="selectedPeriod"
                            :aggregation-options="AGGREGATION_OPTIONS"
                            class="date-picker-styles d-flex justify-center"
                            :calendar-options="{
                                calendarTypeSelect: { show: false },
                                datepicker: {
                                    minDate: availableDateRange.min,
                                    maxDate: availableDateRange.max,
                                }

                            }"
                            :default-date="defaultDateRange"
                            @update:model-value="onPeriodChange"
                        />
                    </v-col>
                    <!-- Chart or No Data -->
                    <v-col
                        v-if="chartData.length"
                        class="pa-0"
                    >
                        <SensorChart
                            :metric="sensorInfo.metric"
                            :chart-data="chartData"
                        />
                    </v-col>
                    <v-col
                        v-else
                        class="noData-container translation-break d-flex align-center justify-center flex-grow-1 text-medium-emphasis gi-font-weight-medium gi-text-h4"
                    >
                        {{ noSensorsMessage }}
                    </v-col>
                </v-row>

                <!-- No data/ Empty state -->
                <v-row
                    v-else
                    class="state-container"
                >
                    <v-col class="d-flex justify-center align-center">
                        <NoData />
                    </v-col>
                </v-row>
            </v-window-item>
        </v-window>
    </BaseDialog>
</template>

<style scoped>
/* Container used for both loading and empty states (keeps UI height consistent) */
.state-container {
    height: 250px;
}

.exploration-container {
    min-height: 500px;
}

.translation-break {
  white-space: pre-line; /* preserves \n line breaks */
  text-align: center;
}

/* Highlight styling for all days between the selected start and end dates */
.date-picker-styles :deep(.dp__cell_inner.dp__pointer.dp--past.dp__range_between) {
    border-color: var(--gi-primary-100) !important;
    background-color:var(--gi-primary-50) !important;
    color: var(--gi-primary-400) !important;

}

/* Adjusted styling for selectable past dates outside the selected range */
.date-picker-styles :deep(.dp__cell_inner.dp__cell_offset.dp__pointer.dp--past) {
    color: var(--gi-primary-400) !important;
}

/* Custom appearance for the starting date of the selected range */
.date-picker-styles :deep(.dp__cell_inner.dp__cell_offset.dp__pointer.dp--past.dp__range_start) {
    color:  var(--gi-grey-50) !important;
}

/* Hide offset dates (dates from previous/next months) */
.date-picker-styles :deep(.dp__cell_offset) {
    visibility: hidden !important;
}

/* Hide previous + next arrow buttons inside GiPeriodSelect */
:deep(.gi-period-select__arrow-btn) {
    display: none !important;
}
</style>
