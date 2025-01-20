import { createGeoint, createAxios } from "@geoint/geoint-vue";
import { CONFIG } from "@/common/config";

const geoint = createGeoint();

geoint.registerApi("geoint-api", createAxios({ baseURL: CONFIG.api_url }));
geoint.registerApi("wfs", createAxios({ baseURL: CONFIG.geoserver_url }));
geoint.registerApi("virtualair", createAxios());

export default geoint;
