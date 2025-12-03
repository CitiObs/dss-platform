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
    // Resolve the page title: call the function if meta.title is dynamic,
    // otherwise use the static value
    const title = typeof to.meta.title === "function" ? to.meta.title() : to.meta.title;

    setTitle(title);
});

export default router;
