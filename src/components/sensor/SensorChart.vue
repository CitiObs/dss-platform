<script setup>
import { computed } from "vue";
import { GiApexChart } from "@geoint/geoint-vue";

const props = defineProps({
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
        name: props.chartData[0].Datastream.name,
        data: series
    }];
});

</script>

<template>
    <GiApexChart
        v-if="chartSeries.length"
        type="line"
        :height="300"
        :options="chartOptions"
        :series="chartSeries"
    />
</template>

<style scoped>
</style>
