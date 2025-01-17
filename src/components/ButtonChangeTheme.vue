<script setup>
import { computed } from "vue";
import { useThemeStore } from "@/stores/themeStore.js";
import { GiBtn } from "@geoint/geoint-vue";

const themeStore = useThemeStore();

const buttonIcon = computed(() => {
    return themeStore.theme.name === "light" ? "mdi-weather-night" : "mdi-white-balance-sunny";
});

</script>

<template>
    <GiBtn
        :icon="buttonIcon"
        size="medium"
        color="grey"
        variant="outlined-high-contrast"
        class="border bg-transparent"
        @click="themeStore.toggleTheme()"
    />
</template>
