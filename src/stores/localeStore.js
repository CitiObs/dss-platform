import { defineStore } from "pinia";
import { useI18n } from "vue-i18n";
import { useLocale as useVuetifyLocale } from "vuetify";
import dayjs from "@/plugins/dayjs";

export const useLocaleStore = defineStore("locale", () => {
    const { locale } = useI18n({ useScope: "global" });
    const { current: vuetifyLocale } = useVuetifyLocale();

    function initLocale() {
        const startingLocale = localStorage.getItem("locale") || "el";
        setLocale(startingLocale);
    }

    function setLocale(newLocale) {
        locale.value = newLocale;
        vuetifyLocale.value = newLocale;
        dayjs.locale(newLocale);
        localStorage.setItem("locale", newLocale);
    }

    return { locale, setLocale, initLocale };
});
