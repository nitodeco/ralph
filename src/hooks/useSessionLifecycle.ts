import { useEffect } from "react";
import { orchestrator, setupIterationCallbacks, useAppStore } from "@/stores/index.ts";
import type { ActiveView, AppState, Session, SetManualTaskResult } from "@/types/index.ts";

interface UseSessionLifecycleParams {
	iterations: number;
	autoResume: boolean;
	autoStart: boolean;
	dryRun: boolean;
	initialTask?: string;
	maxRuntimeMs?: number;
	skipVerification?: boolean;
}

interface UseSessionLifecycleDependencies {
	loadInitialState: (autoResume: boolean) => void;
	setIterations: (iterations: number) => void;
	startIterations: (iterations?: number, full?: boolean) => void;
	resumeSession: () => void;
	setManualNextTask: (taskIdentifier: string) => SetManualTaskResult;
	handleFatalError: (error: string) => void;
	appState: AppState;
	pendingSession: Session | null;
	agentError: string | null;
	activeView: ActiveView;
	onTaskSet?: (result: SetManualTaskResult, taskIdentifier: string) => void;
}

export function useSessionLifecycle(
	params: UseSessionLifecycleParams,
	dependencies: UseSessionLifecycleDependencies,
): void {
	const { iterations, autoResume, autoStart, dryRun, initialTask, maxRuntimeMs, skipVerification } =
		params;

	const {
		loadInitialState,
		setIterations,
		startIterations,
		resumeSession,
		setManualNextTask,
		handleFatalError,
		appState,
		pendingSession,
		agentError,
		activeView,
		onTaskSet,
	} = dependencies;

	useEffect(() => {
		setIterations(iterations);
		setupIterationCallbacks(iterations, maxRuntimeMs, skipVerification);
		loadInitialState(autoResume);
	}, [autoResume, iterations, loadInitialState, setIterations, maxRuntimeMs, skipVerification]);

	useEffect(() => {
		if (autoResume && pendingSession && appState === "idle") {
			resumeSession();
		}
	}, [autoResume, pendingSession, appState, resumeSession]);

	useEffect(() => {
		if (dryRun) return;
		if (initialTask && appState === "idle" && !pendingSession) {
			const result = setManualNextTask(initialTask);
			if (result.success) {
				onTaskSet?.(result, initialTask);
				startIterations(1);
			} else {
				onTaskSet?.(result, initialTask);
			}
		} else if (autoStart && !autoResume && appState === "idle" && !pendingSession) {
			startIterations();
		}
	}, [
		autoStart,
		autoResume,
		appState,
		pendingSession,
		startIterations,
		initialTask,
		setManualNextTask,
		dryRun,
		onTaskSet,
	]);

	useEffect(() => {
		if (appState !== "running" || activeView !== "run") return;
		const incrementElapsedTime = useAppStore.getState().incrementElapsedTime;
		const timer = setInterval(() => incrementElapsedTime(), 1000);
		return () => clearInterval(timer);
	}, [appState, activeView]);

	useEffect(() => {
		if (agentError?.startsWith("Fatal error:") && appState === "running") {
			handleFatalError(agentError);
		}
	}, [agentError, appState, handleFatalError]);

	useEffect(() => {
		return () => {
			orchestrator.cleanup();
		};
	}, []);
}
