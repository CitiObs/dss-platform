<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAlertStore } from "@/stores/alertStore.js";
import { useAuthStore } from "@/stores/authStore.js";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";

const show = defineModel({ type: Boolean, default: false });

const { t } = useI18n();
const alertStore = useAlertStore();
const authStore = useAuthStore();

const newMetric = ref(Object.keys(SENSOR_DEFINITIONS)[0]);
const newOperator = ref("gt");
const newThreshold = ref(0);
const newSensorId = ref("");

const metricOptions = Object.entries(SENSOR_DEFINITIONS).map(([key, def]) => ({
    value: key,
    title: `${def.label()} (${def.unit})`,
}));

const operatorOptions = [
    { value: "gt", title: ">" },
    { value: "lt", title: "<" },
];

function addRule() {
    alertStore.addRule(authStore.userId, {
        metric: newMetric.value,
        operator: newOperator.value,
        threshold: newThreshold.value,
        sensorId: newSensorId.value.trim() || null,
    });
    newThreshold.value = 0;
    newSensorId.value = "";
}

function removeRule(ruleId) {
    alertStore.removeRule(authStore.userId, ruleId);
}

function metricLabel(metric) {
    const def = SENSOR_DEFINITIONS[metric];
    return def ? def.label() : metric;
}
</script>

<template>
    <v-dialog
        v-model="show"
        max-width="500"
    >
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">
                    mdi-bell-cog
                </v-icon>
                {{ t("alerts.rulesTitle") }}
            </v-card-title>

            <v-card-text>
                <!-- Existing rules -->
                <div
                    v-if="alertStore.rules.length > 0"
                    class="mb-4"
                >
                    <v-list density="compact">
                        <v-list-item
                            v-for="rule in alertStore.rules"
                            :key="rule.id"
                        >
                            <v-list-item-title class="gi-text-body-2">
                                {{ metricLabel(rule.metric) }}
                                {{ rule.operator === "gt" ? ">" : "<" }}
                                {{ rule.threshold }} {{ rule.unit }}
                            </v-list-item-title>
                            <v-list-item-subtitle
                                v-if="rule.sensorId"
                                class="gi-text-caption"
                            >
                                {{ t("alerts.station") }}: {{ rule.sensorId }}
                            </v-list-item-subtitle>
                            <v-list-item-subtitle
                                v-else
                                class="gi-text-caption text-medium-emphasis"
                            >
                                {{ t("alerts.allStations") }}
                            </v-list-item-subtitle>
                            <template #append>
                                <v-btn
                                    icon
                                    variant="text"
                                    size="small"
                                    color="error"
                                    @click="removeRule(rule.id)"
                                >
                                    <v-icon size="18">
                                        mdi-delete
                                    </v-icon>
                                </v-btn>
                            </template>
                        </v-list-item>
                    </v-list>
                </div>
                <p
                    v-else
                    class="text-medium-emphasis gi-text-body-2 mb-4"
                >
                    {{ t("alerts.noRules") }}
                </p>

                <!-- Add new rule -->
                <v-divider class="mb-4" />
                <p class="gi-text-body-1 gi-font-weight-medium mb-3">
                    {{ t("alerts.addRule") }}
                </p>

                <div class="d-flex ga-2 align-end flex-wrap mb-3">
                    <v-select
                        v-model="newMetric"
                        :items="metricOptions"
                        :label="t('sensorMetric')"
                        density="compact"
                        hide-details
                        variant="outlined"
                        style="min-width: 180px; flex: 2;"
                    />
                    <v-select
                        v-model="newOperator"
                        :items="operatorOptions"
                        label=""
                        density="compact"
                        hide-details
                        variant="outlined"
                        style="max-width: 70px; flex: 0;"
                    />
                    <v-text-field
                        v-model.number="newThreshold"
                        :label="t('alerts.threshold')"
                        type="number"
                        density="compact"
                        hide-details
                        variant="outlined"
                        style="max-width: 100px; flex: 1;"
                    />
                </div>
                <div class="d-flex ga-2 align-end">
                    <v-text-field
                        v-model="newSensorId"
                        :label="t('alerts.stationId')"
                        :placeholder="t('alerts.allStations')"
                        density="compact"
                        hide-details
                        variant="outlined"
                        clearable
                        style="flex: 1;"
                    />
                    <v-btn
                        color="primary"
                        variant="flat"
                        density="compact"
                        @click="addRule"
                    >
                        <v-icon>mdi-plus</v-icon>
                    </v-btn>
                </div>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn
                    variant="text"
                    @click="show = false"
                >
                    {{ t("alerts.close") }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
