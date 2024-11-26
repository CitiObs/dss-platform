<script setup>
import TheHeader from "@/components/layout/TheHeader.vue";
import TheFooter from "@/components/layout/TheFooter.vue";
</script>

<template>
    <v-app>
        <!-- Header -->
        <TheHeader />

        <!-- Main Content -->
        <v-main>
            <v-container class="px-md-10 py-5">
                <slot></slot>
            </v-container>
        </v-main>

        <!-- Footer -->
        <TheFooter />
    </v-app>
</template>
