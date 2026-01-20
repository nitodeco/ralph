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
}

export function RunApp({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
	dryRun = false,
	initialTask,
	maxRuntimeMs,
}: RunAppProps): React.ReactElement {
	const { exit } = useApp();

	const appState = useAppStore((state) => state.appState);
	const activeView = useAppStore((state) => state.activeView);
	const validationWarning = useAppStore((state) => state.validationWarning);
	const config = useAppStore((state) => state.config);
	const prd = useAppStore((state) => state.prd);
	const pendingSession = useAppStore((state) => state.pendingSession);

	const setActiveView = useAppStore((state) => state.setActiveView);
	const loadInitialState = useAppStore((state) => state.loadInitialState);
	const startIterations = useAppStore((state) => state.startIterations);
	const resumeSession = useAppStore((state) => state.resumeSession);
	const stopAgent = useAppStore((state) => state.stopAgent);
	const revalidateAndGoIdle = useAppStore((state) => state.revalidateAndGoIdle);
	const handleFatalError = useAppStore((state) => state.handleFatalError);
	const setIterations = useAppStore((state) => state.setIterations);
	const setManualNextTask = useAppStore((state) => state.setManualNextTask);

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

	const { handleSlashCommand, nextTaskMessage, guardrailMessage } = useSlashCommands({
		startIterations,
		resumeSession,
		stopAgent,
		setManualNextTask,
		agentStop,
		iterationPause,
		setActiveView,
		exit,
	});

	useSessionLifecycle(
		{
			iterations,
			autoResume,
			autoStart,
			dryRun,
			initialTask,
			maxRuntimeMs,
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
			dryRun={dryRun}
			dryRunState={dryRunState}
			onViewComplete={handleViewComplete}
			onHelpClose={handleHelpClose}
			onCommand={handleSlashCommand}
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
				onCommand={handleSlashCommand}
			/>
		</ViewRouter>
	);
}
