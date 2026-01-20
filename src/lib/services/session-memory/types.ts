export interface SessionMemory {
	projectName: string;
	lessonsLearned: string[];
	successfulPatterns: string[];
	failedApproaches: string[];
	taskNotes: Record<string, string>;
	lastUpdated: string;
}

export interface SessionMemoryStats {
	lessonsCount: number;
	patternsCount: number;
	failedApproachesCount: number;
	taskNotesCount: number;
	lastUpdated: string | null;
}

export const SESSION_MEMORY_CONSTANTS = {
	MAX_LESSONS: 50,
	MAX_PATTERNS: 20,
	MAX_FAILED_APPROACHES: 20,
} as const;

export interface SessionMemoryService {
	get(): SessionMemory;
	load(projectName?: string): SessionMemory;
	save(memory: SessionMemory): void;
	exists(): boolean;
	initialize(projectName: string): SessionMemory;
	invalidate(): void;

	addLesson(lesson: string): void;
	addSuccessPattern(pattern: string): void;
	addFailedApproach(approach: string): void;
	addTaskNote(taskTitle: string, note: string): void;
	getTaskNote(taskTitle: string): string | null;
	clear(): void;

	getStats(): SessionMemoryStats;
	formatForPrompt(): string;
	formatForTask(taskTitle: string): string;
	exportAsMarkdown(): string;
}
