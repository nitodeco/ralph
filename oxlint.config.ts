import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
  },
  settings: {
    "jsx-a11y": {
      components: {},
      attributes: {},
    },
    next: {
      rootDir: [],
    },
    react: {
      formComponents: [],
      linkComponents: [],
      componentWrapperFunctions: [],
    },
    jsdoc: {
      ignorePrivate: false,
      ignoreInternal: false,
      ignoreReplacesDocs: true,
      overrideReplacesDocs: true,
      augmentsExtendsReplacesDocs: false,
      implementsReplacesDocs: false,
      exemptDestructuredRootsFromChecks: false,
      tagNamePreference: {},
    },
    vitest: {
      typecheck: false,
    },
  },
  env: {
    builtin: true,
  },
  globals: {},
  ignorePatterns: ["node_modules/**", "dist/**", "docs/**", "**/*.md"],
});
