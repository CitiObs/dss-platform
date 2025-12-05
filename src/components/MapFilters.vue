<script setup>
import { useI18n } from "vue-i18n";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";

const sensorMetric = defineModel("sensorMetric", { type: String, required: true });

const { t } = useI18n();


function selectMetric(key) {
    sensorMetric.value = key;
}
// import { ref } from "vue";

// const quality = ref(0);
// const corrected = ref(0);

// const qualityItems = ["A", "B", "C", "D"];
// const correctedItems = ["0", "1", "2"];

</script>

<template>
    <div class="py-4 d-flex flex-column ga-2">
        <p class="header-spacing">
            {{ t("sensorMetric") }}
        </p>

        <v-list>
            <v-list-item
                v-for="(item, key) in SENSOR_DEFINITIONS"
                :key="key"
                :value="key"
                :active="sensorMetric === key"
                rounded
                clickable
                @click="selectMetric(key)"
            >
                <v-list-item-title>
                    <v-icon class="mr-1">
                        {{ item.icon }}
                    </v-icon>
                    {{ item.label() }}
                </v-list-item-title>
            </v-list-item>
        </v-list>
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
</style>
