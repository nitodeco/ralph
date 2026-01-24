import { getErrorMessage } from "@/lib/errors.ts";
import type { AgentCompleteEvent } from "@/lib/events.ts";
import { eventBus } from "@/lib/events.ts";
import { DecompositionHandler, VerificationHandler } from "@/lib/handlers/index.ts";
import { getLogger } from "@/lib/logger.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import { getConfigService, getIterationCoordinator, getPrdService } from "../container.ts";
import type {
	HandlerCoordinator,
	HandlerCoordinatorCallbacks,
	HandlerCoordinatorConfig,
} from "./types.ts";

export function createHandlerCoordinator(): HandlerCoordinator {
	let decompositionHandler: DecompositionHandler | null = null;
	let verificationHandler: VerificationHandler | null = null;
	let unsubscribers: (() => void)[] = [];
	let currentConfig: HandlerCoordinatorConfig | null = null;
	let currentCallbacks: HandlerCoordinatorCallbacks | null = null;

	function initialize(
		config: HandlerCoordinatorConfig,
		callbacks: HandlerCoordinatorCallbacks,
	): void {
		cleanup();

		currentConfig = config;
		currentCallbacks = callbacks;

		decompositionHandler = new DecompositionHandler({
			config: config.config,
			onPrdUpdate: callbacks.onPrdUpdate,
			onRestartIteration: callbacks.onRestartIteration,
		});

		verificationHandler = new VerificationHandler({
			onStateChange: callbacks.onVerificationStateChange,
		});

		setupSubscriptions();
	}

	function setupSubscriptions(): void {
		const config = currentConfig?.config ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const iterationCoordinator = getIterationCoordinator();

		unsubscribers.push(
			eventBus.on("agent:complete", (event) => {
				try {
					handleAgentComplete(event).catch((error) => {
						logger.error("Error in handleAgentComplete", { error: getErrorMessage(error) });
						currentCallbacks?.onIterationComplete(false, true);
					});
				} catch (error) {
					logger.error("Sync error in agent:complete handler", { error: getErrorMessage(error) });
					currentCallbacks?.onIterationComplete(false, true);
				}
			}),
		);

		unsubscribers.push(
			eventBus.on("agent:error", (event) => {
				try {
					if (event.retryContexts) {
						iterationCoordinator.setLastRetryContexts(event.retryContexts);
					}

					if (event.isFatal && currentCallbacks) {
						currentCallbacks.onFatalError(event.error, getPrdService().get(), null);
						currentCallbacks.onAppStateChange("error");
					}
				} catch (error) {
					logger.error("Error in agent:error handler", { error: getErrorMessage(error) });
					currentCallbacks?.onAppStateChange("error");
				}
			}),
		);
	}

	async function handleAgentComplete(event: AgentCompleteEvent): Promise<void> {
		if (!currentConfig || !currentCallbacks) {
			return;
		}

		const iterationCoordinator = getIterationCoordinator();

		if (event.retryContexts) {
			iterationCoordinator.setLastRetryContexts(event.retryContexts);
		}

		const prdService = getPrdService();
		const currentPrd = prdService.reload();

		if (event.hasDecompositionRequest && event.decompositionRequest && decompositionHandler) {
			const handled = decompositionHandler.handle(event.decompositionRequest, currentPrd);

			if (handled) {
				iterationCoordinator.setLastDecomposition(event.decompositionRequest);

				return;
			}
		}

		const allTasksActuallyDone = currentPrd
			? currentPrd.tasks.length > 0 && currentPrd.tasks.every((task) => task.done)
			: false;

		const hasPendingTasks = currentPrd ? currentPrd.tasks.some((task) => !task.done) : false;

		const verificationConfig = currentConfig.config.verification;

		if (
			verificationConfig?.enabled &&
			!currentConfig.skipVerification &&
			!allTasksActuallyDone &&
			verificationHandler
		) {
			try {
				const verificationResult = await verificationHandler.run(verificationConfig);

				if (!verificationResult.passed) {
					const config = currentConfig?.config ?? getConfigService().get();
					const reloadedPrd = prdService.reload();
					const iterationStore = getIterationCoordinator();

					sendNotifications(config.notifications, "verification_failed", reloadedPrd?.project, {
						failedChecks: verificationResult.failedChecks,
						iteration: (iterationStore as unknown as { current?: number }).current ?? 0,
					});

					currentCallbacks.onIterationComplete(false, hasPendingTasks);

					return;
				}
			} catch (verificationError) {
				const config = currentConfig?.config ?? getConfigService().get();
				const logger = getLogger({ logFilePath: config.logFilePath });

				logger.error("Verification handler threw an error, continuing without verification", {
					error: getErrorMessage(verificationError),
				});
				verificationHandler?.reset();
			}
		} else {
			verificationHandler?.reset();
		}

		currentCallbacks.onIterationComplete(allTasksActuallyDone, hasPendingTasks);
	}

	function getIsVerifying(): boolean {
		return verificationHandler?.getIsRunning() ?? false;
	}

	function cleanup(): void {
		for (const unsubscribe of unsubscribers) {
			unsubscribe();
		}

		unsubscribers = [];
		decompositionHandler?.reset();
		verificationHandler?.reset();
		decompositionHandler = null;
		verificationHandler = null;
		currentConfig = null;
		currentCallbacks = null;
	}

	return {
		initialize,
		getIsVerifying,
		cleanup,
	};
}
