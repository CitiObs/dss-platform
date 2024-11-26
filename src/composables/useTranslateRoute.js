import { useI18n } from "vue-i18n";

export const useTranslateRoute = (routeName) => {
    const { t } = useI18n();
    const translatedRoute = `routes.${routeName}`;
    return t(translatedRoute);
};
