import HomeView from "@/views/HomeView.vue";
import i18n from "@/plugins/geoint/i18n.js";

const t = i18n.global.t;

export default [
    {
        path: "/",
        name: "home",
        component: HomeView,
        meta: {
            title: t("routes.home"),
        },
    },
];
