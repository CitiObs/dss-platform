<script setup>
import LayersDrawer from "@/components/layout/LayersDrawer.vue";
import LayoutMap from "@/layouts/LayoutMap.vue";
</script>

<template>
    <LayoutMap>
        <template #drawer>
            <LayersDrawer />
        </template>

        <div class="text-center text-h1">
            Map
        </div>
    </LayoutMap>
</template>
