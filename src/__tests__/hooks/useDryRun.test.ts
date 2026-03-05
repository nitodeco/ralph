import { describe, expect, test } from "bun:test";
import type { DryRunState } from "@/hooks/useDryRun.ts";

describe("DryRunState type", () => {
  test("has correct status values", () => {
    const idleState: DryRunState = {
      currentIteration: 0,
      errors: [],
      logs: [],
      status: "idle",
      warnings: [],
    };

    expect(idleState.status).toBe("idle");

    const validatingState: DryRunState = {
      currentIteration: 0,
      errors: [],
      logs: ["Validating..."],
      status: "validating",
      warnings: [],
    };

    expect(validatingState.status).toBe("validating");

    const simulatingState: DryRunState = {
      currentIteration: 1,
      errors: [],
      logs: ["Simulating..."],
      status: "simulating",
      warnings: [],
    };

    expect(simulatingState.status).toBe("simulating");

    const completeState: DryRunState = {
      currentIteration: 5,
      errors: [],
      logs: ["Done"],
      status: "complete",
      warnings: [],
    };

    expect(completeState.status).toBe("complete");
  });

  test("can hold logs, errors, and warnings", () => {
    const state: DryRunState = {
      currentIteration: 3,
      errors: ["Error 1"],
      logs: ["Log 1", "Log 2", "Log 3"],
      status: "complete",
      warnings: ["Warning 1", "Warning 2"],
    };

    expect(state.logs).toHaveLength(3);
    expect(state.errors).toHaveLength(1);
    expect(state.warnings).toHaveLength(2);
  });
});
