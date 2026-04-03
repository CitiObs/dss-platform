<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDisplay } from "vuetify";
import { formatTimestamp } from "@/helpers/dates.js";
import { SENSOR_ICONS, SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";

const props = defineProps({
    sensorInfo: {
        type: Object,
        required: true
    },
    chartData: {
        type: Array,
        default: () => [],
    },
});

const { t } = useI18n();
const { mdAndUp } = useDisplay();

const sensorIcon = computed(() => {
    return SENSOR_ICONS[props.sensorInfo.sensorMetric] || "";
});

const sensorData = computed(() => ({
    label: t("sensor.lastMeasurement"),
    icon: "mdi-clock-outline",
    value: formatTimestamp(props.sensorInfo.phenomenonTime),
}));

const unitMeasurement = computed(() => {
    return SENSOR_DEFINITIONS[props.sensorInfo.sensorMetric]?.unit || "";
}
);

const tableFields = computed(() => {
    return [
        { label: t("sensor.sensorName"), value: props.sensorInfo.thingName },
        { label: t("sensor.sensorType"), value: props.sensorInfo.sensorType },
        { label: t("sensor.dataOrigin"), value: props.sensorInfo.dataOrigin },
        { label: t("sensor.license"), value: props.sensorInfo.license }
    ];
});

const stats = computed(() => {
    const values = props.chartData
        .map(d => d.result)
        .filter(v => v !== null && v !== undefined && v !== -99);

    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    return {
        min: min.toFixed(1),
        max: max.toFixed(1),
        avg: avg.toFixed(1),
        count: values.length,
    };
});

// Health recommendation levels per metric
// Each level: { max, icon, color, key } — first match wins (check in order)
const HEALTH_LEVELS = {
    pm25: [
        { max: 10, icon: "mdi-emoticon-happy", color: "success", key: "good" },
        { max: 15, icon: "mdi-emoticon-neutral", color: "light-green", key: "moderate" },
        { max: 25, icon: "mdi-emoticon-sad", color: "orange", key: "unhealthySensitive" },
        { max: 50, icon: "mdi-emoticon-angry", color: "deep-orange", key: "unhealthy" },
        { max: Infinity, icon: "mdi-skull", color: "red-darken-3", key: "hazardous" },
    ],
    pm10: [
        { max: 20, icon: "mdi-emoticon-happy", color: "success", key: "good" },
        { max: 45, icon: "mdi-emoticon-neutral", color: "light-green", key: "moderate" },
        { max: 50, icon: "mdi-emoticon-sad", color: "orange", key: "unhealthySensitive" },
        { max: 100, icon: "mdi-emoticon-angry", color: "deep-orange", key: "unhealthy" },
        { max: Infinity, icon: "mdi-skull", color: "red-darken-3", key: "hazardous" },
    ],
    no2: [
        { max: 25, icon: "mdi-emoticon-happy", color: "success", key: "good" },
        { max: 40, icon: "mdi-emoticon-neutral", color: "light-green", key: "moderate" },
        { max: 100, icon: "mdi-emoticon-sad", color: "orange", key: "unhealthySensitive" },
        { max: 200, icon: "mdi-emoticon-angry", color: "deep-orange", key: "unhealthy" },
        { max: Infinity, icon: "mdi-skull", color: "red-darken-3", key: "hazardous" },
    ],
    airTemperature: [
        { max: 0, icon: "mdi-snowflake", color: "blue", key: "freezing" },
        { max: 10, icon: "mdi-thermometer-low", color: "light-blue", key: "cold" },
        { max: 30, icon: "mdi-thermometer", color: "success", key: "comfortable" },
        { max: 35, icon: "mdi-thermometer-high", color: "orange", key: "hot" },
        { max: Infinity, icon: "mdi-fire", color: "red-darken-3", key: "heatStress" },
    ],
    relativeHumidity: [
        { max: 30, icon: "mdi-water-off", color: "orange", key: "dryAir" },
        { max: 60, icon: "mdi-water-check", color: "success", key: "comfortable" },
        { max: 70, icon: "mdi-water-percent", color: "light-green", key: "humid" },
        { max: Infinity, icon: "mdi-water-alert", color: "orange", key: "veryHumid" },
    ],
};

const healthRecommendation = computed(() => {
    const metric = props.sensorInfo.sensorMetric;
    const value = props.sensorInfo.result;
    const levels = HEALTH_LEVELS[metric];

    if (!levels || value === null || value === undefined) return null;

    const level = levels.find(l => value <= l.max);
    if (!level) return null;

    return {
        icon: level.icon,
        color: level.color,
        text: t(`sensor.health.${level.key}`),
    };
});
</script>

<template>
    <!-- Main Sensor Info -->
    <v-sheet
        rounded="lg"
        color="grey-lighten-3"
        class="pa-4 d-flex flex-column align-center ga-1"
    >
        <!-- Metric name with icon -->
        <div class="d-flex align-center ga-1">
            <p class="text-subtitle-1">
                {{ sensorInfo.metric }}
            </p>
            <v-icon size="24">
                {{ sensorIcon }}
            </v-icon>
        </div>

        <!-- Sensor Result value + uni icon -->
        <h2
            class="metric-text font-weight-bold"
        >
            {{ sensorInfo.result }}
            <span class="unit-text">
                {{ unitMeasurement }}</span>
        </h2>

        <!-- Last measurement value + tooltip -->
        <v-tooltip location="bottom">
            <template #activator="{ props: tooltipProps }">
                <v-chip
                    v-bind="tooltipProps"
                    class="pa-4 gi-text-primary-600"
                    :prepend-icon="sensorData.icon"
                >
                    <span>{{ sensorData.value }}</span>
                </v-chip>
            </template>
            <span>{{ sensorData.label }}</span>
        </v-tooltip>

        <!-- Health Recommendation Banner -->
        <v-alert
            v-if="healthRecommendation"
            :color="healthRecommendation.color"
            :icon="healthRecommendation.icon"
            variant="tonal"
            density="compact"
            class="mt-2 text-body-2"
            style="align-self: stretch;"
        >
            {{ healthRecommendation.text }}
        </v-alert>
    </v-sheet>

    <!-- Info Table  -->
    <v-table
        class="mt-5 py-2 bg-grey-lighten-3 rounded"
    >
        <tbody>
            <tr
                v-for="(field, index) in tableFields"
                :key="index"
            >
                <td
                    class="text-medium-emphasis"
                    :class="{ 'no-wrap': mdAndUp }"
                >
                    {{ field.label }}
                </td>
                <td class="wrap-text gi-text-black ">
                    {{ field.value ?? "-" }}
                </td>
            </tr>
        </tbody>
    </v-table>

    <!-- Statistical Summary -->
    <div
        v-if="stats"
        class="mt-3 pa-3 bg-grey-lighten-3 rounded"
    >
        <p class="text-caption text-medium-emphasis mb-2">
            {{ t("sensor.statistics") }} ({{ stats.count }} {{ t("sensor.measurements") }})
        </p>
        <div class="d-flex justify-space-between">
            <div class="text-center">
                <v-icon
                    size="16"
                    color="blue"
                >
                    mdi-arrow-down
                </v-icon>
                <p class="text-body-2 font-weight-bold">
                    {{ stats.min }}
                </p>
                <p class="text-caption text-medium-emphasis">
                    {{ t("sensor.min") }}
                </p>
            </div>
            <div class="text-center">
                <v-icon
                    size="16"
                    color="orange"
                >
                    mdi-tilde
                </v-icon>
                <p class="text-body-2 font-weight-bold">
                    {{ stats.avg }}
                </p>
                <p class="text-caption text-medium-emphasis">
                    {{ t("sensor.avg") }}
                </p>
            </div>
            <div class="text-center">
                <v-icon
                    size="16"
                    color="red"
                >
                    mdi-arrow-up
                </v-icon>
                <p class="text-body-2 font-weight-bold">
                    {{ stats.max }}
                </p>
                <p class="text-caption text-medium-emphasis">
                    {{ t("sensor.max") }}
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.v-table .v-table__wrapper > table > tbody > tr:not(:last-child) > td {
  border-bottom: none;
}

.metric-text {
    font-size: 50px
}

.unit-text {
  font-size: 25px;
  font-weight: 500;
}

.no-wrap {
    white-space: nowrap;
}

.wrap-text {
    white-space: normal !important;
    word-break: break-word;
}
</style>
