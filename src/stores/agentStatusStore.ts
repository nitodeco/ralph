import { create } from "zustand";
import type { AgentPhase } from "@/lib/agent-phase.ts";
import type { GitDiffStats } from "@/lib/git-stats.ts";

interface AgentStatusState {
	currentPhase: AgentPhase;
	phaseStartTime: number | null;
	fileChanges: GitDiffStats;
}

interface AgentStatusActions {
	setPhase: (phase: AgentPhase) => void;
	setFileChanges: (stats: GitDiffStats) => void;
	reset: () => void;
	getPhaseDurationMs: () => number;
}

type AgentStatusStore = AgentStatusState & AgentStatusActions;

const INITIAL_FILE_CHANGES: GitDiffStats = {
	filesModified: 0,
	filesCreated: 0,
	filesDeleted: 0,
};

const INITIAL_STATE: AgentStatusState = {
	currentPhase: "idle",
	phaseStartTime: null,
	fileChanges: INITIAL_FILE_CHANGES,
};

export const useAgentStatusStore = create<AgentStatusStore>((set, get) => ({
	...INITIAL_STATE,

	setPhase: (phase: AgentPhase) => {
		const currentState = get();

		if (currentState.currentPhase !== phase) {
			set({
				currentPhase: phase,
				phaseStartTime: Date.now(),
			});
		}
	},

	setFileChanges: (stats: GitDiffStats) => {
		set({ fileChanges: stats });
	},

	reset: () => {
		set(INITIAL_STATE);
	},

	getPhaseDurationMs: () => {
		const state = get();

		if (!state.phaseStartTime) {
			return 0;
		}

		return Date.now() - state.phaseStartTime;
	},
}));
