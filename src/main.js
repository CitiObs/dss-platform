/* eslint no-unused-vars: "off" */
// Styles
import "./assets/scss/main.scss";
import "@mdi/font/css/materialdesignicons.css";
import "highlight.js/styles/atom-one-light.css";
import "@vuepic/vue-datepicker/dist/main.css";

// Generic
import { createApp } from "vue";
import App from "./App.vue";
import { CONFIG } from "./common/config";
import { createPinia } from "pinia";
import router from "@/router";
import vuetify from "@/plugins/vuetify";
import VueApexCharts from "vue3-apexcharts";
import OpenLayersMap from "vue3-openlayers";
import VueDatePicker from "@vuepic/vue-datepicker";
import dayjs from "@/plugins/dayjs";

// Geoint
import geoint from "@/plugins/geoint/geoint";
import i18n from "@/plugins/geoint/i18n";
import keycloakVue from "@/plugins/geoint/keycloak";

createApp(App)
    .use(createPinia())
    .use(router)
    .use(i18n)
    .use(vuetify)
    .use(geoint)
    .use(OpenLayersMap)
    .use(VueApexCharts)
    // .use(keycloakVue, {
    //     ...CONFIG.keycloak_options,
    //     onTokenRefresh: (keycloak) => {
    //         geoint.apiClient("geoint-api").defaults.headers["Authorization"] = `Bearer ${keycloak.token}`;
    //         geoint.apiClient("wfs").defaults.headers["Authorization"] = `Bearer ${keycloak.token}`;
    //     },
    // })
    .mount("#app");
