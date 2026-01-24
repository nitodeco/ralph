import type { DecompositionRequest, IterationLogRetryContext } from "@/types.ts";

export interface AgentCompleteEvent {
	isComplete: boolean;
	exitCode: number | null;
	outputLength: number;
	outputPreview: string;
	retryCount: number;
	retryContexts?: IterationLogRetryContext[];
	hasDecompositionRequest: boolean;
	decompositionRequest?: DecompositionRequest;
}

export interface AgentErrorEvent {
	error: string;
	exitCode: number | null;
	isFatal: boolean;
	retryContexts?: IterationLogRetryContext[];
}

export interface EventMap {
	"agent:complete": AgentCompleteEvent;
	"agent:error": AgentErrorEvent;
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

	getListenerCount(eventName?: EventName): number {
		if (eventName) {
			return this.handlers.get(eventName)?.size ?? 0;
		}

		let totalCount = 0;

		for (const handlersSet of this.handlers.values()) {
			totalCount += handlersSet.size;
		}

		return totalCount;
	}

	getListenerStats(): Record<string, number> {
		const stats: Record<string, number> = {};

		for (const [eventName, handlersSet] of this.handlers.entries()) {
			stats[eventName] = handlersSet.size;
		}

		return stats;
	}
}

export const eventBus = new TypedEventEmitter();
