import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default [
    { files: ["**/*.{js,mjs,cjs,ts,tsx}"] },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    sonarjs.configs.recommended,
    {
        rules: {
            "sonarjs/no-duplicate-string": "off", // Often noisy in tests/constants
            "sonarjs/cognitive-complexity": ["warn", 15],
            "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "@typescript-eslint/no-explicit-any": "error"
        }
    },
    {
        ignores: ["dist/**", "coverage/**", "node_modules/**", "client/dist/**", "**/*.test.ts", "**/*.test.tsx", "src/tests/**"]
    }
];
