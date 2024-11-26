import "vuetify/styles";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import theme from "./themeConfig";
import locale from "./locale";

const vuetify = createVuetify({
    theme,
    components,
    directives,
    locale,
});

export default vuetify;
