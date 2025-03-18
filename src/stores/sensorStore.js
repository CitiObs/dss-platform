import { defineStore } from "pinia";
import { FeatureCollection } from "@geoint/geoint-vue";
import { useGiScheduler } from "@geoint/geoint-vue";

import GeoJSON from "ol/format/GeoJSON";
import LZString from "lz-string";

const EXPIRATION = 1000 * 60 * 2; // 2 minutes

function generateKey(input) {
    return "cache:" + encodeURIComponent(JSON.stringify(input));
}

export const useSensorStore = defineStore("sensor", () => {
    const geojson = new GeoJSON();
    const scheduler = useGiScheduler();

    function setSensorData(sensorStorageKey, sensorData, date) {
        const key = generateKey(sensorStorageKey);
        const serialized = LZString.compress(geojson.writeFeatures(sensorData.all()));

        const dataToStore = {
            things: serialized,
            date: date,
        };

        localStorage.setItem(key, JSON.stringify(dataToStore));
    }

    function getSensorData(sensorStorageKey) {
        const key = generateKey(sensorStorageKey);
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

    function cleanUp() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);

            // Skip non-cache keys
            if (key.indexOf("cache:") !== 0) {
                continue;
            }

            try {
                const parsed = JSON.parse(localStorage.getItem(key));
                const dateCreated = new Date(parsed.date);
                const now = new Date();
                const lifetime = now - dateCreated;
                if (lifetime > EXPIRATION) {
                    localStorage.removeItem(key);
                }
            } catch {
                continue;
            }
        }
    }

    scheduler.schedule(cleanUp, { seconds: 30 });

    return { setSensorData, getSensorData, clearSensorData };
});
