export interface AgentResult {
	output: string;
	isComplete: boolean;
	exitCode: number;
}

export interface RunOptions {
	iterations: number;
}
