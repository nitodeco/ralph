import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Prd } from "../types.ts";

export const RALPH_DIR = ".ralph";
export const PROGRESS_FILE_PATH = `${RALPH_DIR}/progress.txt`;
const PRD_JSON_PATH = `${RALPH_DIR}/prd.json`;
const PRD_YAML_PATH = `${RALPH_DIR}/prd.yaml`;

export function ensureRalphDirExists(): void {
	if (!existsSync(RALPH_DIR)) {
		mkdirSync(RALPH_DIR, { recursive: true });
	}
}

export function findPrdFile(): string | null {
	if (existsSync(PRD_JSON_PATH)) {
		return PRD_JSON_PATH;
	}
	if (existsSync(PRD_YAML_PATH)) {
		return PRD_YAML_PATH;
	}
	return null;
}

export function loadPrd(): Prd | null {
	const prdPath = findPrdFile();
	if (!prdPath) {
		return null;
	}

	const content = readFileSync(prdPath, "utf-8");

	if (prdPath.endsWith(".yaml") || prdPath.endsWith(".yml")) {
		return parseYaml(content) as Prd;
	}

	return JSON.parse(content) as Prd;
}

export function savePrd(prd: Prd, format: "json" | "yaml" = "json"): void {
	const prdPath = findPrdFile();
	const targetPath = prdPath ?? (format === "yaml" ? PRD_YAML_PATH : PRD_JSON_PATH);

	if (targetPath.endsWith(".yaml") || targetPath.endsWith(".yml")) {
		writeFileSync(targetPath, stringifyYaml(prd));
	} else {
		writeFileSync(targetPath, JSON.stringify(prd, null, 2));
	}
}

export function isPrdComplete(prd: Prd): boolean {
	return prd.tasks.every((task) => task.done);
}

export function getNextTask(prd: Prd): string | null {
	const nextTask = prd.tasks.find((task) => !task.done);
	return nextTask?.title ?? null;
}

export function createEmptyPrd(projectName: string): Prd {
	return {
		project: projectName,
		tasks: [],
	};
}
