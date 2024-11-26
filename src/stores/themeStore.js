import { useTheme } from "vuetify";
import { defineStore } from "pinia";

export const useThemeStore = defineStore("theme", () => {
    const theme = useTheme();

    function setTheme(newTheme) {
        theme.global.name.value = newTheme;
    }

    function initTheme() {
        const startingTheme = localStorage.getItem("theme") || "light";
        setTheme(startingTheme);
    }

    function toggleTheme() {
        theme.global.current.value.dark ? setTheme("light") : setTheme("dark");
        localStorage.setItem("theme", theme.global.name.value);
    }

    return { theme, initTheme, setTheme, toggleTheme };
});
