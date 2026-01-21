import { useApp, useInput } from "ink";
import { useCallback, useState } from "react";
import { useDryRun, useSessionLifecycle, useSlashCommands } from "@/hooks/index.ts";
import { useAgentStore, useAppStore, useIterationStore } from "@/stores/index.ts";
import { MainRunView } from "./MainRunView.tsx";
import { ViewRouter } from "./ViewRouter.tsx";

interface RunAppProps {
	version: string;
	iterations: number;
	autoResume?: boolean;
	autoStart?: boolean;
	dryRun?: boolean;
	initialTask?: string;
	maxRuntimeMs?: number;
	skipVerification?: boolean;
}

export function RunApp({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
	dryRun = false,
	initialTask,
	maxRuntimeMs,
	skipVerification = false,
}: RunAppProps): React.ReactElement {
	const { exit } = useApp();

	const appState = useAppStore((state) => state.appState);
	const activeView = useAppStore((state) => state.activeView);
	const validationWarning = useAppStore((state) => state.validationWarning);
	const config = useAppStore((state) => state.config);
	const prd = useAppStore((state) => state.prd);
	const pendingSession = useAppStore((state) => state.pendingSession);

	const needsMigration = useAppStore((state) => state.needsMigration);
	const setActiveView = useAppStore((state) => state.setActiveView);
	const loadInitialState = useAppStore((state) => state.loadInitialState);
	const startIterations = useAppStore((state) => state.startIterations);
	const resumeSession = useAppStore((state) => state.resumeSession);
	const stopAgent = useAppStore((state) => state.stopAgent);
	const revalidateAndGoIdle = useAppStore((state) => state.revalidateAndGoIdle);
	const handleFatalError = useAppStore((state) => state.handleFatalError);
	const setIterations = useAppStore((state) => state.setIterations);
	const setManualNextTask = useAppStore((state) => state.setManualNextTask);
	const updateAvailable = useAppStore((state) => state.updateAvailable);
	const latestVersion = useAppStore((state) => state.latestVersion);
	const updateBannerDismissed = useAppStore((state) => state.updateBannerDismissed);
	const dismissUpdateBanner = useAppStore((state) => state.dismissUpdateBanner);
	const refreshState = useAppStore((state) => state.refreshState);
	const clearSession = useAppStore((state) => state.clearSession);
	const handleMigrationComplete = useAppStore((state) => state.handleMigrationComplete);
	const handleMigrationSkip = useAppStore((state) => state.handleMigrationSkip);

	const agentIsStreaming = useAgentStore((state) => state.isStreaming);
	const agentError = useAgentStore((state) => state.error);
	const agentStop = useAgentStore((state) => state.stop);

	const iterationCurrent = useIterationStore((state) => state.current);
	const iterationTotal = useIterationStore((state) => state.total);
	const iterationIsPaused = useIterationStore((state) => state.isPaused);
	const iterationPause = useIterationStore((state) => state.pause);
	const iterationResume = useIterationStore((state) => state.resume);

	const [initialTaskMessage, setInitialTaskMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const dryRunState = useDryRun(dryRun, config, iterations);

	const getCurrentTaskTitle = useCallback(() => {
		if (!prd) {
			return null;
		}

		const currentTask = prd.tasks.find((task) => !task.done);

		return currentTask?.title ?? null;
	}, [prd]);

	const {
		handleSlashCommand,
		nextTaskMessage,
		guardrailMessage,
		memoryMessage,
		refreshMessage,
		clearMessage,
		taskMessage,
	} = useSlashCommands({
		startIterations,
		resumeSession,
		stopAgent,
		setManualNextTask,
		agentStop,
		iterationPause,
		setActiveView,
		exit,
		getCurrentTaskTitle,
		dismissUpdateBanner,
		refreshState,
		clearSession,
	});

	useSessionLifecycle(
		{
			iterations,
			autoResume,
			autoStart,
			dryRun,
			initialTask,
			maxRuntimeMs,
			skipVerification,
			version,
		},
		{
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
			onTaskSet: (result, taskIdentifier) => {
				if (result.success) {
					setInitialTaskMessage({ type: "success", text: `Task set: ${result.taskTitle}` });
				} else {
					setInitialTaskMessage({
						type: "error",
						text: result.error ?? `Failed to set task: ${taskIdentifier}`,
					});
				}
			},
		},
	);

	const handleViewComplete = useCallback(() => {
		setActiveView("run");
		revalidateAndGoIdle();
	}, [revalidateAndGoIdle, setActiveView]);

	const handleHelpClose = useCallback(() => {
		setActiveView("run");

		if (appState === "running" && iterationIsPaused) {
			iterationResume();
		}
	}, [appState, iterationIsPaused, iterationResume, setActiveView]);

	useInput(
		(_input, key) => {
			if (key.escape && agentIsStreaming && activeView === "run") {
				stopAgent();
			}
		},
		{ isActive: activeView === "run" },
	);

	const displayedMessage = nextTaskMessage ?? initialTaskMessage;

	return (
		<ViewRouter
			activeView={activeView}
			version={version}
			appState={appState}
			config={config}
			projectName={prd?.project}
			pendingSession={pendingSession}
			validationWarning={validationWarning}
			needsMigration={needsMigration}
			dryRun={dryRun}
			dryRunState={dryRunState}
			onViewComplete={handleViewComplete}
			onHelpClose={handleHelpClose}
			onCommand={handleSlashCommand}
			onMigrationComplete={handleMigrationComplete}
			onMigrationSkip={handleMigrationSkip}
		>
			<MainRunView
				version={version}
				config={config}
				prd={prd}
				appState={appState}
				iterationCurrent={iterationCurrent}
				iterationTotal={iterationTotal}
				agentIsStreaming={agentIsStreaming}
				nextTaskMessage={displayedMessage}
				guardrailMessage={guardrailMessage}
				memoryMessage={memoryMessage}
				refreshMessage={refreshMessage}
				clearMessage={clearMessage}
				taskMessage={taskMessage}
				onCommand={handleSlashCommand}
				updateAvailable={updateAvailable}
				latestVersion={latestVersion}
				updateBannerDismissed={updateBannerDismissed}
			/>
		</ViewRouter>
	);
}
