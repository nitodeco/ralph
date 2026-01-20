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
				{ blankLine: "always", prev: "*", next: "return" },
				{ blankLine: "always", prev: ["const", "let", "var"], next: "*" },
				{ blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
				{ blankLine: "always", prev: "directive", next: "*" },
				{ blankLine: "always", prev: "block-like", next: "*" },
				{ blankLine: "always", prev: "*", next: "block-like" },
			],
		},
	},
];
