export type AgentPhase =
  | "starting"
  | "exploring"
  | "reading"
  | "implementing"
  | "running_commands"
  | "verifying"
  | "committing"
  | "idle";

interface PhaseInfo {
  label: string;
  activeLabel: string;
}

export const PHASE_INFO_BY_PHASE: Record<AgentPhase, PhaseInfo> = {
  committing: {
    activeLabel: "Agent is committing changes",
    label: "Committing",
  },
  exploring: {
    activeLabel: "Agent is exploring codebase",
    label: "Exploring",
  },
  idle: {
    activeLabel: "Agent is idle",
    label: "Idle",
  },
  implementing: {
    activeLabel: "Agent is implementing changes",
    label: "Implementing",
  },
  reading: {
    activeLabel: "Agent is reading files",
    label: "Reading",
  },
  running_commands: {
    activeLabel: "Agent is running commands",
    label: "Running",
  },
  starting: {
    activeLabel: "Agent is starting",
    label: "Starting",
  },
  verifying: {
    activeLabel: "Agent is verifying implementation",
    label: "Verifying",
  },
};

interface PatternMatch {
  pattern: RegExp;
  phase: AgentPhase;
}

const PHASE_PATTERNS: PatternMatch[] = [
  { pattern: /git\s+(commit|add)/i, phase: "committing" },
  { pattern: /npm\s+run\s+(test|build|lint|check|typecheck)/i, phase: "verifying" },
  { pattern: /bun\s+(run\s+)?(test|build|lint|check|typecheck)/i, phase: "verifying" },
  { pattern: /yarn\s+(run\s+)?(test|build|lint|check|typecheck)/i, phase: "verifying" },
  { pattern: /pnpm\s+(run\s+)?(test|build|lint|check|typecheck)/i, phase: "verifying" },
  { pattern: /npm\s+run/i, phase: "running_commands" },
  { pattern: /bun\s+run/i, phase: "running_commands" },
  { pattern: /yarn\s+run/i, phase: "running_commands" },
  { pattern: /pnpm\s+run/i, phase: "running_commands" },
  { pattern: /(writing|editing|modifying|updating|creating)\s+(file|to)/i, phase: "implementing" },
  { pattern: /Write\s+tool/i, phase: "implementing" },
  { pattern: /Edit\s+tool/i, phase: "implementing" },
  { pattern: /(reading|opening|viewing)\s+(file|the\s+file)/i, phase: "reading" },
  { pattern: /Read\s+tool/i, phase: "reading" },
  { pattern: /(searching|finding|looking\s+for|glob|grep)/i, phase: "exploring" },
  { pattern: /Glob\s+tool/i, phase: "exploring" },
  { pattern: /Grep\s+tool/i, phase: "exploring" },
  {
    pattern: /(exploring|analyzing|examining)\s+(the\s+)?(codebase|code|files|directory)/i,
    phase: "exploring",
  },
];

import { PHASE_DETECTION_OUTPUT_WINDOW_CHARS } from "@/lib/constants/ui.ts";

export function detectPhaseFromOutput(output: string): AgentPhase {
  const recentOutput = output.slice(-PHASE_DETECTION_OUTPUT_WINDOW_CHARS);

  for (const { pattern, phase } of PHASE_PATTERNS) {
    if (pattern.test(recentOutput)) {
      return phase;
    }
  }

  return "implementing";
}
