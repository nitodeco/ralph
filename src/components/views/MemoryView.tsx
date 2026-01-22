import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { match } from "ts-pattern";
import { ConfirmationDialog } from "@/components/common/index.ts";
import { ResponsiveLayout, useResponsive } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { getSessionMemoryService } from "@/lib/services/index.ts";
import { Header } from "../Header.tsx";

interface MemoryViewProps {
	version: string;
	onClose: () => void;
}

type MemoryTab = "lessons" | "patterns" | "failed" | "notes";
type ViewMode = "view" | "confirm-clear";

function MemoryHeader({ version }: { version: string }): React.ReactElement {
	const { isNarrow, isMedium } = useResponsive();
	const headerVariant = isNarrow ? "minimal" : isMedium ? "compact" : "full";

	return <Header version={version} variant={headerVariant} />;
}

function MemoryFooter(): React.ReactElement {
	return (
		<Box paddingX={1} flexDirection="column">
			<Text dimColor>Press q or Escape to close</Text>
			<Text dimColor>Use ←/→ to switch tabs | c to clear all memory</Text>
		</Box>
	);
}

export const MemoryView: React.FC<MemoryViewProps> = ({ version, onClose }) => {
	const sessionMemoryService = getSessionMemoryService();
	const [memory, setMemory] = useState(() => sessionMemoryService.get());
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [activeTab, setActiveTab] = useState<MemoryTab>("lessons");
	const [viewMode, setViewMode] = useState<ViewMode>("view");
	const hasMemory = sessionMemoryService.exists();

	const tabs: { key: MemoryTab; label: string; count: number }[] = [
		{ key: "lessons", label: "Lessons", count: memory.lessonsLearned.length },
		{ key: "patterns", label: "Patterns", count: memory.successfulPatterns.length },
		{ key: "failed", label: "Failed", count: memory.failedApproaches.length },
		{ key: "notes", label: "Notes", count: Object.keys(memory.taskNotes).length },
	];

	useInput((input, key) => {
		if (viewMode === "confirm-clear") {
			if (key.escape) {
				setViewMode("view");

				return;
			}

			if (key.return) {
				sessionMemoryService.clear();
				setMemory(sessionMemoryService.get());
				setMessage({ type: "success", text: "Session memory cleared" });
				setViewMode("view");
				setTimeout(() => setMessage(null), 3000);
			}

			return;
		}

		if (key.escape || input === "q") {
			onClose();

			return;
		}

		if (input === "c") {
			const stats = sessionMemoryService.getStats();

			if (
				stats.lessonsCount === 0 &&
				stats.patternsCount === 0 &&
				stats.failedApproachesCount === 0 &&
				stats.taskNotesCount === 0
			) {
				setMessage({ type: "error", text: "Session memory is already empty" });
				setTimeout(() => setMessage(null), 3000);
			} else {
				setViewMode("confirm-clear");
			}

			return;
		}

		if (key.leftArrow) {
			const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);
			const newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;

			setActiveTab(tabs[newIndex]?.key ?? "lessons");
		}

		if (key.rightArrow) {
			const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);
			const newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;

			setActiveTab(tabs[newIndex]?.key ?? "lessons");
		}
	});

	const renderTabContent = () => {
		return match(activeTab)
			.with("lessons", () => {
				if (memory.lessonsLearned.length === 0) {
					return <Text dimColor>No lessons recorded yet. Use /learn to add lessons.</Text>;
				}

				return (
					<Box flexDirection="column">
						{memory.lessonsLearned.map((lesson, index) => (
							<Text key={`lesson-${index}-${lesson.slice(0, 20)}`}>• {lesson}</Text>
						))}
					</Box>
				);
			})
			.with("patterns", () => {
				if (memory.successfulPatterns.length === 0) {
					return <Text dimColor>No successful patterns recorded yet.</Text>;
				}

				return (
					<Box flexDirection="column">
						{memory.successfulPatterns.map((pattern, index) => (
							<Text key={`pattern-${index}-${pattern.slice(0, 20)}`}>• {pattern}</Text>
						))}
					</Box>
				);
			})
			.with("failed", () => {
				if (memory.failedApproaches.length === 0) {
					return <Text dimColor>No failed approaches recorded yet.</Text>;
				}

				return (
					<Box flexDirection="column">
						{memory.failedApproaches.map((approach, index) => (
							<Text key={`failed-${index}-${approach.slice(0, 20)}`}>• {approach}</Text>
						))}
					</Box>
				);
			})
			.with("notes", () => {
				const taskTitles = Object.keys(memory.taskNotes);

				if (taskTitles.length === 0) {
					return <Text dimColor>No task notes recorded yet. Use /note to add notes.</Text>;
				}

				return (
					<Box flexDirection="column">
						{taskTitles.map((taskTitle) => (
							<Box key={taskTitle} flexDirection="column" marginBottom={1}>
								<Text bold color="yellow">
									{taskTitle}
								</Text>
								<Box paddingLeft={2}>
									<Text>{memory.taskNotes[taskTitle]}</Text>
								</Box>
							</Box>
						))}
					</Box>
				);
			})
			.exhaustive();
	};

	return (
		<ResponsiveLayout
			header={<MemoryHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1}>
						<Box flexDirection="column">
							<Text bold color="cyan">
								Session Memory: {memory.projectName}
							</Text>
							{hasMemory && <Text dimColor>Last updated: {memory.lastUpdated}</Text>}
						</Box>

						<Box marginTop={1} gap={2}>
							{tabs.map((tab) => (
								<Box key={tab.key}>
									<Text
										bold={activeTab === tab.key}
										color={activeTab === tab.key ? "cyan" : undefined}
										dimColor={activeTab !== tab.key}
									>
										{activeTab === tab.key ? "▸ " : "  "}
										{tab.label} ({tab.count})
									</Text>
								</Box>
							))}
						</Box>

						<Box
							flexDirection="column"
							marginTop={1}
							borderStyle="round"
							borderColor="gray"
							paddingX={1}
							paddingY={1}
						>
							{renderTabContent()}
						</Box>

						{viewMode === "confirm-clear" && (
							<ConfirmationDialog
								title="Clear all session memory?"
								message={`This will remove ${memory.lessonsLearned.length} lessons, ${memory.successfulPatterns.length} patterns, ${memory.failedApproaches.length} failed approaches, and ${Object.keys(memory.taskNotes).length} task notes.`}
							/>
						)}

						{message && (
							<Box marginTop={1}>
								<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
							</Box>
						)}
					</Box>
				</ScrollableContent>
			}
			footer={<MemoryFooter />}
			headerHeight={10}
			footerHeight={3}
		/>
	);
};
