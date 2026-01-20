import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { LoadPrdResult, Prd } from "@/types.ts";
import { createError, ErrorCode, formatError } from "../errors.ts";
import { PRD_JSON_PATH, PRD_YAML_PATH } from "../paths.ts";

function findPrdFile(): string | null {
	if (existsSync(PRD_JSON_PATH)) {
		return PRD_JSON_PATH;
	}

	if (existsSync(PRD_YAML_PATH)) {
		return PRD_YAML_PATH;
	}

	return null;
}

function loadPrdFromDisk(): LoadPrdResult {
	const prdPath = findPrdFile();

	if (!prdPath) {
		return { prd: null };
	}

	try {
		const content = readFileSync(prdPath, "utf-8");

		let prd: Prd;

		if (prdPath.endsWith(".yaml") || prdPath.endsWith(".yml")) {
			prd = parseYaml(content) as Prd;
		} else {
			prd = JSON.parse(content) as Prd;
		}

		if (!prd.project) {
			return {
				prd: null,
				validationError: "PRD is missing required 'project' field",
			};
		}

		if (!Array.isArray(prd.tasks)) {
			return {
				prd: null,
				validationError: "PRD is missing required 'tasks' array",
			};
		}

		return { prd };
	} catch (parseError) {
		const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parsing error";

		return {
			prd: null,
			validationError: `Failed to parse PRD file: ${errorMessage}`,
		};
	}
}

class PrdServiceImpl {
	private cachedPrd: Prd | null = null;
	private cachedLoadResult: LoadPrdResult | null = null;

	get(verbose = false): Prd | null {
		if (this.cachedPrd !== null) {
			return this.cachedPrd;
		}

		return this.load(verbose);
	}

	load(verbose = false): Prd | null {
		const result = this.loadWithValidation();

		if (result.validationError) {
			const error = createError(ErrorCode.PRD_INVALID_FORMAT, result.validationError, {
				path: findPrdFile(),
			});

			console.error(formatError(error, verbose));
		}

		this.cachedPrd = result.prd;

		return result.prd;
	}

	loadWithValidation(): LoadPrdResult {
		if (this.cachedLoadResult !== null) {
			return this.cachedLoadResult;
		}

		this.cachedLoadResult = loadPrdFromDisk();
		this.cachedPrd = this.cachedLoadResult.prd;

		return this.cachedLoadResult;
	}

	reload(verbose = false): Prd | null {
		this.invalidate();

		return this.load(verbose);
	}

	reloadWithValidation(): LoadPrdResult {
		this.invalidate();

		return this.loadWithValidation();
	}

	save(prd: Prd, format: "json" | "yaml" = "json"): void {
		const prdPath = findPrdFile();
		const targetPath = prdPath ?? (format === "yaml" ? PRD_YAML_PATH : PRD_JSON_PATH);

		if (targetPath.endsWith(".yaml") || targetPath.endsWith(".yml")) {
			writeFileSync(targetPath, stringifyYaml(prd));
		} else {
			writeFileSync(targetPath, JSON.stringify(prd, null, 2));
		}

		this.invalidate();
	}

	invalidate(): void {
		this.cachedPrd = null;
		this.cachedLoadResult = null;
	}

	findPrdFile(): string | null {
		return findPrdFile();
	}
}

export const PrdService = new PrdServiceImpl();
