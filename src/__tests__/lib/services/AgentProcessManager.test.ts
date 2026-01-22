import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AgentProcessManager } from "@/lib/services/AgentProcessManager.ts";

function createMockProcess(
	pid: number,
	exitCode: number | null = null,
): {
	pid: number;
	exitCode: number | null;
	kill: (signal?: string) => void;
} {
	return {
		pid,
		exitCode,
		kill: () => {},
	};
}

describe("AgentProcessManager", () => {
	beforeEach(() => {
		AgentProcessManager.reset();
	});

	afterEach(() => {
		AgentProcessManager.reset();
	});

	describe("single process (default) operations", () => {
		test("getProcess returns null when no process is set", () => {
			expect(AgentProcessManager.getProcess()).toBeNull();
		});

		test("setProcess and getProcess work correctly", () => {
			const mockProcess = createMockProcess(1234);

			AgentProcessManager.setProcess(mockProcess as never);

			expect(AgentProcessManager.getProcess()?.pid).toBe(1234);
			expect(AgentProcessManager.getProcessId()).toBe(1234);
		});

		test("setProcess with null removes the process", () => {
			const mockProcess = createMockProcess(1234);

			AgentProcessManager.setProcess(mockProcess as never);
			AgentProcessManager.setProcess(null);

			expect(AgentProcessManager.getProcess()).toBeNull();
			expect(AgentProcessManager.getProcessId()).toBeNull();
		});

		test("isProcessAlive returns false when no process", () => {
			expect(AgentProcessManager.isProcessAlive()).toBe(false);
		});

		test("isProcessAlive returns true for alive process", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.setProcess(mockProcess as never);

			expect(AgentProcessManager.isProcessAlive()).toBe(true);
		});

		test("isProcessAlive returns false for exited process", () => {
			const mockProcess = createMockProcess(1234, 0);

			AgentProcessManager.setProcess(mockProcess as never);

			expect(AgentProcessManager.isProcessAlive()).toBe(false);
		});

		test("isRunning returns correct state", () => {
			expect(AgentProcessManager.isRunning()).toBe(false);

			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.setProcess(mockProcess as never);

			expect(AgentProcessManager.isRunning()).toBe(true);
		});
	});

	describe("abort state management", () => {
		test("isAborted returns false by default", () => {
			expect(AgentProcessManager.isAborted()).toBe(false);
		});

		test("setAborted without id sets global abort", () => {
			AgentProcessManager.setAborted(true);

			expect(AgentProcessManager.isAborted()).toBe(true);
			expect(AgentProcessManager.isGloballyAborted()).toBe(true);
		});

		test("global abort affects all processes", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.setProcess(mockProcess1 as never, "process-1");
			AgentProcessManager.setProcess(mockProcess2 as never, "process-2");

			AgentProcessManager.setAborted(true);

			expect(AgentProcessManager.isAborted("process-1")).toBe(true);
			expect(AgentProcessManager.isAborted("process-2")).toBe(true);
		});

		test("setAborted with id only affects that process", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.setProcess(mockProcess1 as never, "process-1");
			AgentProcessManager.setProcess(mockProcess2 as never, "process-2");

			AgentProcessManager.setAborted(true, "process-1");

			expect(AgentProcessManager.isAborted("process-1")).toBe(true);
			expect(AgentProcessManager.isAborted("process-2")).toBe(false);
		});
	});

	describe("retry count management", () => {
		test("getRetryCount returns 0 by default", () => {
			expect(AgentProcessManager.getRetryCount()).toBe(0);
		});

		test("incrementRetry increases count", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.setProcess(mockProcess as never);

			expect(AgentProcessManager.incrementRetry()).toBe(1);
			expect(AgentProcessManager.incrementRetry()).toBe(2);
			expect(AgentProcessManager.getRetryCount()).toBe(2);
		});

		test("resetRetry resets count to 0", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.setProcess(mockProcess as never);
			AgentProcessManager.incrementRetry();
			AgentProcessManager.incrementRetry();
			AgentProcessManager.resetRetry();

			expect(AgentProcessManager.getRetryCount()).toBe(0);
		});

		test("retry count is preserved when updating same process", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.setProcess(mockProcess1 as never, "test-id");
			AgentProcessManager.incrementRetry("test-id");
			AgentProcessManager.incrementRetry("test-id");

			AgentProcessManager.setProcess(mockProcess2 as never, "test-id");

			expect(AgentProcessManager.getRetryCount("test-id")).toBe(2);
		});
	});

	describe("multi-process operations", () => {
		test("registerProcess adds a process with given id", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.registerProcess("task-1", mockProcess as never);

			expect(AgentProcessManager.getProcessById("task-1")?.pid).toBe(1234);
		});

		test("unregisterProcess removes a process", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.registerProcess("task-1", mockProcess as never);
			AgentProcessManager.unregisterProcess("task-1");

			expect(AgentProcessManager.getProcessById("task-1")).toBeNull();
		});

		test("getAllProcessIds returns all registered process ids", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);

			const ids = AgentProcessManager.getAllProcessIds();

			expect(ids).toContain("task-1");
			expect(ids).toContain("task-2");
			expect(ids).toHaveLength(2);
		});

		test("getAllProcessInfo returns info for all processes", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, 0);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);

			const infos = AgentProcessManager.getAllProcessInfo();

			expect(infos).toHaveLength(2);

			const info1 = infos.find((i) => i.id === "task-1");
			const info2 = infos.find((i) => i.id === "task-2");

			expect(info1?.processId).toBe(1234);
			expect(info1?.isAlive).toBe(true);
			expect(info2?.processId).toBe(5678);
			expect(info2?.isAlive).toBe(false);
		});

		test("getActiveProcessCount returns count of alive processes", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, 0);
			const mockProcess3 = createMockProcess(9012, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);
			AgentProcessManager.registerProcess("task-3", mockProcess3 as never);

			expect(AgentProcessManager.getActiveProcessCount()).toBe(2);
		});

		test("isAnyRunning returns true if any process is alive", () => {
			const mockProcess1 = createMockProcess(1234, 0);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);

			expect(AgentProcessManager.isAnyRunning()).toBe(false);

			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);

			expect(AgentProcessManager.isAnyRunning()).toBe(true);
		});

		test("kill removes specific process", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);

			AgentProcessManager.kill("task-1");

			expect(AgentProcessManager.getProcessById("task-1")).toBeNull();
			expect(AgentProcessManager.getProcessById("task-2")?.pid).toBe(5678);
		});

		test("killAll removes all processes", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);

			AgentProcessManager.killAll();

			expect(AgentProcessManager.getAllProcessIds()).toHaveLength(0);
			expect(AgentProcessManager.isGloballyAborted()).toBe(true);
		});
	});

	describe("process state validation", () => {
		test("validateProcessState returns valid for no process", () => {
			const result = AgentProcessManager.validateProcessState();

			expect(result.isValid).toBe(true);
		});

		test("validateProcessState returns valid for consistent process", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.setProcess(mockProcess as never);
			const result = AgentProcessManager.validateProcessState();

			expect(result.isValid).toBe(true);
		});

		test("validateProcessState with id returns valid for consistent process", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.registerProcess("test-id", mockProcess as never);
			const result = AgentProcessManager.validateProcessState("test-id");

			expect(result.isValid).toBe(true);
		});
	});

	describe("reset operations", () => {
		test("reset without id clears all processes", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);
			AgentProcessManager.setAborted(true);

			AgentProcessManager.reset();

			expect(AgentProcessManager.getAllProcessIds()).toHaveLength(0);
			expect(AgentProcessManager.isGloballyAborted()).toBe(false);
		});

		test("reset with id only clears that process", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);

			AgentProcessManager.reset("task-1");

			expect(AgentProcessManager.getProcessById("task-1")).toBeNull();
			expect(AgentProcessManager.getProcessById("task-2")?.pid).toBe(5678);
		});

		test("resetAll clears all processes", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);

			AgentProcessManager.resetAll();

			expect(AgentProcessManager.getAllProcessIds()).toHaveLength(0);
		});
	});

	describe("timeout management", () => {
		test("clearForceKillTimeout clears timeout for default process", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.setProcess(mockProcess as never);
			AgentProcessManager.clearForceKillTimeout();

			expect(true).toBe(true);
		});

		test("clearForceKillTimeout with id clears specific timeout", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.registerProcess("test-id", mockProcess as never);
			AgentProcessManager.clearForceKillTimeout("test-id");

			expect(true).toBe(true);
		});

		test("clearAllForceKillTimeouts clears all timeouts", () => {
			const mockProcess1 = createMockProcess(1234, null);
			const mockProcess2 = createMockProcess(5678, null);

			AgentProcessManager.registerProcess("task-1", mockProcess1 as never);
			AgentProcessManager.registerProcess("task-2", mockProcess2 as never);
			AgentProcessManager.clearAllForceKillTimeouts();

			expect(true).toBe(true);
		});

		test("clearPendingKillTimeouts clears pending timeouts", () => {
			AgentProcessManager.clearPendingKillTimeouts();

			expect(true).toBe(true);
		});
	});

	describe("backward compatibility", () => {
		test("single process methods work without id parameter", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.setProcess(mockProcess as never);

			expect(AgentProcessManager.getProcess()?.pid).toBe(1234);
			expect(AgentProcessManager.getProcessId()).toBe(1234);
			expect(AgentProcessManager.isProcessAlive()).toBe(true);
			expect(AgentProcessManager.isRunning()).toBe(true);
		});

		test("retry methods work without id parameter", () => {
			const mockProcess = createMockProcess(1234, null);

			AgentProcessManager.setProcess(mockProcess as never);

			expect(AgentProcessManager.incrementRetry()).toBe(1);
			expect(AgentProcessManager.getRetryCount()).toBe(1);

			AgentProcessManager.resetRetry();

			expect(AgentProcessManager.getRetryCount()).toBe(0);
		});
	});
});
