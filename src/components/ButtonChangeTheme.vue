<script setup>
import { useThemeStore } from "@/stores/themeStore.js";

const themeStore = useThemeStore();
</script>

<template>
    <v-btn
        icon="mdi-theme-light-dark"
        variant="text"
        class="text-medium-emphasis"
        @click="themeStore.toggleTheme()"
    />
</template>
