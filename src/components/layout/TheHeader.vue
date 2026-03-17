<script setup>
import { ref } from "vue";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import { useAlertStore } from "@/stores/alertStore.js";
import { useAuthStore } from "@/stores/authStore.js";
import { useI18n } from "vue-i18n";
import MainNav from "./MainNav.vue";
import ProjectLogo from "@/components/ProjectLogo.vue";
import MenuChangeLocale from "@/components/MenuChangeLocale.vue";
import ButtonChangeTheme from "@/components/ButtonChangeTheme.vue";
import AlertRulesDialog from "@/components/AlertRulesDialog.vue";

const alertStore = useAlertStore();
const authStore = useAuthStore();
const { t } = useI18n();
const showAlertMenu = ref(false);
const showUserMenu = ref(false);
const showRulesDialog = ref(false);

function onAlertClick(alert) {
    alertStore.select(alert);
    showAlertMenu.value = false;
}

function formatTime(timeStr) {
    if (!timeStr) return "";
    const d = new Date(timeStr);
    return d.toLocaleString(undefined, {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}
</script>

<template>
    <v-app-bar
        :height="STYLES_CONFIG.header_height"
        class="shadow-dark px-5"
    >
        <ProjectLogo />

        <v-spacer />

        <!-- <MainNav /> -->

        <!-- <v-divider
            vertical
            inset
            class="mx-3 h-50 my-auto"
        /> -->

        <div class="d-flex align-center justify-space-around ga-2">
            <!-- Alert bell -->
            <v-menu
                v-model="showAlertMenu"
                :close-on-content-click="false"
                location="bottom end"
                max-width="380"
            >
                <template #activator="{ props }">
                    <v-btn
                        icon
                        variant="text"
                        v-bind="props"
                    >
                        <v-badge
                            v-if="alertStore.unreadCount > 0"
                            :content="alertStore.unreadCount"
                            color="error"
                        >
                            <v-icon>mdi-bell-ring</v-icon>
                        </v-badge>
                        <v-icon v-else>
                            mdi-bell-outline
                        </v-icon>
                    </v-btn>
                </template>

                <v-card>
                    <v-card-title class="d-flex align-center pa-3 pb-1">
                        <span class="gi-text-body-1 gi-font-weight-medium">
                            {{ t("alerts.title") }}
                        </span>
                        <v-spacer />
                        <v-btn
                            v-if="alertStore.unreadCount > 0"
                            variant="text"
                            size="small"
                            @click="alertStore.dismissAll()"
                        >
                            {{ t("alerts.dismissAll") }}
                        </v-btn>
                    </v-card-title>

                    <v-list
                        v-if="alertStore.activeAlerts.length > 0"
                        density="compact"
                        class="pa-1"
                        max-height="300"
                        style="overflow-y: auto;"
                    >
                        <v-list-item
                            v-for="alert in alertStore.activeAlerts"
                            :key="alert.id"
                            class="rounded"
                            style="cursor: pointer;"
                            @click="onAlertClick(alert)"
                        >
                            <template #prepend>
                                <v-icon
                                    color="warning"
                                    size="20"
                                    class="mr-2"
                                >
                                    mdi-alert
                                </v-icon>
                            </template>
                            <v-list-item-title class="gi-text-body-2">
                                {{ alert.sensorId }}: {{ alert.value }} {{ alert.unit }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="gi-text-caption">
                                {{ t("alerts.threshold") }}: {{ alert.threshold }} {{ alert.unit }} — {{ formatTime(alert.time) }}
                            </v-list-item-subtitle>
                            <template #append>
                                <v-btn
                                    icon
                                    variant="text"
                                    size="x-small"
                                    @click="alertStore.dismiss(alert.id)"
                                >
                                    <v-icon size="16">
                                        mdi-close
                                    </v-icon>
                                </v-btn>
                            </template>
                        </v-list-item>
                    </v-list>

                    <v-card-text
                        v-else
                        class="text-center gi-text-body-2 text-medium-emphasis"
                    >
                        {{ t("alerts.noAlerts") }}
                    </v-card-text>

                    <v-divider />
                    <v-card-actions>
                        <v-btn
                            v-if="authStore.isAuthenticated"
                            variant="text"
                            size="small"
                            class="text-none"
                            @click="showAlertMenu = false; showRulesDialog = true"
                        >
                            <v-icon
                                class="mr-1"
                                size="16"
                            >
                                mdi-cog
                            </v-icon>
                            {{ t("alerts.configureRules") }}
                        </v-btn>
                        <span
                            v-else
                            class="gi-text-caption text-medium-emphasis pa-2"
                        >
                            {{ t("alerts.loginRequired") }}
                        </span>
                    </v-card-actions>
                </v-card>
            </v-menu>

            <!-- Auth: Login / User menu -->
            <template v-if="authStore.initialized">
                <template v-if="authStore.isAuthenticated">
                    <v-menu
                        v-model="showUserMenu"
                        location="bottom end"
                    >
                        <template #activator="{ props }">
                            <v-btn
                                variant="text"
                                v-bind="props"
                                class="text-none"
                            >
                                <v-icon class="mr-1">
                                    mdi-account-circle
                                </v-icon>
                                {{ authStore.userName }}
                            </v-btn>
                        </template>
                        <v-card min-width="200">
                            <v-list density="compact">
                                <v-list-item @click="authStore.logout()">
                                    <template #prepend>
                                        <v-icon>mdi-logout</v-icon>
                                    </template>
                                    <v-list-item-title>{{ t("auth.logout") }}</v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-card>
                    </v-menu>
                </template>
                <template v-else>
                    <v-btn
                        variant="text"
                        class="text-none"
                        @click="authStore.login()"
                    >
                        <v-icon class="mr-1">
                            mdi-login
                        </v-icon>
                        {{ t("auth.login") }}
                    </v-btn>
                </template>
            </template>

            <!-- <ButtonChangeTheme /> -->
            <MenuChangeLocale />
        </div>
    </v-app-bar>

    <AlertRulesDialog v-model="showRulesDialog" />
</template>
