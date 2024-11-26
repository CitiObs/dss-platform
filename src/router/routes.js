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
    {
        path: "/information",
        name: "information",
        component: () => import("@/views/InformationView.vue"),
        meta: {
            title: t("routes.information"),
        },
    },
    {
        path: "/about",
        name: "about",
        component: () => import("@/views/AboutView.vue"),
        meta: {
            title: t("routes.about"),
        },
    },
    {
        path: "/wearables",
        name: "wearables",
        component: () => import("@/views/WearablesView.vue"),
        meta: {
            title: t("routes.wearables"),
        },
    },
    {
        path: "/showcase",
        name: "showcase",
        component: () => import("@/views/ShowcaseView.vue"),
        meta: {
            title: t("routes.showcase"),
        },
    },
];
