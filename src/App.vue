<script setup>
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useThemeStore } from "@/stores/themeStore.js";
import { useLocaleStore } from "@/stores/localeStore.js";
import { useTitle } from "@/composables/useTitle.js";
import { GiToastNotification, apiStatus } from "@geoint/geoint-vue";
import geoint from "@/plugins/geoint/geoint";

const themeStore = useThemeStore();
const localeStore = useLocaleStore();
const { locale } = useI18n();
const route = useRoute();
const { setTitle } = useTitle();

// ======== On Created ======== //
themeStore.initTheme();
localeStore.initLocale();

// ======== Watch locale changes to update page title ======== //
watch(locale, () => {
    const title = typeof route.meta.title === "function"
        ? route.meta.title()
        : route.meta.title;

    if (title) {
        setTitle(title);
    }
});
</script>

<template>
    <div v-if="geoint.status.value === apiStatus.Pending">
        <div class="loader-container">
            Loading... <!-- You can implement a loader instead -->
        </div>
    </div>

    <div v-else>
        <RouterView />
        <GiToastNotification />
    </div>
</template>
