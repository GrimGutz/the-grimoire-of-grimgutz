import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Globals provided by Foundry VTT, D&D5e and the optional modules at runtime.
const foundryGlobals = Object.fromEntries(
  [
    "game",
    "ui",
    "canvas",
    "Hooks",
    "foundry",
    "CONFIG",
    "CONST",
    "Actor",
    "Item",
    "ActiveEffect",
    "ChatMessage",
    "Roll",
    "Token",
    "TokenDocument",
    "Combat",
    "Dialog",
    "MidiQOL",
    "fromUuid",
    "fromUuidSync",
    "renderTemplate",
    "dnd5e",
    "Scene",
    "JournalEntry",
    "Folder",
    "Macro",
    "User",
    "PIXI"
  ].map(name => [name, "readonly"])
);

export default [
  { ignores: ["node_modules/**", "packs/**", "dist/**", "tmp/**", "assets/**", "docs/**"] },
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...foundryGlobals }
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }]
    }
  },
  {
    files: ["tools/**/*.mjs", "tests/**/*.mjs", "src/**/*.mjs", "eslint.config.mjs"],
    // Tests install their own Foundry stubs on globalThis.
    languageOptions: { globals: { ...globals.node, ...foundryGlobals, fromUuid: "writable", fromUuidSync: "writable" } }
  },
  {
    // Type-aware rules for the runtime: a promise in a hook must be awaited or
    // handed to a reporter; `void promise` alone hides failures.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname }
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: false }],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }]
    }
  }
];
