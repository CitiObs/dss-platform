<script setup>
import { useRoute } from "vue-router";
import { useTranslateRoute } from "@/composables/useTranslateRoute.js";
import { GiWeatherSummary, useGiToastNotificationsStore } from "@geoint/geoint-vue";
import NoData from "@/components/NoData.vue";
import LayoutDefault from "@/layouts/LayoutDefault.vue";

const route = useRoute();

const notificationsStore = useGiToastNotificationsStore();
</script>

<template>
    <LayoutDefault>
        <h1 class="mb-10">
            {{ useTranslateRoute(route.name) }}
        </h1>

        <!-- GiWeatherSummary Component -->
        <v-row>
            <v-col
                cols="12"
                sm="6"
            >
                <h2 class="text-h5 font-weight-bold py-2">
                    &lt;GiWeatherSummary /&gt; Component
                </h2>
                <v-card :title="$t('weatherSummary')">
                    <v-card-text class="mt-4">
                        <GiWeatherSummary
                            :horizontal="false"
                            :timestamp="'2023-09-22T11:00:00Z'"
                            :coords="[22.953, 40.582]"
                            :show-hours="true"
                            :temperature="15"
                            :temperature-min="4"
                            :temperature-options="{ lowerColor: '#38bdf8'}"
                            :total-cloudiness="80"
                            :precipitation="3"
                            :wind-speed="4"
                            :wind-direction="55"
                            :relative-humidity="60"
                            :uv-index="5"
                        />
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- NoData Component -->
        <v-row class="my-5">
            <v-col
                cols="12"
                sm="6"
            >
                <h2 class="text-h5 font-weight-bold py-2">
                    &lt;NoData /&gt; Component
                </h2>

                <NoData
                    size="h5"
                    justify="start"
                />
            </v-col>
        </v-row>

        <!-- Toast Notification -->
        <v-row class="my-5">
            <v-col
                cols="12"
                sm="6"
            >
                <v-btn
                    class="bg-success"
                    @click="notificationsStore.displaySuccess({
                        title: 'Success',
                        text: 'this is a success message'
                    })"
                >
                    Success Notification
                </v-btn>
            </v-col>
        </v-row>
    </LayoutDefault>
</template>
