import { el, en } from "vuetify/locale";

const locale = {
    locale: localStorage.getItem("locale") || "en",
    fallback: "en",
    messages: {
        el,
        en,
    },
};

export default locale;
