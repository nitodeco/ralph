import { useInput } from "ink";
import { useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
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
  const {
    appState,
    activeView,
    validationWarning,
    config,
    prd,
    pendingSession,
    lastTechnicalDebtReport,
    setActiveView,
    loadInitialState,
    startIterations,
    resumeSession,
    stopAgent,
    revalidateAndGoIdle,
    handleFatalError,
    setIterations,
    setManualNextTask,
    updateAvailable,
    latestVersion,
    updateBannerDismissed,
    dismissUpdateBanner,
    refreshState,
    clearSession,
  } = useAppStore(
    useShallow((state) => ({
      appState: state.appState,
      activeView: state.activeView,
      validationWarning: state.validationWarning,
      config: state.config,
      prd: state.prd,
      pendingSession: state.pendingSession,
      lastTechnicalDebtReport: state.lastTechnicalDebtReport,
      setActiveView: state.setActiveView,
      loadInitialState: state.loadInitialState,
      startIterations: state.startIterations,
      resumeSession: state.resumeSession,
      stopAgent: state.stopAgent,
      revalidateAndGoIdle: state.revalidateAndGoIdle,
      handleFatalError: state.handleFatalError,
      setIterations: state.setIterations,
      setManualNextTask: state.setManualNextTask,
      updateAvailable: state.updateAvailable,
      latestVersion: state.latestVersion,
      updateBannerDismissed: state.updateBannerDismissed,
      dismissUpdateBanner: state.dismissUpdateBanner,
      refreshState: state.refreshState,
      clearSession: state.clearSession,
    })),
  );

  const { agentIsStreaming, agentError, agentStop } = useAgentStore(
    useShallow((state) => ({
      agentIsStreaming: state.isStreaming,
      agentError: state.error,
      agentStop: state.stop,
    })),
  );

  const { iterationCurrent, iterationTotal, iterationIsPaused, iterationPause, iterationResume } =
    useIterationStore(
      useShallow((state) => ({
        iterationCurrent: state.current,
        iterationTotal: state.total,
        iterationIsPaused: state.isPaused,
        iterationPause: state.pause,
        iterationResume: state.resume,
      })),
    );

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
    handleClearConfirm,
    handleClearCancel,
    dismissHelp,
    nextTaskMessage,
    guardrailMessage,
    memoryMessage,
    modelMessage,
    refreshMessage,
    clearMessage,
    taskMessage,
    helpVisible,
  } = useSlashCommands({
    agentStop,
    clearSession,
    dismissUpdateBanner,
    getCurrentTaskTitle,
    iterationPause,
    refreshState,
    resumeSession,
    setActiveView,
    setManualNextTask,
    startIterations,
    stopAgent,
  });

  useSessionLifecycle(
    {
      autoResume,
      autoStart,
      dryRun,
      initialTask,
      iterations,
      maxRuntimeMs,
      skipVerification,
      version,
    },
    {
      activeView,
      agentError,
      appState,
      handleFatalError,
      loadInitialState,
      onTaskSet: (result, taskIdentifier) => {
        if (result.success) {
          setInitialTaskMessage({ text: `Task set: ${result.taskTitle}`, type: "success" });
        } else {
          setInitialTaskMessage({
            text: result.error ?? `Failed to set task: ${taskIdentifier}`,
            type: "error",
          });
        }
      },
      pendingSession,
      resumeSession,
      setIterations,
      setManualNextTask,
      startIterations,
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
      onClearConfirm={handleClearConfirm}
      onClearCancel={handleClearCancel}
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
        modelMessage={modelMessage}
        refreshMessage={refreshMessage}
        clearMessage={clearMessage}
        taskMessage={taskMessage}
        onCommand={handleSlashCommand}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion}
        updateBannerDismissed={updateBannerDismissed}
        helpVisible={helpVisible}
        onDismissHelp={dismissHelp}
        lastTechnicalDebtReport={lastTechnicalDebtReport}
      />
    </ViewRouter>
  );
}
