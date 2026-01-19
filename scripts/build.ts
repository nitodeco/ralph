import { existsSync, readdirSync } from "node:fs";
import { mkdir, rm, unlink } from "node:fs/promises";
import { type BuildTarget, config } from "./build.config";

async function cleanupTempFiles(): Promise<void> {
	const tempFiles = readdirSync(".").filter((file) => file.endsWith(".bun-build"));
	for (const tempFile of tempFiles) {
		await unlink(tempFile);
	}
}

async function compileTarget(buildTarget: BuildTarget): Promise<boolean> {
	const outputPath = `${config.outDir}/${buildTarget.outputName}`;

	const bunProcess = Bun.spawn(
		[
			"bun",
			"build",
			config.entryPoint,
			"--compile",
			`--target=${buildTarget.target}`,
			`--outfile=${outputPath}`,
		],
		{
			stdout: "inherit",
			stderr: "inherit",
		},
	);

	const exitCode = await bunProcess.exited;

	if (exitCode !== 0) {
		console.error(`Failed to build for ${buildTarget.name}`);
		return false;
	}

	console.log(`  -> ${outputPath}\n`);
	return true;
}

async function build(): Promise<void> {
	console.log("Building Ralph CLI...\n");

	if (existsSync(config.outDir)) {
		await rm(config.outDir, { recursive: true });
	}
	await mkdir(config.outDir);

	for (const buildTarget of config.targets) {
		console.log(`Building for ${buildTarget.name}...`);
		const success = await compileTarget(buildTarget);
		if (!success) {
			process.exit(1);
		}
	}

	await cleanupTempFiles();

	console.log("Build complete!");
	console.log(`\nBinaries are in the '${config.outDir}' directory.`);
}

build();
