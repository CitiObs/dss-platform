import i18n from "@/plugins/geoint/i18n.js";
import { Scale, createScaleItem } from "@geoint/geoint-vue";

const t = i18n.global.t;

const commonCases = [
    createScaleItem("[-99999,-999999]", { color: "#00000000", label: "" }),
    createScaleItem("[-99999,-999999]", { color: "#8a8888", label: t("sensor.oldData") }),
    createScaleItem("[-99999,-999999]", { color: "#000000", label: t("sensor.noData") }),
];

export const SENSOR_ICONS = {
    airTemperature: "mdi-thermometer",
    relativeHumidity: "mdi-water-percent",
    atmosphericPressure: "mdi-gauge",
    pm25: "mdi-grain",
    pm10: "mdi-grain",
    no2: "mdi-grain",
    caqi: "mdi-air-filter",
};

export const SENSOR_DEFINITIONS = {
    airTemperature: {
        label: () => t("gi.metrics.temperature"),
        unit: "°C",
        icon: SENSOR_ICONS.airTemperature,
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
            createScaleItem("(-100,-10]", { color: "#0c72b0", label: "..-10" }),
            ...commonCases,
        ]),
    },
    relativeHumidity: {
        label: () => t("gi.metrics.relative_humidity"),
        unit: "%RH",
        icon: SENSOR_ICONS.relativeHumidity,
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
            ...commonCases,
        ]),
    },
    atmosphericPressure: {
        label: () => t("gi.metrics.pressure"),
        unit: "kPa",
        icon: SENSOR_ICONS.atmosphericPressure,
        link: "https://qudt.org/vocab/quantitykind/Pressure",
        scale: new Scale([
            createScaleItem("(103,)", { color: "#ff0000", label: "103.." }),
            createScaleItem("(102,103]", { color: "#ef0074", label: "102..103" }),
            createScaleItem("(101,102]", { color: "#ce00c6", label: "101..102" }),
            createScaleItem("(100,101]", { color: "#a216eb", label: "100..101" }),
            createScaleItem("(99,100]", { color: "#6d41e6", label: "99..100" }),
            createScaleItem("(0,99]", { color: "#005bbd", label: "..99" }),
            ...commonCases,
        ]),
    },
    pm25: {
        label: () => t("gi.metrics['pm2.5']"),
        unit: "µg/m³",
        icon: SENSOR_ICONS.pm25,
        link: "https://www.eea.europa.eu/help/glossary/eea-glossary/pm2.5",
        scale: new Scale([
            createScaleItem("(120,)", { color: "#60007a", label: "120.." }),
            createScaleItem("(100,120]", { color: "#960050", label: "100..120" }),
            createScaleItem("(80,100]", { color: "#b7295d", label: "80..100" }),
            createScaleItem("(60,80]", { color: "#ff9844", label: "60..80" }),
            createScaleItem("(40,60]", { color: "#ffda55", label: "40..60" }),
            createScaleItem("(20,40]", { color: "#dadd60", label: "20..40" }),
            createScaleItem("(10,20]", { color: "#82dd65", label: "10..20" }),
            createScaleItem("(-100,10]", { color: "#27dd67", label: "..10" }),
            ...commonCases,
        ]),
    },
    pm10: {
        label: () => t("gi.metrics.pm10"),
        unit: "µg/m³",
        icon: SENSOR_ICONS.pm10,
        link: "https://www.eea.europa.eu/help/glossary/eea-glossary/pm10",
        scale: new Scale([
            createScaleItem("(120,)", { color: "#60007a", label: "120.." }),
            createScaleItem("(100,120]", { color: "#960050", label: "100..120" }),
            createScaleItem("(80,100]", { color: "#b7295d", label: "80..100" }),
            createScaleItem("(60,80]", { color: "#ff9844", label: "60..80" }),
            createScaleItem("(40,60]", { color: "#ffda55", label: "40..60" }),
            createScaleItem("(20,40]", { color: "#dadd60", label: "20..40" }),
            createScaleItem("(10,20]", { color: "#82dd65", label: "10..20" }),
            createScaleItem("(-100,10]", { color: "#27dd67", label: "..10" }),
            ...commonCases,
        ]),
    },
    no2: {
        label: () => t("gi.metrics.nitrogen_dioxide"),
        unit: "µg/m³",
        icon: SENSOR_ICONS.no2,
        link: "https://vocabs.lter-europe.net/envthes/en/page/20842",  // lowercase 'envthes' - API is case-sensitive
        scale: new Scale([
            createScaleItem("(400,)", { color: "#7e0023", label: "400.." }),
            createScaleItem("(200,400]", { color: "#8f3f97", label: "200..400" }),
            createScaleItem("(120,200]", { color: "#ff0000", label: "120..200" }),
            createScaleItem("(80,120]", { color: "#ff7e00", label: "80..120" }),
            createScaleItem("(40,80]", { color: "#ffff00", label: "40..80" }),
            createScaleItem("(0,40]", { color: "#00e400", label: "..40" }),
            ...commonCases,
        ]),
    },
    caqi: {
        label: () => t("sensor.caqi"),
        unit: "",
        icon: SENSOR_ICONS.caqi,
        link: null,  // Computed index — no ObservedProperty in API
        scale: new Scale([
            createScaleItem("(100,)", { color: "#960032", label: "> 100" }),
            createScaleItem("(75,100]", { color: "#ff5050", label: "75..100" }),
            createScaleItem("(50,75]", { color: "#f0e641", label: "50..75" }),
            createScaleItem("(25,50]", { color: "#50ccaa", label: "25..50" }),
            createScaleItem("(0,25]", { color: "#50f0e6", label: "0..25" }),
            ...commonCases,
        ]),
    },
    // ambientLight: {
    //     label: "Ambient Light",
    //     link: "https://qudt.org/vocab/quantitykind/LuminousExposure",
    //     scale: new Scale([
    //         createScaleItem("(10000,)", { color: "#ffff00", label: "10K..100K" }),
    //         createScaleItem("(1000,10000]", { color: "#97f554", label: "1000..10K" }),
    //         createScaleItem("(100,1000]", { color: "#18dc82", label: "100..1000" }),
    //         createScaleItem("(10,100]", { color: "#00b599", label: "10..100" }),
    //         createScaleItem("(1,10]", { color: "#008b98", label: "1..10" }),
    //         createScaleItem("(.1,1]", { color: "#005f85", label: "0.1..1" }),
    //         createScaleItem("(-1,.1]", { color: "#002f61", label: "0..0.1" }),
    //         ...commonCases,
    //     ]),
    // },
    // noiseLevel: {
    //     label: "Noise Level",
    //     link: "https://qudt.org/vocab/quantitykind/SoundExposureLevel",
    //     scale: new Scale([
    //         createScaleItem("(120,)", { color: "#eb0000", label: "120.." }),
    //         createScaleItem("(100,120]", { color: "#f86f15", label: "100..120" }),
    //         createScaleItem("(80,100]", { color: "#ffd335", label: "80..100" }),
    //         createScaleItem("(60,80]", { color: "#ffff3d", label: "60..80" }),
    //         createScaleItem("(40,60]", { color: "#dcfb41", label: "40..60" }),
    //         createScaleItem("(20,40]", { color: "#83f341", label: "20..40" }),
    //         createScaleItem("(-10,20]", { color: "#00f03c", label: "..20" }),
    //         ...commonCases,
    //     ]),
    // },
    // pm1: {
    //     label: "PM 1",
    //     link: "https://dd.eionet.europa.eu/vocabularyconcept/aq/pollutant/6002",
    //     scale: new Scale([
    //         createScaleItem("(120,)", { color: "#60007a", label: "120.." }),
    //         createScaleItem("(80,100]", { color: "#b7295d", label: "80..100" }),
    //         createScaleItem("(60,80]", { color: "#ff9844", label: "60..80" }),
    //         createScaleItem("(40,60]", { color: "#ffda55", label: "40..60" }),
    //         createScaleItem("(20,40]", { color: "#dadd60", label: "20..40" }),
    //         createScaleItem("(10,20]", { color: "#82dd65", label: "10..20" }),
    //         createScaleItem("(-100,10]", { color: "#27dd67", label: "..10" }),
    //         ...commonCases,
    //     ]),
    // },
};

/**
 * EU CAQI (Common Air Quality Index) — hourly background index.
 * Linear interpolation between breakpoints; final score = max of sub-indices.
 *
 * Breakpoints (concentration µg/m³ → sub-index):
 *   NO2:  [0,50]→[0,25]  [50,100]→[25,50]  [100,200]→[50,75]  [200,400]→[75,100]
 *   PM10: [0,25]→[0,25]  [25,50]→[25,50]   [50,90]→[50,75]    [90,180]→[75,100]
 *   PM2.5:[0,15]→[0,25]  [15,30]→[25,50]   [30,55]→[50,75]    [55,110]→[75,100]
 */
const CAQI_BREAKPOINTS = {
    no2:  [[0, 50, 0, 25], [50, 100, 25, 50], [100, 200, 50, 75], [200, 400, 75, 100]],
    pm10: [[0, 25, 0, 25], [25, 50, 25, 50],  [50, 90, 50, 75],   [90, 180, 75, 100]],
    pm25: [[0, 15, 0, 25], [15, 30, 25, 50],  [30, 55, 50, 75],   [55, 110, 75, 100]],
};

function caqiSubIndex(pollutant, concentration) {
    if (concentration == null || concentration < 0) return null;
    const bp = CAQI_BREAKPOINTS[pollutant];
    if (!bp) return null;
    for (const [cLow, cHigh, iLow, iHigh] of bp) {
        if (concentration <= cHigh) {
            return iLow + ((concentration - cLow) / (cHigh - cLow)) * (iHigh - iLow);
        }
    }
    // Above highest breakpoint — extrapolate linearly from last interval
    const last = bp[bp.length - 1];
    return last[3] + ((concentration - last[1]) / (last[1] - last[0])) * (last[3] - last[2]);
}

/**
 * Compute the EU CAQI from pollutant concentrations.
 * @param {{ no2?: number, pm10?: number, pm25?: number }} values
 * @returns {{ score: number, worstPollutant: string } | null}
 */
export function computeCAQI(values) {
    let maxIndex = -1;
    let worstPollutant = null;
    for (const [pollutant, conc] of Object.entries(values)) {
        const sub = caqiSubIndex(pollutant, conc);
        if (sub !== null && sub > maxIndex) {
            maxIndex = sub;
            worstPollutant = pollutant;
        }
    }
    if (worstPollutant === null) return null;
    return { score: Math.round(maxIndex), worstPollutant };
}
