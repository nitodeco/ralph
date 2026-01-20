import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentType, RalphConfig } from "@/types.ts";
import { ensureRalphDirExists, RALPH_DIR } from "./prd.ts";

const GLOBAL_RALPH_DIR = join(homedir(), ".ralph");
const GLOBAL_CONFIG_PATH = join(GLOBAL_RALPH_DIR, "config.json");
const PROJECT_CONFIG_PATH = `${RALPH_DIR}/config.json`;

const DEFAULT_CONFIG: RalphConfig = {
	agent: "cursor",
	prdFormat: "json",
	maxRetries: 3,
	retryDelayMs: 5000,
};

export const AGENT_COMMANDS: Record<AgentType, string[]> = {
	cursor: ["agent", "-p", "--force", "--output-format", "stream-json", "--stream-partial-output"],
	claude: ["claude", "-p", "--dangerously-skip-permissions"],
};

function ensureGlobalRalphDirExists(): void {
	if (!existsSync(GLOBAL_RALPH_DIR)) {
		mkdirSync(GLOBAL_RALPH_DIR, { recursive: true });
	}
}

export function loadGlobalConfig(): RalphConfig {
	if (!existsSync(GLOBAL_CONFIG_PATH)) {
		return DEFAULT_CONFIG;
	}

	const content = readFileSync(GLOBAL_CONFIG_PATH, "utf-8");
	return { ...DEFAULT_CONFIG, ...JSON.parse(content) } as RalphConfig;
}

export function saveGlobalConfig(config: RalphConfig): void {
	ensureGlobalRalphDirExists();
	writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function globalConfigExists(): boolean {
	return existsSync(GLOBAL_CONFIG_PATH);
}

export function loadConfig(): RalphConfig {
	const globalConfig = loadGlobalConfig();

	if (!existsSync(PROJECT_CONFIG_PATH)) {
		return globalConfig;
	}

	const projectContent = readFileSync(PROJECT_CONFIG_PATH, "utf-8");
	const projectConfig = JSON.parse(projectContent) as Partial<RalphConfig>;

	return { ...globalConfig, ...projectConfig };
}

export function saveConfig(config: RalphConfig): void {
	ensureRalphDirExists();
	writeFileSync(PROJECT_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getAgentCommand(agentType: AgentType): string[] {
	return AGENT_COMMANDS[agentType];
}
