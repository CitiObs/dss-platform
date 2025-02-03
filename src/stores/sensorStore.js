import { defineStore } from "pinia";
import { FeatureCollection } from "@geoint/geoint-vue";

import GeoJSON from "ol/format/GeoJSON";
import LZString from "lz-string";

export const useSensorStore = defineStore("sensor", () => {
    const geojson = new GeoJSON();

    function setSensorData(allSensors) {
        const serialized =  LZString.compress(geojson.writeFeatures(allSensors.all()));
        localStorage.setItem("sensorData", serialized);
    }

    function getSensorData() {
        const serialized = LZString.decompress(localStorage.getItem("sensorData"));
        try {
            const parsed = JSON.parse(serialized);
            const features = geojson.readFeatures(parsed);
            return new FeatureCollection(features);
        } catch {
            return new FeatureCollection();
        }
    }

    return { setSensorData, getSensorData };
});
