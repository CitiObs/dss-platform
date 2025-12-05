<script setup>
import { computed } from "vue";
import { GiApexChart } from "@geoint/geoint-vue";

const props = defineProps({
    metric: {
        type: String,
        default: ""
    },
    chartData: {
        type: Array,
        required: true
    },
});

const chartOptions = computed(() => {
    return {
        xaxis: {
            type: "datetime",
            labels: {
                datetimeUTC: false // Display datetime in local time
            }
        },
        "colors": [
            "#008480"
        ],
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
