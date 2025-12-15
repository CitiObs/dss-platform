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
</script>

<template>
    <!-- Main Sensor Info -->
    <div class="d-flex flex-column align-center py-2 ga-1">
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
    </div>

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
