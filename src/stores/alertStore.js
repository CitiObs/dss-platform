import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { SENSOR_DEFINITIONS } from "@/common/sensorDefinitions.js";

const STORAGE_PREFIX = "citiobs_alert_rules_";

function storageKey(userId) {
    return STORAGE_PREFIX + (userId || "anonymous");
}

export const useAlertStore = defineStore("alerts", () => {
    const rules = ref([]);
    const alerts = ref([]);
    const dismissed = ref(new Set());
    const selectedAlert = ref(null);
    const rulesVersion = ref(0);

    const activeAlerts = computed(() =>
        alerts.value.filter(a => !dismissed.value.has(a.id))
    );

    const unreadCount = computed(() => activeAlerts.value.length);

    function loadRules(userId) {
        try {
            const saved = localStorage.getItem(storageKey(userId));
            rules.value = saved ? JSON.parse(saved) : [];
        } catch {
            rules.value = [];
        }
    }

    function saveRules(userId) {
        localStorage.setItem(storageKey(userId), JSON.stringify(rules.value));
    }

    function addRule(userId, rule) {
        // Station is required
        if (!rule.sensorId || !rule.sensorId.trim()) {
            console.warn("[alertStore] Cannot add rule: sensorId is required");
            return false;
        }
        
        rules.value.push({
            id: Date.now().toString(),
            metric: rule.metric,
            operator: rule.operator,
            threshold: Number(rule.threshold),
            unit: SENSOR_DEFINITIONS[rule.metric]?.unit || "",
            sensorId: rule.sensorId.trim(),
        });
        saveRules(userId);
        rulesVersion.value++;
        return true;
    }

    function removeRule(userId, ruleId) {
        rules.value = rules.value.filter(r => r.id !== ruleId);
        saveRules(userId);
        rulesVersion.value++;
    }

    function evaluate(features, metric) {
        const matchingRules = rules.value.filter(r => r.metric === metric);
        if (matchingRules.length === 0) return null;

        let totalNew = 0;
        let firstRule = matchingRules[0];

        for (const rule of matchingRules) {
            const newAlerts = [];

            for (const feature of features) {
                const sensorId = feature.get("id") || "Unknown";

                // Rule now REQUIRES a specific sensor (sensorId is mandatory)
                if (rule.sensorId !== sensorId) continue;

                // Use lastObservationResult (stored on feature from cache/API)
                const value = feature.get("lastObservationResult");
                if (value == null) continue;

                const exceeds = rule.operator === "gt"
                    ? value > rule.threshold
                    : value < rule.threshold;
                if (!exceeds) continue;
                const id = `${rule.id}_${sensorId}`;

                if (alerts.value.some(a => a.id === id)) continue;

                newAlerts.push({
                    id,
                    sensorId,
                    metric,
                    value,
                    threshold: rule.threshold,
                    operator: rule.operator,
                    unit: rule.unit,
                    time: new Date().toISOString(),  // Current time (we don't have phenomenonTime on features)
                    datastreamSelfLink: feature.get("datastreamSelfLink"),
                    selfLink: feature.get("selfLink"),
                });
            }

            if (newAlerts.length > 0) {
                alerts.value.push(...newAlerts);
                totalNew += newAlerts.length;
            }
        }

        return totalNew > 0
            ? { count: totalNew, threshold: firstRule.threshold, unit: firstRule.unit }
            : null;
    }

    function dismiss(alertId) {
        dismissed.value = new Set([...dismissed.value, alertId]);
    }

    function dismissAll() {
        dismissed.value = new Set(alerts.value.map(a => a.id));
    }

    function select(alert) {
        selectedAlert.value = alert;
    }

    function clear() {
        alerts.value = [];
        dismissed.value = new Set();
    }

    return {
        rules,
        alerts,
        activeAlerts,
        unreadCount,
        selectedAlert,
        rulesVersion,
        loadRules,
        addRule,
        removeRule,
        evaluate,
        dismiss,
        dismissAll,
        select,
        clear,
    };
});
