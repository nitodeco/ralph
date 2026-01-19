import { VERSION } from "../index.ts";
import {
	compareVersions,
	fetchLatestVersion,
	getArchitecture,
	getOperatingSystem,
	performUpdate,
} from "../lib/update.ts";

export async function updateCommand(): Promise<void> {
	console.log("Checking for updates...");
	console.log("");

	try {
		const operatingSystem = getOperatingSystem();
		const architecture = getArchitecture();
		const latestVersion = await fetchLatestVersion();
		const currentVersion = VERSION;

		console.log(`  Current version: ${currentVersion}`);
		console.log(`  Latest version:  ${latestVersion}`);
		console.log(`  OS:              ${operatingSystem}`);
		console.log(`  Architecture:    ${architecture}`);
		console.log("");

		const comparison = compareVersions(currentVersion, latestVersion);

		if (comparison <= 0) {
			console.log("Ralph is already up to date.");
			return;
		}

		await performUpdate(latestVersion);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${errorMessage}`);
		process.exit(1);
	}
}
