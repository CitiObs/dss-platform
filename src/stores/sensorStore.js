import { defineStore } from "pinia";
import { FeatureCollection } from "@geoint/geoint-vue";

import GeoJSON from "ol/format/GeoJSON";
import LZString from "lz-string";

export const useSensorStore = defineStore("sensor", () => {
    const geojson = new GeoJSON();

    function setSensorData(sensorStorageKey, sensorData, date) {
        const key = encodeURIComponent(JSON.stringify(sensorStorageKey));
        const serialized = LZString.compress(geojson.writeFeatures(sensorData.all()));

        const dataToStore = {
            things: serialized,
            date: date,
        };

        localStorage.setItem(key, JSON.stringify(dataToStore));
    }

    function getSensorData(sensorStorageKey) {
        const key = encodeURIComponent(JSON.stringify(sensorStorageKey));
        const sensorData = JSON.parse(localStorage.getItem(key));

        try {
            const serialized = LZString.decompress(sensorData.things);
            const parse = JSON.parse(serialized);
            const features = geojson.readFeatures(parse);

            return {
                things: new FeatureCollection(features),
                date: sensorData.date,
            };
        } catch {
            return null;
        }
    }

    function clearSensorData(sensorStorageKey) {
        localStorage.removeItem(sensorStorageKey);
    }

    return { setSensorData, getSensorData, clearSensorData };
});
