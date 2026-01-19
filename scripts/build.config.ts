export const config = {
	entryPoint: "src/index.ts",
	outDir: "dist",
	targets: [
		{
			name: "macOS ARM64",
			target: "bun-darwin-arm64",
			outputName: "ralph-darwin-arm64",
		},
		{
			name: "macOS x64",
			target: "bun-darwin-x64",
			outputName: "ralph-darwin-x64",
		},
	],
} as const;

export type BuildTarget = (typeof config.targets)[number];
