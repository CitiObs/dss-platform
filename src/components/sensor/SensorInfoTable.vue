<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatTimestamp } from "@/helpers/dates.js";

const props = defineProps({
    sensorInfo: {
        type: Object,
        required: true
    },
});

const { t } = useI18n();

const primaryFields = computed(() => {
    return [
        {
            label: props.sensorInfo.metric,
            value: `${props.sensorInfo.result} ${props.sensorInfo.unitOfMeasurement}`
        },
        {
            label: t("sensor.lastMeasurement"),
            value: formatTimestamp(props.sensorInfo.phenomenonTime)
        },
    ];
});

const secondaryFields = computed(() => {
    return [
        {
            label: t("sensor.sensorName"),
            value: props.sensorInfo.thingName
        },
        {
            label: t("sensor.sensorType"),
            value: props.sensorInfo?.sensorType
        },
        {
            label: t("sensor.dataOrigin"),
            value: props.sensorInfo.dataOrigin
        },
        {
            label: t("sensor.license"),
            value: props.sensorInfo.license
        }
    ];
});

</script>

<template>
    <div>
        <v-table
            density="compact"
            class="gi-text-lg rounded border"
        >
            <tbody>
                <tr
                    v-for="(field, index) in primaryFields"
                    :key="index"
                >
                    <td>{{ field.label }}</td>
                    <td>{{ field.value ?? "-" }}</td>
                </tr>
            </tbody>
        </v-table>

        <div class="my-6"></div>

        <v-table
            density="compact"
            class="gi-text-base gi-text-black-300"
        >
            <tbody>
                <tr
                    v-for="(field, index) in secondaryFields"
                    :key="index"
                >
                    <td>{{ field.label }}</td>
                    <td>{{ field.value ?? "-" }}</td>
                </tr>
            </tbody>
        </v-table>
    </div>
</template>

<style scoped>
.v-table .v-table__wrapper > table > tbody > tr:not(:last-child) > td {
  border-bottom: none;
}
</style>
