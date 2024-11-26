import env from "./envSetup";

export const CONFIG = {
    app_title: env.get("VITE_APP_TITLE"),
    api_url: env.get("VITE_API_URL"),
    geoserver_url: env.get("VITE_GEOSERVER_URL"),
    geoserver_date_format: "YYYY-MM-DD",
    mobile_breakpoint: 1280,

    // Keycloak
    keycloak_options: {
        url: env.get("VITE_KEYCLOAK_URL"),
        realm: env.get("VITE_KEYCLOAK_REALM"),
        client_id: env.get("VITE_KEYCLOAK_CLIENT_ID"),
        default_initials: "--",
        mount: "#app",
    },
};
