<script setup>
import { useI18n } from "vue-i18n";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";

const sensorMetric = defineModel("sensorMetric", { type: String, required: true });

const { t } = useI18n();

// import { ref } from "vue";

// const quality = ref(0);
// const corrected = ref(0);

// const qualityItems = ["A", "B", "C", "D"];
// const correctedItems = ["0", "1", "2"];

</script>

<template>
    <div class="pa-4">
        <p class="header-spacing">
            {{ t("sensorMetric") }}
        </p>

        <v-radio-group v-model="sensorMetric">
            <v-radio
                v-for="(item, key) in SENSOR_DEFINITIONS"
                :key="key"
                :label="item.label()"
                :value="key"
            />
        </v-radio-group>

        <!-- <p class="header-spacing">
            Quality
        </p>

        <v-btn-toggle
            v-model="quality"
            variant="outlined"
            divided
            mandatory
        >
            <v-btn
                v-for="(item, index) in qualityItems"
                :key="index"
                size="small"
            >
                {{ item }}
            </v-btn>
        </v-btn-toggle>

        <div class="my-4"></div>

        <p class="header-spacing">
            Corrected
        </p>

        <v-btn-toggle
            v-model="corrected"
            variant="outlined"
            divided
            mandatory
        >
            <v-btn
                v-for="(item, index) in correctedItems"
                :key="index"
                size="small"
            >
                {{ item }}
            </v-btn>
        </v-btn-toggle> -->
    </div>
</template>

<style scoped>
.header-spacing {
    margin-bottom: 8px;
}
</style>
