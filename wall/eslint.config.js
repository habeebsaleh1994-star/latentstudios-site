import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
export default tseslint.config(
  { ignores: ["dist", "design/shared/studio.js"] },
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // the matrix sends code to the browser as well as running in node
    files: ["scripts/matrix.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // the templates are plain browser scripts; their tools run in node
    files: ["design/**/*.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser, LatentStudio: "readonly" } },
  },
  {
    // browser tests drive the page from node and send code into it
    files: ["tests/browser/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["design/**/tools/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  ...tseslint.configs.recommended,
  {
    // terse browser scripts: empty catches for private windows, short-circuit calls
    files: ["design/**/*.js"],
    rules: { "no-empty": "off", "@typescript-eslint/no-unused-vars": "off", "@typescript-eslint/no-unused-expressions": "off" },
  },
);
