import { CONFIG } from "@/common/config.js";

export function useTitle() {
    function setTitle(title) {
        let result = CONFIG.app_title;

        if (title) {
            result = `${title} | ${result}`;
        }

        document.title = result;
    }

    return {
        setTitle,
    };
}
