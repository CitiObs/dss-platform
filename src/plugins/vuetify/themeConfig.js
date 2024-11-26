// ======= Shared Colors Across Both Themes ======= //
const sharedColors = {
    primary: "#1976D2",
    secondary: "#00BD9D",
    accent: "#D27519",
    info: "#2196F3",
    success: "#4CAf50",
    error: "#FF5252",
    warning: "#FFC107",
};

// ======= Light Theme Colors ======= //
const light = {
    dark: false,
    colors: {
        ...sharedColors,
        background: "#fefefe",
        surface: "#fafafa",
        "on-surface": "#212121",
        "surface-light": "#eeeeee",
    },
};

// ======= Dark Theme Colors ======= //
const dark = {
    dark: true,
    colors: {
        ...sharedColors,
        background: "#222",
        surface: "#3f3f3f",
        "on-surface": "#fafafa",
        "surface-light": "#4a4a4a",
    },
};

const variations = {
    colors: ["primary", "secondary", "accent", "info", "success", "warning", "error"], //Here you define which colors should have variations as well as how many dark/light variation each color should have
    lighten: 3,
    darken: 4,
};

export default {
    defaultTheme: "light",
    variations,
    themes: {
        light,
        dark,
    },
};
