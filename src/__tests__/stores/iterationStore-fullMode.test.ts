import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { useIterationStore } from "@/stores/iterationStore.ts";

describe("iterationStore full mode", () => {
	beforeEach(() => {
		useIterationStore.getState().reset();
	});

	afterEach(() => {
		useIterationStore.getState().reset();
	});

	describe("setFullMode", () => {
		test("sets full mode to true", () => {
			const store = useIterationStore.getState();

			store.setFullMode(true);

			expect(useIterationStore.getState().isFullMode).toBe(true);
		});

		test("sets full mode to false", () => {
			const store = useIterationStore.getState();

			store.setFullMode(true);
			store.setFullMode(false);

			expect(useIterationStore.getState().isFullMode).toBe(false);
		});
	});

	describe("markIterationComplete with full mode", () => {
		test("extends iterations when in full mode with pending tasks at iteration limit", () => {
			const store = useIterationStore.getState();

			store.setTotal(3);
			store.setFullMode(true);
			store.start();

			const state1 = useIterationStore.getState();

			expect(state1.current).toBe(1);
			expect(state1.total).toBe(3);

			useIterationStore.setState({ current: 3 });

			store.markIterationComplete(false, true);

			const state2 = useIterationStore.getState();

			expect(state2.total).toBe(4);
			expect(state2.isDelaying).toBe(true);
		});

		test("calls onMaxIterations when not in full mode at iteration limit", () => {
			const onMaxIterations = mock(() => {});
			const store = useIterationStore.getState();

			store.setTotal(3);
			store.setFullMode(false);
			store.setCallbacks({ onMaxIterations });
			store.start();

			useIterationStore.setState({ current: 3 });

			store.markIterationComplete(false, true);

			expect(onMaxIterations).toHaveBeenCalled();
			expect(useIterationStore.getState().isRunning).toBe(false);
		});

		test("calls onMaxIterations when in full mode but no pending tasks", () => {
			const onMaxIterations = mock(() => {});
			const store = useIterationStore.getState();

			store.setTotal(3);
			store.setFullMode(true);
			store.setCallbacks({ onMaxIterations });
			store.start();

			useIterationStore.setState({ current: 3 });

			store.markIterationComplete(false, false);

			expect(onMaxIterations).toHaveBeenCalled();
			expect(useIterationStore.getState().isRunning).toBe(false);
		});

		test("calls onAllComplete when project is complete regardless of full mode", () => {
			const onAllComplete = mock(() => {});
			const store = useIterationStore.getState();

			store.setTotal(3);
			store.setFullMode(true);
			store.setCallbacks({ onAllComplete });
			store.start();

			useIterationStore.setState({ current: 2 });

			store.markIterationComplete(true, false);

			expect(onAllComplete).toHaveBeenCalled();
			expect(useIterationStore.getState().isRunning).toBe(false);
		});

		test("continues normally when not at iteration limit", () => {
			const store = useIterationStore.getState();

			store.setTotal(5);
			store.setFullMode(true);
			store.start();

			useIterationStore.setState({ current: 2 });

			store.markIterationComplete(false, true);

			const state = useIterationStore.getState();

			expect(state.total).toBe(5);
			expect(state.isDelaying).toBe(true);
		});

		test("full mode allows indefinite extension with pending tasks", () => {
			const store = useIterationStore.getState();

			store.setTotal(2);
			store.setFullMode(true);
			store.start();

			useIterationStore.setState({ current: 2 });
			store.markIterationComplete(false, true);

			expect(useIterationStore.getState().total).toBe(3);

			useIterationStore.setState({ current: 3 });
			store.markIterationComplete(false, true);

			expect(useIterationStore.getState().total).toBe(4);

			useIterationStore.setState({ current: 4 });
			store.markIterationComplete(false, true);

			expect(useIterationStore.getState().total).toBe(5);
		});

		test("full mode stops extending when hasPendingTasks is undefined", () => {
			const onMaxIterations = mock(() => {});
			const store = useIterationStore.getState();

			store.setTotal(3);
			store.setFullMode(true);
			store.setCallbacks({ onMaxIterations });
			store.start();

			useIterationStore.setState({ current: 3 });

			store.markIterationComplete(false);

			expect(onMaxIterations).toHaveBeenCalled();
		});
	});

	describe("reset clears full mode", () => {
		test("reset sets isFullMode back to false", () => {
			const store = useIterationStore.getState();

			store.setFullMode(true);

			expect(useIterationStore.getState().isFullMode).toBe(true);

			store.reset();

			expect(useIterationStore.getState().isFullMode).toBe(false);
		});
	});
});
