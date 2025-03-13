import { Scale, createScaleItem } from "@geoint/geoint-vue";

export const SENSOR_DEFINITIONS = {
    airTemperature: {
        label: "Air Temperature",
        link: "http://vocabs.lter-europe.net/EnvThes/22035",
        scale: new Scale([
            createScaleItem("(35,)", { color: "#d71d1d", label: "35.." }),
            createScaleItem("(30,35]", { color: "#e15033", label: "30..35" }),
            createScaleItem("(25,30]", { color: "#ef8f5d", label: "25..30" }),
            createScaleItem("(20,25]", { color: "#f8bf82", label: "20..25" }),
            createScaleItem("(15,20]", { color: "#fce19d", label: "15..20" }),
            createScaleItem("(10,15]", { color: "#fef0a9", label: "10..15" }),
            createScaleItem("(5,10]", { color: "#d2e9f1", label: "5..10" }),
            createScaleItem("(0,5]", { color: "#a9d0ec", label: "0..5" }),
            createScaleItem("(-5,0]", { color: "#7daed4", label: "-5..0" }),
            createScaleItem("(-10,-5]", { color: "#4287bb", label: "-10..-5" }),
            createScaleItem("(-100,-10]", { color: "#0c72b0", label: "-10.." }),
        ]),
    },
    relativeHumidity: {
        label: "Relative Humidity",
        link: "http://vocabs.lter-europe.net/EnvThes/21579",
        scale: new Scale([
            createScaleItem("(90,)", { color: "#006ec2", label: "90..100" }),
            createScaleItem("(80,90]", { color: "#2e86cd", label: "80..90" }),
            createScaleItem("(70,80]", { color: "#64b1e0", label: "70..80" }),
            createScaleItem("(60,70]", { color: "#90d6ee", label: "60..70" }),
            createScaleItem("(50,60]", { color: "#befefd", label: "50..60" }),
            createScaleItem("(40,50]", { color: "#e0e8c4", label: "40..50" }),
            createScaleItem("(30,40]", { color: "#f5bc6a", label: "30..40" }),
            createScaleItem("(20,30]", { color: "#d6954a", label: "20..30" }),
            createScaleItem("(10,20]", { color: "#b26823", label: "10..20" }),
            createScaleItem("(-100,10)", { color: "#9e4f05", label: "0..10" }),
        ]),
    },
    ambientLight: {
        label: "Ambient Light",
        link: "https://qudt.org/vocab/quantitykind/LuminousExposure",
    },
    barometricPressure: {
        label: "Barometric Pressure",
        link: "https://vocabs.lter-europe.net/EnvThes/22060",
    },
    noiseLevel: {
        label: "Noise Level",
        link: "https://qudt.org/vocab/quantitykind/SoundExposureLevel",
    },
    pm1: {
        label: "PM 1",
        link: "https://dd.eionet.europa.eu/vocabularyconcept/aq/pollutant/6002",
    },
    pm25: {
        label: "PM 2.5",
        link: "https://www.eea.europa.eu/help/glossary/eea-glossary/pm2.5",
    },
    pm10: {
        label: "PM 10",
        link: "https://www.eea.europa.eu/help/glossary/eea-glossary/pm10",
    },
};
