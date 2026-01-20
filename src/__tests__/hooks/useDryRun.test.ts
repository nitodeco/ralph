import { describe, expect, test } from "bun:test";
import type { DryRunState } from "@/hooks/useDryRun.ts";

describe("DryRunState type", () => {
	test("has correct status values", () => {
		const idleState: DryRunState = {
			status: "idle",
			currentIteration: 0,
			logs: [],
			errors: [],
			warnings: [],
		};

		expect(idleState.status).toBe("idle");

		const validatingState: DryRunState = {
			status: "validating",
			currentIteration: 0,
			logs: ["Validating..."],
			errors: [],
			warnings: [],
		};

		expect(validatingState.status).toBe("validating");

		const simulatingState: DryRunState = {
			status: "simulating",
			currentIteration: 1,
			logs: ["Simulating..."],
			errors: [],
			warnings: [],
		};

		expect(simulatingState.status).toBe("simulating");

		const completeState: DryRunState = {
			status: "complete",
			currentIteration: 5,
			logs: ["Done"],
			errors: [],
			warnings: [],
		};

		expect(completeState.status).toBe("complete");
	});

	test("can hold logs, errors, and warnings", () => {
		const state: DryRunState = {
			status: "complete",
			currentIteration: 3,
			logs: ["Log 1", "Log 2", "Log 3"],
			errors: ["Error 1"],
			warnings: ["Warning 1", "Warning 2"],
		};

		expect(state.logs).toHaveLength(3);
		expect(state.errors).toHaveLength(1);
		expect(state.warnings).toHaveLength(2);
	});
});
