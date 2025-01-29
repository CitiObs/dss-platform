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

const tableFields = computed(() => {
    return [
        {
            label: props.sensorInfo.metric,
            value: `${props.sensorInfo.result} ${props.sensorInfo.unitOfMeasurement}`
        },
        {
            label: t("sensor.lastMeasurement"),
            value: formatTimestamp(props.sensorInfo.phenomenonTime)
        },
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
    <v-table
        density="compact"
        class="rounded border"
    >
        <tbody>
            <tr
                v-for="(field, index) in tableFields"
                :key="index"
            >
                <td class="label-style">
                    {{ field.label }}
                </td>
                <td>{{ field.value ?? "-" }}</td>
            </tr>
        </tbody>
    </v-table>
</template>

<style scoped>
.v-table .v-table__wrapper > table > tbody > tr:not(:last-child) > td {
  border-bottom: none;
}

.label-style {
    font-weight: 500
}
</style>
