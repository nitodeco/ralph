import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  tseslint.configs.base,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", next: "return", prev: "*" },
        { blankLine: "always", next: "*", prev: ["const", "let", "var"] },
        { blankLine: "any", next: ["const", "let", "var"], prev: ["const", "let", "var"] },
        { blankLine: "always", next: "*", prev: "directive" },
        { blankLine: "always", next: "*", prev: "block-like" },
        { blankLine: "always", next: "block-like", prev: "*" },
      ],
    },
  },
];
