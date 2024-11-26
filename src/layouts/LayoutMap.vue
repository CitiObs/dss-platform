<script setup>
import TheHeader from "@/components/layout/TheHeader.vue";
import TheFooter from "@/components/layout/TheFooter.vue";
</script>

<template>
    <v-app>
        <!-- Header -->
        <TheHeader />

        <!-- Drawer -->
        <slot name="drawer"></slot>

        <!-- Main Content -->
        <v-main>
            <v-container>
                <slot></slot>
            </v-container>
        </v-main>

        <!-- Footer -->
        <TheFooter />
    </v-app>
</template>
