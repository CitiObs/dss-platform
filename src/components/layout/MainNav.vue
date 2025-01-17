<script setup>
import { useTranslateRoute } from "@/composables/useTranslateRoute.js";

const navItems = [
    {
        name: "home",
        path: "/",
    },
    {
        name: "information",
        path: "/information",
    },
    {
        name: "about",
        path: "/about",
    },
    {
        name: "wearables",
        path: "/wearables",
    },
    {
        name: "showcase",
        path: "/showcase",
    },
];
</script>

<template>
    <v-list
        nav
        class="d-flex main-nav gc-4"
        variant="text"
        density="compact"
    >
        <v-list-item
            v-for="item in navItems"
            :key="item"
            :to="item.path"
            :title="useTranslateRoute(item.name)"
            class="py-1 mb-0 text-regular main-nav__list-item"
        />
    </v-list>
</template>

<style scoped lang="scss">
.main-nav {
    &__list-item {
        & :deep(.v-list-item-title ) {
            font-size: inherit;
            overflow: visible;
        }
    }
}
</style>
