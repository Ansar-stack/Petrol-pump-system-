// eslint.config.js — ESLint flat config (ESLint 9+)
// Pure JavaScript project: React · React Router DOM · Redux Toolkit
// React Query · React Hook Form · Zod · Tailwind CSS · React Icons
// React Hot Toast · Recharts · date-fns · JSON data · react-to-print · jsPDF

import js from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactRefresh from "eslint-plugin-react-refresh";
import pluginImport from "eslint-plugin-import";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import configPrettier from "eslint-config-prettier";

export default [
  // ── Global ignores ────────────────────────────────────────
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      "public/**",
      "db.json",
      "*.min.js",
      "vite.config.ts",
      "vite.config.js",
      "tailwind.config.js",
      "postcss.config.js",
      ".rules/**",
      "src/components/ui/**",
    ],
  },

  // ── Base JS recommended rules ──────────────────────────────
  js.configs.recommended,

  // ── React flat config (JSX runtime) ───────────────────────
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat["jsx-runtime"],

  // ── React + Hooks + Refresh + Import + A11y ───────────────
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      "react-hooks": pluginReactHooks,
      "react-refresh": pluginReactRefresh,
      import: pluginImport,
      "jsx-a11y": pluginJsxA11y,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Promise: "readonly",
        Math: "readonly",
        Date: "readonly",
        JSON: "readonly",
        parseInt: "readonly",
        parseFloat: "readonly",
        isNaN: "readonly",
        Array: "readonly",
        Object: "readonly",
        String: "readonly",
        Boolean: "readonly",
        Number: "readonly",
        crypto: "readonly",
        localStorage: "readonly",
        URLSearchParams: "readonly",
        URL: "readonly",
        Intl: "readonly",
      },
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        node: { extensions: [".js", ".jsx"] },
      },
    },
    rules: {
      // ── React ──────────────────────────────────────────────
      "react/prop-types": "off",
      "react/self-closing-comp": "warn",
      "react/no-array-index-key": "warn",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-useless-fragment": "warn",
      "react/jsx-curly-brace-presence": [
        "warn",
        { props: "never", children: "never" },
      ],

      // ── React Hooks ────────────────────────────────────────
      ...pluginReactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ── React Refresh ──────────────────────────────────────
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // ── Import ordering ────────────────────────────────────
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroups: [
            { pattern: "react", group: "external", position: "before" },
            { pattern: "react-dom/**", group: "external", position: "before" },
            {
              pattern: "react-router-dom",
              group: "external",
              position: "before",
            },
            { pattern: "@reduxjs/**", group: "external", position: "before" },
            { pattern: "react-redux", group: "external", position: "before" },
            { pattern: "@tanstack/**", group: "external", position: "before" },
            {
              pattern: "react-hook-form",
              group: "external",
              position: "before",
            },
            { pattern: "@hookform/**", group: "external", position: "before" },
            { pattern: "zod", group: "external", position: "before" },
            {
              pattern: "react-hot-toast",
              group: "external",
              position: "before",
            },
            { pattern: "react-icons/**", group: "external", position: "after" },
            { pattern: "recharts", group: "external", position: "after" },
            { pattern: "date-fns", group: "external", position: "after" },
            { pattern: "jspdf", group: "external", position: "after" },
            { pattern: "react-to-print", group: "external", position: "after" },
            { pattern: "@/store/**", group: "internal", position: "before" },
            { pattern: "@/services/**", group: "internal", position: "before" },
            { pattern: "@/components/ui/**", group: "internal" },
            { pattern: "@/components/**", group: "internal" },
            { pattern: "@/pages/**", group: "internal" },
            { pattern: "@/hooks/**", group: "internal" },
            { pattern: "@/lib/**", group: "internal" },
            { pattern: "@/**", group: "internal" },
          ],
          pathGroupsExcludedImportTypes: ["react", "react-dom"],
        },
      ],
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "import/first": "error",

      // ── Accessibility ──────────────────────────────────────
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/interactive-supports-focus": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",

      // ── General code quality ───────────────────────────────
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-nested-ternary": "warn",
      "no-unneeded-ternary": "warn",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "object-shorthand": "warn",
      "spaced-comment": ["warn", "always"],
    },
  },

  // ── Prettier — must be last ────────────────────────────────
  configPrettier,
];
