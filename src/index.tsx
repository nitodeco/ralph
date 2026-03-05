#!/usr/bin/env bun

import { type Instance, render } from "ink";
import { useState } from "react";
import { match } from "ts-pattern";
import {
  handleAnalyzeClear,
  handleAnalyzeDebt,
  handleAnalyzeExport,
  handleAuthLogin,
  handleAuthLogout,
  handleDependencyAdd,
  handleDependencyRemove,
  handleDependencySet,
  handleGitHubClearToken,
  handleGitHubSetToken,
  handleGuardrailsAdd,
  handleGuardrailsGenerate,
  handleGuardrailsRemove,
  handleGuardrailsToggle,
  handleMemoryClear,
  handleMemoryExport,
  handleMigrateCommand,
  handleProgressAdd,
  handleProgressClear,
  handleProjectsPrune,
  handleStopCommand,
  handleTaskAdd,
  handleTaskDone,
  handleTaskEdit,
  handleTaskRemove,
  handleTaskUndone,
  parseArgs,
  printAnalyze,
  printArchive,
  printAuthStatus,
  printClear,
  printConfig,
  printCurrentProject,
  printCurrentTask,
  printDailyUsage,
  printDependencyBlocked,
  printDependencyGraph,
  printDependencyOrder,
  printDependencyReady,
  printDependencyShow,
  printDependencyValidate,
  printGitHubConfig,
  printGuardrails,
  printHelp,
  printList,
  printMemory,
  printProgress,
  printProjects,
  printRecentSessions,
  printStatus,
  printTaskList,
  printTaskShow,
  printUsage,
  printUsageSummary,
  printVersion,
} from "@/cli/index.ts";
import { ConsentWarning } from "@/components/ConsentWarning.tsx";
import { InitWizard } from "@/components/InitWizard.tsx";
import { RunApp } from "@/components/RunApp.tsx";
import { SetupWizard } from "@/components/SetupWizard.tsx";
import { UpdatePrompt } from "@/components/UpdatePrompt.tsx";
import {
  isBackgroundProcessRunning,
  isDaemonProcess,
  setShutdownHandler,
  setupSignalHandlers,
  spawnDaemonProcess,
  startMemoryMonitor,
  writePidFile,
} from "@/lib/daemon.ts";
import { checkRalphDirectoryIntegrity, formatIntegrityIssues } from "@/lib/integrity.ts";
import { getLogger } from "@/lib/logger.ts";
import {
  bootstrapServices,
  getConfigService,
  getOrchestrator,
  getSleepPreventionService,
  setIterationCoordinatorDependencies,
  setParallelExecutionManagerDependencies,
  setSessionManagerDependencies,
} from "@/lib/services/index.ts";
import {
  setAgentStoreDependencies,
  setAppStoreDependencies,
  useAgentStatusStore,
  useAgentStore,
  useAppStore,
  useIterationStore,
} from "@/stores/index.ts";
import type { Command } from "@/types.ts";
import packageJson from "../package.json";

declare const RALPH_VERSION: string | undefined;

export const VERSION = typeof RALPH_VERSION !== "undefined" ? RALPH_VERSION : packageJson.version;

let maybeInkInstance: Instance | null = null;

export function unmountInk(): void {
  if (maybeInkInstance) {
    maybeInkInstance.unmount();
    maybeInkInstance = null;
  }
}

function clearTerminal(): void {
  process.stdout.write("\x1b[?25h\x1b[2J\x1b[H");
}

interface RunWithSetupProps {
  version: string;
  iterations: number;
  autoResume?: boolean;
  autoStart?: boolean;
  dryRun?: boolean;
  initialTask?: string;
  maxRuntimeMs?: number;
  skipVerification?: boolean;
}

function RunWithSetup({
  version,
  iterations,
  autoResume = false,
  autoStart = false,
  dryRun = false,
  initialTask,
  maxRuntimeMs,
  skipVerification = false,
}: RunWithSetupProps): React.ReactElement {
  const configService = getConfigService();
  const [consentGiven, setConsentGiven] = useState(configService.hasAcknowledgedWarning());
  const [setupComplete, setSetupComplete] = useState(configService.globalConfigExists());

  if (!consentGiven) {
    return <ConsentWarning version={version} onAccept={() => setConsentGiven(true)} />;
  }

  if (!setupComplete) {
    return <SetupWizard version={version} onComplete={() => setSetupComplete(true)} />;
  }

  return (
    <RunApp
      version={version}
      iterations={iterations}
      autoResume={autoResume}
      autoStart={autoStart || Boolean(initialTask)}
      dryRun={dryRun}
      initialTask={initialTask}
      maxRuntimeMs={maxRuntimeMs}
      skipVerification={skipVerification}
    />
  );
}

function handleBackgroundMode(_command: Command, _iterations: number): void {
  const { running, pid } = isBackgroundProcessRunning();

  if (running && pid !== null) {
    console.log(`Ralph is already running in background (PID: ${pid})`);
    console.log("Use 'ralph stop' to stop the background process");
    process.exit(1);
  }

  const config = getConfigService().get();
  const relevantArgs = process.argv.slice(2);

  const daemonPid = spawnDaemonProcess({
    args: relevantArgs,
    logFilePath: config.logFilePath,
  });

  if (daemonPid !== null) {
    console.log(`Ralph started in background mode (PID: ${daemonPid})`);
    console.log(`Logs are being written to: ${config.logFilePath ?? getLogger().getLogFilePath()}`);
    console.log("Use 'ralph status' to check progress");
    console.log("Use 'ralph stop' to stop the background process");
  } else {
    console.error("Failed to start Ralph in background mode");
    process.exit(1);
  }
}

function main(): void {
  bootstrapServices();

  setAgentStoreDependencies({
    resetStatus: () => {
      useAgentStatusStore.getState().reset();
    },
    setFileChanges: (stats) => {
      useAgentStatusStore.getState().setFileChanges(stats);
    },
    setPhase: (phase) => {
      useAgentStatusStore.getState().setPhase(phase);
    },
  });

  setAppStoreDependencies({
    agent: {
      getIsComplete: () => useAgentStore.getState().isComplete,
      getIsStreaming: () => useAgentStore.getState().isStreaming,
      reset: () => useAgentStore.getState().reset(),
      stop: () => useAgentStore.getState().stop(),
    },
    iteration: {
      getCurrent: () => useIterationStore.getState().current,
      getIsRunning: () => useIterationStore.getState().isRunning,
      getTotal: () => useIterationStore.getState().total,
      markIterationComplete: (isProjectComplete, hasPendingTasks) =>
        useIterationStore.getState().markIterationComplete(isProjectComplete, hasPendingTasks),
      reset: () => useIterationStore.getState().reset(),
      restartCurrentIteration: () => useIterationStore.getState().restartCurrentIteration(),
      setFullMode: (isFullMode) => useIterationStore.getState().setFullMode(isFullMode),
      setMaxRuntimeMs: (maxRuntimeMs) => useIterationStore.getState().setMaxRuntimeMs(maxRuntimeMs),
      setStartTime: (startTime) => useIterationStore.getState().setStartTime(startTime),
      setTotal: (total) => useIterationStore.getState().setTotal(total),
      start: () => useIterationStore.getState().start(),
      startFromIteration: (iteration) => useIterationStore.getState().startFromIteration(iteration),
      stop: () => useIterationStore.getState().stop(),
    },
  });

  setSessionManagerDependencies({
    getAgentStoreState: () => {
      const state = useAgentStore.getState();

      return {
        exitCode: state.exitCode,
        output: state.output,
        retryCount: state.retryCount,
      };
    },
    getIterationStoreState: () => {
      const state = useIterationStore.getState();

      return {
        current: state.current,
      };
    },
  });

  setIterationCoordinatorDependencies({
    completeTaskBranch: async (prd) => getOrchestrator().completeTaskBranch(prd),
    createTaskBranch: (taskTitle, taskIndex) =>
      getOrchestrator().createTaskBranch(taskTitle, taskIndex),
    getAgentStoreState: () => {
      const state = useAgentStore.getState();

      return {
        error: state.error,
        exitCode: state.exitCode,
        isComplete: state.isComplete,
        output: state.output,
        reset: state.reset,
        retryCount: state.retryCount,
      };
    },
    getAppStoreState: () => {
      const state = useAppStore.getState();

      return {
        clearManualNextTask: state.clearManualNextTask,
        currentSession: state.currentSession,
        elapsedTime: state.elapsedTime,
        getEffectiveNextTask: state.getEffectiveNextTask,
        isReviewingTechnicalDebt: state.isReviewingTechnicalDebt,
        isVerifying: state.isVerifying,
        lastDecomposition: state.lastDecomposition,
        lastTechnicalDebtReport: state.lastTechnicalDebtReport,
        lastVerificationResult: state.lastVerificationResult,
        manualNextTask: state.manualNextTask,
        prd: state.prd,
        setPrd: state.setPrd,
      };
    },
    getIterationStoreState: () => {
      const state = useIterationStore.getState();

      return {
        current: state.current,
        restartCurrentIteration: state.restartCurrentIteration,
        setCallbacks: state.setCallbacks,
        total: state.total,
      };
    },
    resetAgent: () => {
      useAgentStore.getState().reset();
    },
    setAppStoreState: (newState) => {
      useAppStore.setState(newState);
    },
    startAgent: (specificTask) => {
      useAgentStore.getState().start(specificTask);
    },
    stopAgent: () => {
      useAgentStore.getState().stop();
    },
  });

  setParallelExecutionManagerDependencies({
    getAppStoreState: () => {
      const state = useAppStore.getState();

      return {
        currentSession: state.currentSession,
        prd: state.prd,
      };
    },
    setAppStoreState: (newState) => {
      useAppStore.setState(newState);
    },
  });

  const {
    command,
    iterations,
    background,
    json,
    dryRun,
    verbose,
    force,
    task,
    maxRuntimeMs,
    skipVerification,
    guardrailsSubcommand,
    guardrailsArg,
    guardrailsGenerateOptions,
    analyzeSubcommand,
    memorySubcommand,
    projectsSubcommand,
    taskSubcommand,
    taskIdentifier,
    taskAddOptions,
    taskEditOptions,
    progressSubcommand,
    progressText,
    dependencySubcommand,
    dependencySetOptions,
    dependencyModifyOptions,
    usageSubcommand,
    usageLimit,
    githubSubcommand,
    githubToken,
    authSubcommand,
  } = parseArgs(process.argv);

  setShutdownHandler({
    onShutdown: () => {
      unmountInk();
      getSleepPreventionService().stop();
      getOrchestrator().cleanup();
      const agentStore = useAgentStore.getState();

      agentStore.stop();
    },
  });

  setupSignalHandlers();

  const integrityResult = checkRalphDirectoryIntegrity();
  const integrityWarnings = formatIntegrityIssues(integrityResult);

  if (isDaemonProcess()) {
    writePidFile(process.pid);
  } else {
    clearTerminal();

    if (integrityWarnings) {
      console.warn(integrityWarnings);
    }
  }

  if (background && !isDaemonProcess()) {
    if (command !== "run" && command !== "resume") {
      console.error("Background mode is only supported for 'run' and 'resume' commands");
      process.exit(1);
    }

    if (dryRun) {
      console.error("Dry-run mode cannot be used with background mode");
      process.exit(1);
    }

    handleBackgroundMode(command, iterations);

    return;
  }

  const autoStart = isDaemonProcess() || dryRun;
  const ralphConfig = getConfigService().get();
  const memoryThresholdMb = ralphConfig.memory?.memoryThresholdMb;

  match(command)
    .with("run", () => {
      getSleepPreventionService().start();
      startMemoryMonitor(memoryThresholdMb);
      maybeInkInstance = render(
        <RunWithSetup
          version={VERSION}
          iterations={task ? 1 : iterations}
          autoStart={autoStart}
          dryRun={dryRun}
          initialTask={task}
          maxRuntimeMs={maxRuntimeMs}
          skipVerification={skipVerification}
        />,
      );
    })
    .with("resume", () => {
      getSleepPreventionService().start();
      startMemoryMonitor(memoryThresholdMb);
      maybeInkInstance = render(
        <RunWithSetup
          version={VERSION}
          iterations={iterations}
          autoResume
          autoStart={autoStart}
          dryRun={dryRun}
          initialTask={task}
          maxRuntimeMs={maxRuntimeMs}
          skipVerification={skipVerification}
        />,
      );
    })
    .with("init", () => {
      maybeInkInstance = render(<InitWizard version={VERSION} />);
    })
    .with("setup", () => {
      maybeInkInstance = render(<SetupWizard version={VERSION} />);
    })
    .with("update", () => {
      maybeInkInstance = render(<UpdatePrompt version={VERSION} forceCheck />);
    })
    .with("status", () => {
      printStatus(VERSION, verbose);
    })
    .with("list", () => {
      printList(VERSION, json, verbose);
    })
    .with("config", () => {
      printConfig(VERSION, json, verbose);
    })
    .with("auth", () => {
      match(authSubcommand)
        .with("login", () => {
          handleAuthLogin(json).catch((error) => {
            console.error("Auth login failed:", error);
            process.exit(1);
          });
        })
        .with("logout", () => {
          handleAuthLogout(json).catch((error) => {
            console.error("Auth logout failed:", error);
            process.exit(1);
          });
        })
        .otherwise(() => printAuthStatus(VERSION, json));
    })
    .with("github", () => {
      match(githubSubcommand)
        .with("set-token", () => handleGitHubSetToken(githubToken, json))
        .with("clear-token", () => handleGitHubClearToken(json))
        .otherwise(() => printGitHubConfig(VERSION, json));
    })
    .with("archive", () => {
      printArchive(VERSION);
    })
    .with("clear", () => {
      printClear(VERSION, force);
    })
    .with("guardrails", () => {
      match(guardrailsSubcommand)
        .with("add", () => handleGuardrailsAdd(guardrailsArg ?? ""))
        .with("remove", () => handleGuardrailsRemove(guardrailsArg ?? ""))
        .with("toggle", () => handleGuardrailsToggle(guardrailsArg ?? ""))
        .with("generate", () => handleGuardrailsGenerate(guardrailsGenerateOptions ?? {}, json))
        .otherwise(() => printGuardrails(VERSION, json));
    })
    .with("analyze", () => {
      match(analyzeSubcommand)
        .with("export", () => handleAnalyzeExport())
        .with("clear", () => handleAnalyzeClear())
        .with("debt", () => handleAnalyzeDebt(json))
        .otherwise(() => printAnalyze(json));
    })
    .with("memory", () => {
      match(memorySubcommand)
        .with("export", () => handleMemoryExport())
        .with("clear", () => handleMemoryClear(force))
        .otherwise(() => printMemory(json));
    })
    .with("migrate", () => {
      handleMigrateCommand(VERSION);
    })
    .with("projects", () => {
      match(projectsSubcommand)
        .with("current", () => printCurrentProject(json))
        .with("prune", () => handleProjectsPrune(json))
        .otherwise(() => printProjects(VERSION, json));
    })
    .with("task", () => {
      match(taskSubcommand)
        .with("add", () => {
          handleTaskAdd(taskAddOptions ?? {}, json).catch((error) => {
            console.error("Failed to add task:", error);
            process.exit(1);
          });
        })
        .with("edit", () => {
          handleTaskEdit(taskIdentifier ?? "", taskEditOptions ?? {}, json).catch((error) => {
            console.error("Failed to edit task:", error);
            process.exit(1);
          });
        })
        .with("remove", () => handleTaskRemove(taskIdentifier ?? "", json))
        .with("show", () => printTaskShow(taskIdentifier ?? "", json))
        .with("done", () => handleTaskDone(taskIdentifier ?? "", json))
        .with("undone", () => handleTaskUndone(taskIdentifier ?? "", json))
        .with("current", () => printCurrentTask(json))
        .otherwise(() => printTaskList(json));
    })
    .with("progress", () => {
      match(progressSubcommand)
        .with("add", () => handleProgressAdd(progressText ?? "", json))
        .with("clear", () => handleProgressClear(json))
        .otherwise(() => printProgress(json));
    })
    .with("dependency", () => {
      match(dependencySubcommand)
        .with("validate", () => printDependencyValidate(json))
        .with("ready", () => printDependencyReady(json))
        .with("blocked", () => printDependencyBlocked(json))
        .with("order", () => printDependencyOrder(json))
        .with("show", () => printDependencyShow(dependencySetOptions?.taskIdentifier ?? "", json))
        .with("set", () =>
          handleDependencySet(
            dependencySetOptions?.taskIdentifier ?? "",
            dependencySetOptions?.dependencies ?? [],
            json,
          ),
        )
        .with("add", () =>
          handleDependencyAdd(
            dependencyModifyOptions?.taskIdentifier ?? "",
            dependencyModifyOptions?.dependencyId ?? "",
            json,
          ),
        )
        .with("remove", () =>
          handleDependencyRemove(
            dependencyModifyOptions?.taskIdentifier ?? "",
            dependencyModifyOptions?.dependencyId ?? "",
            json,
          ),
        )
        .otherwise(() => printDependencyGraph(json));
    })
    .with("usage", () => {
      match(usageSubcommand)
        .with("summary", () => printUsageSummary(json))
        .with("sessions", () => printRecentSessions(usageLimit ?? 10, json))
        .with("daily", () => printDailyUsage(usageLimit ?? 7, json))
        .otherwise(() => printUsage(json));
    })
    .with("stop", () => {
      handleStopCommand(VERSION).catch((error) => {
        console.error("Failed to stop:", error);
        process.exit(1);
      });
    })
    .with("version", "-v", "--version", () => {
      printVersion(VERSION);
    })
    .otherwise(() => {
      printHelp(VERSION);
    });
}

main();
