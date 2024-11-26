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
        class="d-flex"
        variant="text"
        density="compact"
    >
        <v-list-item
            v-for="item in navItems"
            :key="item"
            :to="item.path"
            :title="useTranslateRoute(item.name)"
            class="py-1"
        />
    </v-list>
</template>
