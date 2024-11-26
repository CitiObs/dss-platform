/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution");

const indentSize = 4;

module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
    },
    parser: "vue-eslint-parser",
    extends: [
        "eslint:recommended",
        "plugin:vue/vue3-essential",
        "plugin:vue/vue3-recommended",
        "plugin:json/recommended-with-comments",
    ],
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
    },
    plugins: ["vue"],
    settings: {
        "import/ignore": ["node_modules"],
        "prettier-vue": {
            usePrettierrc: true,
        },
    },
    globals: {
        process: "readonly",
        require: "readonly",
        module: true,
    },
    rules: {
        // =========== General =========== //
        indent: ["warn", indentSize, { SwitchCase: 1 }],
        "linebreak-style": ["warn", "unix"],
        quotes: ["warn", "double"],
        semi: ["warn", "always"],

        "no-empty": "warn",
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "no-cond-assign": ["warn", "always"],
        "no-multiple-empty-lines": [
            "warn",
            {
                max: 2,
                maxEOF: 0,
                maxBOF: 0,
            },
        ],

        // Disable
        "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
        "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
        "init-declarations": "off",
        "no-inline-comments": "off",
        camelcase: "off",

        // =========== Vue Specific =========== //
        "vue/script-indent": ["warn", indentSize],
        "vue/html-indent": [
            "warn",
            indentSize,
            {
                attribute: 1,
                baseIndent: 1,
                closeBracket: 0,
                alignAttributesVertically: true,
                ignores: [],
            },
        ],
        "vue/comment-directive": 0,
        "vue/no-v-model-argument": "off",
        "vue/no-v-html": "off",
        "vue/html-self-closing": [
            "warn",
            {
                html: {
                    void: "always",
                    normal: "never",
                },
                svg: "never",
            },
        ],
        "vue/require-default-prop": "off",
        "vue/component-name-in-template-casing": ["warn", "PascalCase"],
        "vue/multi-word-component-names": [
            "warn",
            {
                ignores: ["index", "default", "[id]"],
            },
        ],
        "vue/valid-v-slot": [
            "warn",
            {
                allowModifiers: true,
            },
        ],
        "vue/attributes-order": [
            "warn",
            {
                order: [
                    "DEFINITION",
                    "LIST_RENDERING",
                    "CONDITIONALS",
                    "RENDER_MODIFIERS",
                    "GLOBAL",
                    ["UNIQUE", "SLOT"],
                    "TWO_WAY_BINDING",
                    "OTHER_DIRECTIVES",
                    "OTHER_ATTR",
                    "EVENTS",
                    "CONTENT",
                ],
                alphabetical: false,
            },
        ],
    },
};
