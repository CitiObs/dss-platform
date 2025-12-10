/* eslint no-unused-vars: "off" */
// Styles
import "@mdi/font/css/materialdesignicons.css";
import "highlight.js/styles/atom-one-light.css";
import "@vuepic/vue-datepicker/dist/main.css";
import "@geoint/geoint-vue/dist/geoint-vue.css";
import "@mdi/font/css/materialdesignicons.css";
import "@/assets/scss/main.scss";

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

createApp(App)
    .use(createPinia())
    .use(router)
    .use(i18n)
    .use(vuetify)
    .use(geoint)
    .use(OpenLayersMap)
    .use(VueApexCharts)
    .mount("#app");
