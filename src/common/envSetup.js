import { Env } from "@geoint/geoint-vue";

const env = new Env();

env.set("VITE_APP_TITLE", import.meta.env.VITE_APP_TITLE);
env.set("VITE_API_URL", import.meta.env.VITE_API_URL);
env.set("VITE_GEOSERVER_URL", import.meta.env.VITE_GEOSERVER_URL);
env.set("VITE_KEYCLOAK_URL", import.meta.env.VITE_KEYCLOAK_URL);
env.set("VITE_KEYCLOAK_REALM", import.meta.env.VITE_KEYCLOAK_REALM);
env.set("VITE_KEYCLOAK_CLIENT_ID", import.meta.env.VITE_KEYCLOAK_CLIENT_ID);

export default env;
