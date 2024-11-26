<script setup>
import { useThemeStore } from "@/stores/themeStore.js";
import { useLocaleStore } from "@/stores/localeStore.js";
import { GiToastNotification, apiStatus } from "@geoint/geoint-vue";
import geoint from "@/plugins/geoint/geoint";

const themeStore = useThemeStore();
const localeStore = useLocaleStore();

// ======== On Created ======== //
themeStore.initTheme();
localeStore.initLocale();
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
