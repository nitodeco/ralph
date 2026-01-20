import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { LoadPrdResult, Prd } from "@/types.ts";
import { createError, ErrorCode, formatError } from "../errors.ts";
import { PRD_JSON_PATH } from "../paths.ts";
import { isPrd } from "../type-guards.ts";

function findPrdFile(): string | null {
	if (existsSync(PRD_JSON_PATH)) {
		return PRD_JSON_PATH;
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
		const parsed: unknown = JSON.parse(content);

		if (!isPrd(parsed)) {
			return {
				prd: null,
				validationError: "PRD is missing required fields or has invalid structure",
			};
		}

		return { prd: parsed };
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

	save(prd: Prd): void {
		const prdPath = findPrdFile();
		const targetPath = prdPath ?? PRD_JSON_PATH;

		writeFileSync(targetPath, JSON.stringify(prd, null, 2));

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
