import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AgentType, RalphConfig } from "../types.ts";
import { ensureRalphDirExists, RALPH_DIR } from "./prd.ts";

const CONFIG_PATH = `${RALPH_DIR}/config.json`;

const DEFAULT_CONFIG: RalphConfig = {
	agent: "cursor",
};

export const AGENT_COMMANDS: Record<AgentType, string[]> = {
	cursor: ["cursor", "-p", "--force"],
	claude: ["claude", "-p", "--dangerously-skip-permissions"],
};

export function loadConfig(): RalphConfig {
	if (!existsSync(CONFIG_PATH)) {
		return DEFAULT_CONFIG;
	}

	const content = readFileSync(CONFIG_PATH, "utf-8");
	return JSON.parse(content) as RalphConfig;
}

export function saveConfig(config: RalphConfig): void {
	ensureRalphDirExists();
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getAgentCommand(agentType: AgentType): string[] {
	return AGENT_COMMANDS[agentType];
}
