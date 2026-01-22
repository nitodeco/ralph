import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GuardrailCategory, PromptGuardrail } from "@/types.ts";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "unknown";
export type TestFramework = "jest" | "vitest" | "mocha" | "bun" | "unknown";
export type Linter = "eslint" | "biome" | "unknown";
export type Formatter = "prettier" | "biome" | "unknown";
export type Framework = "react" | "nextjs" | "vue" | "svelte" | "angular" | "unknown";
export type BuildTool = "vite" | "webpack" | "turbopack" | "esbuild" | "parcel" | "unknown";

export interface CodebaseAnalysis {
	packageManager: PackageManager;
	hasTypeScript: boolean;
	testFramework: TestFramework;
	linter: Linter;
	formatter: Formatter;
	framework: Framework;
	buildTool: BuildTool;
	hasGitHooks: boolean;
	hasCi: boolean;
	hasDocker: boolean;
	hasMonorepo: boolean;
	detectedScripts: {
		build?: string;
		test?: string;
		lint?: string;
		format?: string;
		typecheck?: string;
	};
}

interface PackageJson {
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	packageManager?: string;
	workspaces?: string[] | { packages: string[] };
}

function readPackageJson(projectPath: string): PackageJson | null {
	const packageJsonPath = join(projectPath, "package.json");

	if (!existsSync(packageJsonPath)) {
		return null;
	}

	try {
		const content = readFileSync(packageJsonPath, "utf-8");

		return JSON.parse(content) as PackageJson;
	} catch {
		return null;
	}
}

function detectPackageManager(
	projectPath: string,
	packageJson: PackageJson | null,
): PackageManager {
	if (existsSync(join(projectPath, "bun.lockb")) || existsSync(join(projectPath, "bun.lock"))) {
		return "bun";
	}

	if (existsSync(join(projectPath, "pnpm-lock.yaml"))) {
		return "pnpm";
	}

	if (existsSync(join(projectPath, "yarn.lock"))) {
		return "yarn";
	}

	if (existsSync(join(projectPath, "package-lock.json"))) {
		return "npm";
	}

	if (packageJson?.packageManager) {
		const manager = packageJson.packageManager.split("@").at(0);

		if (manager === "bun" || manager === "pnpm" || manager === "yarn" || manager === "npm") {
			return manager;
		}
	}

	return "unknown";
}

function detectTypeScript(projectPath: string): boolean {
	return (
		existsSync(join(projectPath, "tsconfig.json")) ||
		existsSync(join(projectPath, "tsconfig.base.json"))
	);
}

function detectTestFramework(projectPath: string, packageJson: PackageJson | null): TestFramework {
	const allDeps = {
		...packageJson?.dependencies,
		...packageJson?.devDependencies,
	};

	if (allDeps.vitest) {
		return "vitest";
	}

	if (allDeps.jest || allDeps["@types/jest"]) {
		return "jest";
	}

	if (allDeps.mocha) {
		return "mocha";
	}

	if (existsSync(join(projectPath, "bun.lockb")) || existsSync(join(projectPath, "bun.lock"))) {
		const scripts = packageJson?.scripts ?? {};
		const hasTestScript = Object.values(scripts).some((script) => script.includes("bun test"));

		if (hasTestScript) {
			return "bun";
		}
	}

	if (
		existsSync(join(projectPath, "vitest.config.ts")) ||
		existsSync(join(projectPath, "vitest.config.js"))
	) {
		return "vitest";
	}

	if (
		existsSync(join(projectPath, "jest.config.ts")) ||
		existsSync(join(projectPath, "jest.config.js")) ||
		existsSync(join(projectPath, "jest.config.json"))
	) {
		return "jest";
	}

	return "unknown";
}

function detectLinter(projectPath: string, packageJson: PackageJson | null): Linter {
	const allDeps = {
		...packageJson?.dependencies,
		...packageJson?.devDependencies,
	};

	if (allDeps["@biomejs/biome"]) {
		return "biome";
	}

	if (allDeps.eslint) {
		return "eslint";
	}

	if (existsSync(join(projectPath, "biome.json")) || existsSync(join(projectPath, "biome.jsonc"))) {
		return "biome";
	}

	const eslintConfigs = [
		".eslintrc",
		".eslintrc.js",
		".eslintrc.cjs",
		".eslintrc.json",
		".eslintrc.yaml",
		".eslintrc.yml",
		"eslint.config.js",
		"eslint.config.mjs",
		"eslint.config.cjs",
	];

	for (const config of eslintConfigs) {
		if (existsSync(join(projectPath, config))) {
			return "eslint";
		}
	}

	return "unknown";
}

function detectFormatter(projectPath: string, packageJson: PackageJson | null): Formatter {
	const allDeps = {
		...packageJson?.dependencies,
		...packageJson?.devDependencies,
	};

	if (allDeps["@biomejs/biome"]) {
		return "biome";
	}

	if (allDeps.prettier) {
		return "prettier";
	}

	if (existsSync(join(projectPath, "biome.json")) || existsSync(join(projectPath, "biome.jsonc"))) {
		return "biome";
	}

	const prettierConfigs = [
		".prettierrc",
		".prettierrc.js",
		".prettierrc.cjs",
		".prettierrc.json",
		".prettierrc.yaml",
		".prettierrc.yml",
		"prettier.config.js",
		"prettier.config.cjs",
	];

	for (const config of prettierConfigs) {
		if (existsSync(join(projectPath, config))) {
			return "prettier";
		}
	}

	return "unknown";
}

function detectFramework(packageJson: PackageJson | null): Framework {
	const allDeps = {
		...packageJson?.dependencies,
		...packageJson?.devDependencies,
	};

	if (allDeps.next) {
		return "nextjs";
	}

	if (allDeps.vue) {
		return "vue";
	}

	if (allDeps.svelte || allDeps["@sveltejs/kit"]) {
		return "svelte";
	}

	if (allDeps["@angular/core"]) {
		return "angular";
	}

	if (allDeps.react) {
		return "react";
	}

	return "unknown";
}

function detectBuildTool(projectPath: string, packageJson: PackageJson | null): BuildTool {
	const allDeps = {
		...packageJson?.dependencies,
		...packageJson?.devDependencies,
	};

	if (allDeps.vite) {
		return "vite";
	}

	if (allDeps.webpack) {
		return "webpack";
	}

	if (allDeps.esbuild) {
		return "esbuild";
	}

	if (allDeps.parcel || allDeps["@parcel/core"]) {
		return "parcel";
	}

	if (
		existsSync(join(projectPath, "vite.config.ts")) ||
		existsSync(join(projectPath, "vite.config.js"))
	) {
		return "vite";
	}

	if (
		existsSync(join(projectPath, "webpack.config.js")) ||
		existsSync(join(projectPath, "webpack.config.ts"))
	) {
		return "webpack";
	}

	return "unknown";
}

function detectGitHooks(projectPath: string, packageJson: PackageJson | null): boolean {
	const allDeps = {
		...packageJson?.dependencies,
		...packageJson?.devDependencies,
	};

	if (allDeps.husky || allDeps["lint-staged"] || allDeps.lefthook) {
		return true;
	}

	if (existsSync(join(projectPath, ".husky"))) {
		return true;
	}

	if (
		existsSync(join(projectPath, "lefthook.yml")) ||
		existsSync(join(projectPath, "lefthook.yaml"))
	) {
		return true;
	}

	return false;
}

function detectCi(projectPath: string): boolean {
	const ciPaths = [
		join(projectPath, ".github", "workflows"),
		join(projectPath, ".gitlab-ci.yml"),
		join(projectPath, ".circleci"),
		join(projectPath, "Jenkinsfile"),
		join(projectPath, "azure-pipelines.yml"),
		join(projectPath, ".travis.yml"),
	];

	return ciPaths.some((ciPath) => existsSync(ciPath));
}

function detectDocker(projectPath: string): boolean {
	return (
		existsSync(join(projectPath, "Dockerfile")) ||
		existsSync(join(projectPath, "docker-compose.yml")) ||
		existsSync(join(projectPath, "docker-compose.yaml")) ||
		existsSync(join(projectPath, ".dockerignore"))
	);
}

function detectMonorepo(projectPath: string, packageJson: PackageJson | null): boolean {
	if (packageJson?.workspaces) {
		return true;
	}

	if (existsSync(join(projectPath, "pnpm-workspace.yaml"))) {
		return true;
	}

	if (existsSync(join(projectPath, "lerna.json"))) {
		return true;
	}

	if (existsSync(join(projectPath, "nx.json"))) {
		return true;
	}

	if (existsSync(join(projectPath, "turbo.json"))) {
		return true;
	}

	return false;
}

function detectScripts(packageJson: PackageJson | null): CodebaseAnalysis["detectedScripts"] {
	const scripts = packageJson?.scripts ?? {};
	const detectedScripts: CodebaseAnalysis["detectedScripts"] = {};

	const scriptPatterns = {
		build: ["build", "compile", "bundle"],
		test: ["test", "spec"],
		lint: ["lint", "eslint", "biome check"],
		format: ["format", "prettier", "biome format"],
		typecheck: ["typecheck", "tsc", "type-check", "types"],
	};

	for (const [scriptType, patterns] of Object.entries(scriptPatterns)) {
		for (const [scriptName, scriptValue] of Object.entries(scripts)) {
			const matchesPattern = patterns.some(
				(pattern) => scriptName.includes(pattern) || scriptValue.includes(pattern),
			);

			if (matchesPattern) {
				detectedScripts[scriptType as keyof CodebaseAnalysis["detectedScripts"]] = scriptName;

				break;
			}
		}
	}

	return detectedScripts;
}

export function analyzeCodebase(projectPath: string = process.cwd()): CodebaseAnalysis {
	const packageJson = readPackageJson(projectPath);

	return {
		packageManager: detectPackageManager(projectPath, packageJson),
		hasTypeScript: detectTypeScript(projectPath),
		testFramework: detectTestFramework(projectPath, packageJson),
		linter: detectLinter(projectPath, packageJson),
		formatter: detectFormatter(projectPath, packageJson),
		framework: detectFramework(packageJson),
		buildTool: detectBuildTool(projectPath, packageJson),
		hasGitHooks: detectGitHooks(projectPath, packageJson),
		hasCi: detectCi(projectPath),
		hasDocker: detectDocker(projectPath),
		hasMonorepo: detectMonorepo(projectPath, packageJson),
		detectedScripts: detectScripts(packageJson),
	};
}

function generateGuardrailId(): string {
	return `generated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function createGuardrail(
	instruction: string,
	category: GuardrailCategory,
	source: string,
): PromptGuardrail {
	return {
		id: generateGuardrailId(),
		instruction,
		trigger: "always",
		category,
		enabled: true,
		addedAt: new Date().toISOString(),
		addedAfterFailure: `Auto-generated from codebase analysis: ${source}`,
	};
}

export function generateGuardrailsFromAnalysis(analysis: CodebaseAnalysis): PromptGuardrail[] {
	const guardrails: PromptGuardrail[] = [];
	const packageManagerCommand =
		analysis.packageManager === "unknown" ? "npm" : analysis.packageManager;

	if (analysis.hasTypeScript) {
		const typecheckCommand = analysis.detectedScripts.typecheck
			? `${packageManagerCommand} run ${analysis.detectedScripts.typecheck}`
			: `${packageManagerCommand} run typecheck`;

		guardrails.push(
			createGuardrail(
				`Run TypeScript type checking (${typecheckCommand}) after making changes and fix all type errors before committing`,
				"quality",
				"TypeScript detected",
			),
		);
	}

	if (analysis.testFramework !== "unknown") {
		const testCommand = analysis.detectedScripts.test
			? `${packageManagerCommand} run ${analysis.detectedScripts.test}`
			: `${packageManagerCommand} test`;

		guardrails.push(
			createGuardrail(
				`Run the test suite (${testCommand}) after making changes and ensure all tests pass before committing`,
				"quality",
				`${analysis.testFramework} test framework detected`,
			),
		);
	}

	if (analysis.linter !== "unknown") {
		const lintCommand = analysis.detectedScripts.lint
			? `${packageManagerCommand} run ${analysis.detectedScripts.lint}`
			: analysis.linter === "biome"
				? `${packageManagerCommand} run biome check`
				: `${packageManagerCommand} run lint`;

		guardrails.push(
			createGuardrail(
				`Run the linter (${lintCommand}) before committing and fix all linting issues`,
				"style",
				`${analysis.linter} linter detected`,
			),
		);
	}

	if (analysis.formatter !== "unknown" && analysis.formatter !== analysis.linter) {
		const formatCommand = analysis.detectedScripts.format
			? `${packageManagerCommand} run ${analysis.detectedScripts.format}`
			: analysis.formatter === "biome"
				? `${packageManagerCommand} run biome format`
				: `${packageManagerCommand} run format`;

		guardrails.push(
			createGuardrail(
				`Run the formatter (${formatCommand}) before committing to ensure consistent code style`,
				"style",
				`${analysis.formatter} formatter detected`,
			),
		);
	}

	if (analysis.detectedScripts.build) {
		const buildCommand = `${packageManagerCommand} run ${analysis.detectedScripts.build}`;

		guardrails.push(
			createGuardrail(
				`Run the build command (${buildCommand}) after making changes to ensure the project compiles successfully`,
				"quality",
				"Build script detected",
			),
		);
	}

	if (analysis.hasGitHooks) {
		guardrails.push(
			createGuardrail(
				"Pre-commit hooks are configured in this project. Ensure your changes pass all hooks before committing",
				"process",
				"Git hooks (husky/lint-staged/lefthook) detected",
			),
		);
	}

	if (analysis.hasCi) {
		guardrails.push(
			createGuardrail(
				"This project has CI configured. Ensure all changes will pass CI checks (tests, linting, type checking) before committing",
				"process",
				"CI configuration detected",
			),
		);
	}

	if (analysis.hasMonorepo) {
		guardrails.push(
			createGuardrail(
				"This is a monorepo. Be mindful of cross-package dependencies and run tests for affected packages",
				"process",
				"Monorepo structure detected",
			),
		);
	}

	if (analysis.framework === "nextjs") {
		guardrails.push(
			createGuardrail(
				"Follow Next.js conventions for routing, data fetching, and component organization",
				"quality",
				"Next.js framework detected",
			),
		);
	} else if (analysis.framework === "react") {
		guardrails.push(
			createGuardrail(
				"Follow React best practices: use hooks correctly, avoid unnecessary re-renders, and maintain component purity",
				"quality",
				"React framework detected",
			),
		);
	}

	return guardrails;
}

export interface AnalysisReport {
	analysis: CodebaseAnalysis;
	suggestedGuardrails: PromptGuardrail[];
	summary: {
		totalSuggestions: number;
		detectedTools: string[];
	};
}

export function generateAnalysisReport(projectPath: string = process.cwd()): AnalysisReport {
	const analysis = analyzeCodebase(projectPath);
	const suggestedGuardrails = generateGuardrailsFromAnalysis(analysis);
	const detectedTools: string[] = [];

	if (analysis.packageManager !== "unknown") {
		detectedTools.push(`Package manager: ${analysis.packageManager}`);
	}

	if (analysis.hasTypeScript) {
		detectedTools.push("TypeScript");
	}

	if (analysis.testFramework !== "unknown") {
		detectedTools.push(`Test framework: ${analysis.testFramework}`);
	}

	if (analysis.linter !== "unknown") {
		detectedTools.push(`Linter: ${analysis.linter}`);
	}

	if (analysis.formatter !== "unknown" && analysis.formatter !== analysis.linter) {
		detectedTools.push(`Formatter: ${analysis.formatter}`);
	}

	if (analysis.framework !== "unknown") {
		detectedTools.push(`Framework: ${analysis.framework}`);
	}

	if (analysis.buildTool !== "unknown") {
		detectedTools.push(`Build tool: ${analysis.buildTool}`);
	}

	if (analysis.hasGitHooks) {
		detectedTools.push("Git hooks");
	}

	if (analysis.hasCi) {
		detectedTools.push("CI/CD");
	}

	if (analysis.hasMonorepo) {
		detectedTools.push("Monorepo");
	}

	return {
		analysis,
		suggestedGuardrails,
		summary: {
			totalSuggestions: suggestedGuardrails.length,
			detectedTools,
		},
	};
}

export function formatAnalysisReport(report: AnalysisReport): string {
	const lines: string[] = [];

	lines.push("╭─────────────────────────────────────────────────────────────╮");
	lines.push("│                   Codebase Analysis Report                  │");
	lines.push("╰─────────────────────────────────────────────────────────────╯");
	lines.push("");

	if (report.summary.detectedTools.length > 0) {
		lines.push("─── Detected Configuration ───");

		for (const tool of report.summary.detectedTools) {
			lines.push(`  • ${tool}`);
		}

		lines.push("");
	}

	if (Object.keys(report.analysis.detectedScripts).length > 0) {
		lines.push("─── Detected Scripts ───");

		for (const [scriptType, scriptName] of Object.entries(report.analysis.detectedScripts)) {
			if (scriptName) {
				lines.push(`  • ${scriptType}: ${scriptName}`);
			}
		}

		lines.push("");
	}

	if (report.suggestedGuardrails.length > 0) {
		lines.push("─── Suggested Guardrails ───");

		for (const [index, guardrail] of report.suggestedGuardrails.entries()) {
			lines.push(`  ${index + 1}. [${guardrail.category}] ${guardrail.instruction}`);
		}

		lines.push("");
	}

	lines.push(`Total suggestions: ${report.summary.totalSuggestions}`);
	lines.push("");
	lines.push('Run "ralph guardrails generate --apply" to add these guardrails');

	return lines.join("\n");
}
