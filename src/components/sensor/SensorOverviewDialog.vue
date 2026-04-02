<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useKTUYApi } from "@/components/sensor/useKTUYApi.js";
import { useSWNPApi } from "@/components/sensor/useSWNPApi.js";
import { useSensorThingsApi } from "@/composables/api/useSensorThingsApi.js";
import { GiPeriodSelect } from "@geoint/geoint-vue";

import { useAlertStore } from "@/stores/alertStore.js";
import { useAuthStore } from "@/stores/authStore.js";

import BaseDialog from "@/components/base/BaseDialog.vue";
import SensorInfoSection from "@/components/sensor/SensorInfoSection.vue";
import SensorChart from "@/components/sensor/SensorChart.vue";
import NoData from "@/components/NoData.vue";
import AlertRulesDialog from "@/components/AlertRulesDialog.vue";

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
const alertStore = useAlertStore();
const authStore = useAuthStore();
const showAlertDialog = ref(false);

function addAlertForSensor() {
    if (!sensorInfo.value?.thingId) return;
    alertStore.addRule(authStore.userId, {
        metric: props.sensorMetric,
        operator: "gt",
        threshold: 0,
        sensorId: sensorInfo.value.thingId,
    });
    showAlertDialog.value = true;
}

const AGGREGATION_OPTIONS = {
    time: { show: false },
    type: { show: false },
};

const overviewData = ref({});
const isLoading = ref(false);
const activeTab = ref("latest");
const dateRangeBounds = ref(null);
const selectedPeriod = ref([]);
const actualDatastreamLink = ref(null); // The actual datastream link used by getOverviewData
const isPreFetching = ref(false); // Flag to prevent onPeriodChange during initial pre-fetch
const lastFetchedPeriod = ref(null); // Track last fetched period to prevent duplicate requests

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
    if (!overviewData.value?.sensorInfo) return;

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
    if (!dateRangeBounds.value?.first?.phenomenonTime || !dateRangeBounds.value?.last?.phenomenonTime) return null;

    return {
        min: new Date(dateRangeBounds.value.first.phenomenonTime),
        max: new Date(dateRangeBounds.value.last.phenomenonTime)
    };
});

// Builds the default date range for the datepicker.
// The component expects a 2-item array:
// ['YYYY-MM-DDT00:00:00.000Z', 'YYYY-MM-DDT23:59:59.999Z']
//
// Uses selectedPeriod if already set (user changed date), otherwise
// falls back to the latest available phenomenonTime.
const defaultDateRange = computed(() => {
    // If we already have a selected period, use that (prevents resetting on re-render)
    if (selectedPeriod.value && selectedPeriod.value.length === 2) {
        return selectedPeriod.value;
    }
    
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
    actualDatastreamLink.value = null;
    lastFetchedPeriod.value = null;
    isPreFetching.value = false;
    if (!props.datastreamLink || !props.thingLink) return;

    isLoading.value = true;

    // Fetch overview data based on the provided API code
    const result = await apiMapping[props.apiCode].getOverviewData(props.datastreamLink, props.thingLink, props.sensorMetric);
    
    if (result) {
        overviewData.value = result;
        // Store the actual datastream link used (for Data Exploration)
        actualDatastreamLink.value = result.datastreamLink || props.datastreamLink;
        console.log("[SensorOverviewDialog] props.datastreamLink:", props.datastreamLink);
        console.log("[SensorOverviewDialog] result.datastreamLink:", result.datastreamLink);
        console.log("[SensorOverviewDialog] actualDatastreamLink:", actualDatastreamLink.value);
    }

    isLoading.value = false;
}

async function onTabChanged(tab) {
    if (tab !== "dataExploration") return;

    if (dateRangeBounds.value) return; // Prevent re-loading

    // Use the actual datastream link from getOverviewData (matches the "Latest Data" tab)
    const datastreamToUse = actualDatastreamLink.value || props.datastreamLink;

    // Check if we have a valid datastream link
    if (!datastreamToUse) {
        console.warn("[SensorOverviewDialog] No datastreamLink available for data exploration");
        console.log("[SensorOverviewDialog] thingLink:", props.thingLink);
        return;
    }

    console.log("[SensorOverviewDialog] Fetching date range for:", datastreamToUse);

    isLoading.value = true;

    try {
        dateRangeBounds.value = await sensorThingsApi.getFirstAndLastObservations(
            datastreamToUse
        );
        console.log("[SensorOverviewDialog] Date range bounds:", dateRangeBounds.value);
        
        // Pre-fetch data for the last available day (default date)
        // This avoids relying on GiPeriodSelect's initial emit which has timezone issues
        if (dateRangeBounds.value?.last?.phenomenonTime) {
            const lastDate = new Date(dateRangeBounds.value.last.phenomenonTime);
            
            // Create range for the full day in LOCAL time
            const startOfDay = new Date(lastDate);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(lastDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            // Set flag to prevent onPeriodChange from firing during this update
            isPreFetching.value = true;
            
            // Track this period so duplicate emits are skipped
            lastFetchedPeriod.value = `${startOfDay.toISOString()}-${endOfDay.toISOString()}`;
            
            // Update selectedPeriod for noSensorsMessage computed
            selectedPeriod.value = [startOfDay.toISOString(), endOfDay.toISOString()];
            
            console.log("[onTabChanged] Pre-fetching data for default date:", startOfDay.toISOString(), "to", endOfDay.toISOString());
            
            const obs = await sensorThingsApi.getObservationsByPeriod(
                datastreamToUse,
                startOfDay,
                endOfDay
            );
            
            console.log("[onTabChanged] Pre-fetched observations:", obs.length);
            overviewData.value.fullHistory = obs;
            
            // Allow onPeriodChange to work again after a tick
            setTimeout(() => { isPreFetching.value = false; }, 100);
        }
    } finally {
        isLoading.value = false;
    }
}

function onPeriodChange(range) {
    // Delay state changes to avoid interfering with GiPeriodSelect's internal lifecycle
    // This prevents the "$el is null" error caused by re-rendering during emit
    setTimeout(() => handlePeriodChange(range), 0);
}

async function handlePeriodChange(range) {
    // Skip if we're in the middle of pre-fetching (prevents loop)
    if (isPreFetching.value) {
        console.log("[onPeriodChange] Skipping - pre-fetch in progress");
        return;
    }
    
    if (!range || !Array.isArray(range) || range.length < 2) {
        // No valid range yet → reset or skip
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
    
    const periodKey = `${startDate.toISOString()}-${endDate.toISOString()}`;
    
    // Skip if we already fetched this exact period (prevents infinite loop)
    if (lastFetchedPeriod.value === periodKey) {
        console.log("[onPeriodChange] Skipping - already fetched this period");
        return;
    }

    isLoading.value = true;
    lastFetchedPeriod.value = periodKey;
    
    // Update selectedPeriod for noSensorsMessage computed
    selectedPeriod.value = [startDate.toISOString(), endDate.toISOString()];

    try {
        // Use the actual datastream link from getOverviewData (matches the "Latest Data" tab)
        const datastreamToUse = actualDatastreamLink.value || props.datastreamLink;
        
        console.log("[onPeriodChange] Fetching observations for:", datastreamToUse);
        console.log("[onPeriodChange] Date range:", startDate.toISOString(), "to", endDate.toISOString());
        
        const obs = await sensorThingsApi.getObservationsByPeriod(
            datastreamToUse,
            startDate,
            endDate
        );

        console.log("[onPeriodChange] Received observations:", obs.length);
        if (obs.length > 0) {
            console.log("[onPeriodChange] First obs:", obs[0]);
            console.log("[onPeriodChange] Last obs:", obs[obs.length - 1]);
        }

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
                        <SensorInfoSection
                            :sensor-info="sensorInfo"
                            :chart-data="chartData"
                        />
                        <v-btn
                            v-if="authStore.isAuthenticated"
                            variant="tonal"
                            size="small"
                            class="text-none mt-3"
                            @click="addAlertForSensor"
                        >
                            <v-icon
                                class="mr-1"
                                size="16"
                            >
                                mdi-bell-plus
                            </v-icon>
                            {{ t("alerts.addAlertForSensor") }}
                        </v-btn>
                    </v-col>

                    <v-col
                        cols="12"
                        sm="7"
                        md="8"
                        class="d-flex flex-column justify-end align-content-end"
                    >
                        <SensorChart
                            :metric="sensorInfo.metric"
                            :sensor-metric="sensorMetric"
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
                            :sensor-metric="sensorMetric"
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

    <AlertRulesDialog v-model="showAlertDialog" />
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
