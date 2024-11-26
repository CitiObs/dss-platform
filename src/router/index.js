import { createRouter, createWebHistory } from "vue-router";
import routes from "./routes";
import { useTitle } from "@/composables/useTitle.js";

const { setTitle } = useTitle();

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    // linkExactActiveClass: "text-primary-500",
});

router.afterEach((to) => {
    setTitle(to.meta.title);
});

export default router;
