<script setup>
import { useRoute } from "vue-router";
import { useTranslateRoute } from "@/composables/useTranslateRoute.js";
import LayoutDefault from "@/layouts/LayoutDefault.vue";

const route = useRoute();
</script>

<template>
    <LayoutDefault>
        <h1 class="mb-10">
            {{ useTranslateRoute(route.name) }}
        </h1>
    </LayoutDefault>
</template>
