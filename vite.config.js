import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
        "geoint:scss": fileURLToPath(
            new URL("./node_modules/@geoint/geoint-vue/src/assets/scss/geoint/_index.scss", import.meta.url)
        ),
    },
    optimizeDeps: {
        include: [
            "pbf",
            "solar-calc",
            "base64-js",
            "js-sha256",
            "highlight.js/lib/core",
            "dayjs",
            "lodash/merge",
            "color-name",
            "roarr",
        ],
    },
    define: {
        // Replace feature flag globals with boolean literals
        __VUE_I18N_FULL_INSTALL__: false,
        __VUE_I18N_LEGACY_API__: false,
        __VUE_I18N_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: true,
    },
});
