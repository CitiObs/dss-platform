import { defineStore } from "pinia";
import GeoJSON from "ol/format/GeoJSON";
import { FeatureCollection } from "@geoint/geoint-vue";

export const useSensorStore = defineStore("sensor", () => {
    const geojson = new GeoJSON();

    function setSensorData(allSensors) {
        const serialized = geojson.writeFeatures(allSensors.all());
        localStorage.setItem("sensorData", serialized);
    }

    function getSensorData() {
        const serialized = localStorage.getItem("sensorData");
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
