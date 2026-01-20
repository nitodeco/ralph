import type { IterationLogRetryContext } from "@/types.ts";
import type { FailureAnalysis } from "./failure-analyzer.ts";

export interface AgentStartEvent {
	agentType: string;
}

export interface AgentCompleteEvent {
	isComplete: boolean;
	exitCode: number | null;
	output: string;
	retryCount: number;
	retryContexts?: IterationLogRetryContext[];
}

export interface AgentErrorEvent {
	error: string;
	exitCode: number | null;
	isFatal: boolean;
	retryContexts?: IterationLogRetryContext[];
}

export interface AgentRetryEvent {
	retryCount: number;
	maxRetries: number;
	delayMs: number;
	failureAnalysis?: FailureAnalysis;
}

export interface IterationStartEvent {
	iteration: number;
	totalIterations: number;
}

export interface IterationCompleteEvent {
	iteration: number;
	isProjectComplete: boolean;
}

export interface IterationDelayEvent {
	iteration: number;
	delayMs: number;
}

export interface SessionStartEvent {
	totalIterations: number;
	taskIndex: number;
}

export interface SessionResumeEvent {
	currentIteration: number;
	totalIterations: number;
	elapsedTimeSeconds: number;
}

export interface SessionStopEvent {
	reason: "user_stop" | "fatal_error" | "max_iterations" | "max_runtime";
}

export interface SessionCompleteEvent {
	totalIterations: number;
}

export interface EventMap {
	"agent:start": AgentStartEvent;
	"agent:complete": AgentCompleteEvent;
	"agent:error": AgentErrorEvent;
	"agent:retry": AgentRetryEvent;
	"iteration:start": IterationStartEvent;
	"iteration:complete": IterationCompleteEvent;
	"iteration:delay": IterationDelayEvent;
	"session:start": SessionStartEvent;
	"session:resume": SessionResumeEvent;
	"session:stop": SessionStopEvent;
	"session:complete": SessionCompleteEvent;
}

export type EventName = keyof EventMap;

type EventHandler<T> = (event: T) => void;

class TypedEventEmitter {
	private handlers: Map<EventName, Set<EventHandler<unknown>>> = new Map();

	on<K extends EventName>(eventName: K, handler: EventHandler<EventMap[K]>): () => void {
		if (!this.handlers.has(eventName)) {
			this.handlers.set(eventName, new Set());
		}
		this.handlers.get(eventName)?.add(handler as EventHandler<unknown>);

		return () => {
			this.off(eventName, handler);
		};
	}

	off<K extends EventName>(eventName: K, handler: EventHandler<EventMap[K]>): void {
		const eventHandlers = this.handlers.get(eventName);
		if (eventHandlers) {
			eventHandlers.delete(handler as EventHandler<unknown>);
		}
	}

	emit<K extends EventName>(eventName: K, event: EventMap[K]): void {
		const eventHandlers = this.handlers.get(eventName);
		if (eventHandlers) {
			for (const handler of eventHandlers) {
				handler(event);
			}
		}
	}

	removeAllListeners(eventName?: EventName): void {
		if (eventName) {
			this.handlers.delete(eventName);
		} else {
			this.handlers.clear();
		}
	}
}

export const eventBus = new TypedEventEmitter();
