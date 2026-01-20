export const config = {
	entryPoint: "src/index.tsx",
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
		{
			name: "Linux ARM64",
			target: "bun-linux-arm64",
			outputName: "ralph-linux-arm64",
		},
		{
			name: "Linux x64",
			target: "bun-linux-x64",
			outputName: "ralph-linux-x64",
		},
	],
} as const;

export type BuildTarget = (typeof config.targets)[number];
