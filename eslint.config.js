const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  {
    files: ["eslint.config.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly"
      }
    }
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest"
      },
      globals: {
        AbortController: "readonly",
        Buffer: "readonly",
        Response: "readonly",
        TextDecoder: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        fetch: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        setTimeout: "readonly",
        URL: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "off"
    }
  }
];
