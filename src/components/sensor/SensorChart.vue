<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { GiApexChart } from "@geoint/geoint-vue";

const { t } = useI18n();

const props = defineProps({
    metric: {
        type: String,
        default: ""
    },
    sensorMetric: {
        type: String,
        default: ""
    },
    chartData: {
        type: Array,
        required: true
    },
});

// WHO/EU guideline and comfort thresholds per metric
const GUIDELINE_THRESHOLDS = {
    pm25: [
        { value: 15, label: () => t("sensor.guidelineWHO", { value: "15 µg/m³" }), color: "#FF9800" },
        { value: 25, label: () => t("sensor.guidelineEU", { value: "25 µg/m³" }), color: "#F44336" },
    ],
    pm10: [
        { value: 45, label: () => t("sensor.guidelineWHO", { value: "45 µg/m³" }), color: "#FF9800" },
        { value: 50, label: () => t("sensor.guidelineEU", { value: "50 µg/m³" }), color: "#F44336" },
    ],
    no2: [
        { value: 25, label: () => t("sensor.guidelineWHO", { value: "25 µg/m³" }), color: "#FF9800" },
        { value: 40, label: () => t("sensor.guidelineEU", { value: "40 µg/m³" }), color: "#F44336" },
    ],
    airTemperature: [
        { value: 35, label: () => t("sensor.guidelineHeatStress", { value: "35°C" }), color: "#F44336" },
        { value: 0, label: () => t("sensor.guidelineFreezing", { value: "0°C" }), color: "#2196F3" },
    ],
    relativeHumidity: [
        { value: 30, label: () => t("sensor.guidelineLowHumidity", { value: "30%" }), color: "#FF9800" },
        { value: 70, label: () => t("sensor.guidelineHighHumidity", { value: "70%" }), color: "#FF9800" },
    ],
};

// Compute data range for threshold filtering and Y-axis extension
const dataRange = computed(() => {
    if (!props.chartData.length) return null;
    const values = props.chartData.map(d => d.result).filter(v => v != null);
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return { min, max, span };
});

// Only show thresholds that are within or very near the data range (within 10% of span)
const relevantThresholds = computed(() => {
    const thresholds = GUIDELINE_THRESHOLDS[props.sensorMetric];
    if (!thresholds || !dataRange.value) return [];
    const { min, max, span } = dataRange.value;
    const margin = span * 0.1;
    return thresholds.filter(th => th.value >= min - margin && th.value <= max + margin);
});

const guidelineAnnotations = computed(() => {
    return relevantThresholds.value.map((th, index) => ({
        y: th.value,
        borderColor: th.color,
        strokeDashArray: 4,
        label: {
            text: th.label(),
            borderColor: th.color,
            textAnchor: "start",
            style: {
                color: "#fff",
                background: th.color,
                fontSize: "11px",
                padding: { left: 4, right: 4, top: 2, bottom: 2 },
            },
            position: "left",
            offsetX: 0,
            offsetY: -10,
        },
    }));
});

// Extend Y-axis to include relevant thresholds
const yaxisConfig = computed(() => {
    if (!relevantThresholds.value.length || !dataRange.value) return {};
    const { min, max } = dataRange.value;
    const thresholdValues = relevantThresholds.value.map(th => th.value);
    const allValues = [min, max, ...thresholdValues];
    const newMin = Math.min(...allValues);
    const newMax = Math.max(...allValues);
    const padding = (newMax - newMin) * 0.1;
    return {
        yaxis: {
            min: newMin - padding,
            max: newMax + padding,
        },
    };
});

const chartOptions = computed(() => {
    return {
        chart: {
            parentHeightOffset: 0,
            toolbar: {},
        },
        grid: {
            padding: {
                top: guidelineAnnotations.value.length > 0 ? 20 : 0,
            },
        },
        xaxis: {
            type: "datetime",
            labels: {
                datetimeUTC: false // Display datetime in local time
            }
        },
        tooltip: {
            x: {
                format: "dd MMM yyyy, HH:mm"
            }
        },
        "colors": [
            "#008480"
        ],
        ...yaxisConfig.value,
        ...(guidelineAnnotations.value.length > 0 && {
            annotations: {
                yaxis: guidelineAnnotations.value,
            },
        }),
    };
});

const chartSeries = computed(() => {
    const series = props.chartData.map(item => {
        return {
            x: item.phenomenonTime,
            y: item.result
        };
    });

    return [{
        name: props.metric,
        data: series
    }];
});

</script>

<template>
    <GiApexChart
        v-if="chartSeries.length"
        type="line"
        :height="400"
        :options="chartOptions"
        :series="chartSeries"
        class="d-flex align-end"
    />
</template>

<style scoped>
:deep(.apexcharts-zoom-icon.apexcharts-selected svg) {
  fill: #007874 !important;
}

:deep(.apexcharts-pan-icon.apexcharts-selected svg) {
  stroke: #007874 !important;
}
</style>
