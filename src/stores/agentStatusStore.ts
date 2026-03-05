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
  filesCreated: 0,
  filesDeleted: 0,
  filesModified: 0,
};

const INITIAL_STATE: AgentStatusState = {
  currentPhase: "idle",
  fileChanges: INITIAL_FILE_CHANGES,
  phaseStartTime: null,
};

export const useAgentStatusStore = create<AgentStatusStore>((set, get) => ({
  ...INITIAL_STATE,

  getPhaseDurationMs: () => {
    const state = get();

    if (!state.phaseStartTime) {
      return 0;
    }

    return Date.now() - state.phaseStartTime;
  },

  reset: () => {
    set(INITIAL_STATE);
  },

  setFileChanges: (stats: GitDiffStats) => {
    set({ fileChanges: stats });
  },

  setPhase: (phase: AgentPhase) => {
    const currentState = get();

    if (currentState.currentPhase !== phase) {
      set({
        currentPhase: phase,
        phaseStartTime: Date.now(),
      });
    }
  },
}));
