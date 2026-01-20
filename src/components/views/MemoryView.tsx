import { Box, Text, useInput } from "ink";
import { useState } from "react";
import {
	clearSessionMemory,
	getSessionMemoryStats,
	loadSessionMemory,
	sessionMemoryExists,
} from "@/lib/session-memory.ts";
import { Header } from "../Header.tsx";

interface MemoryViewProps {
	version: string;
	onClose: () => void;
}

type MemoryTab = "lessons" | "patterns" | "failed" | "notes";

export const MemoryView: React.FC<MemoryViewProps> = ({ version, onClose }) => {
	const [memory] = useState(() => loadSessionMemory());
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [activeTab, setActiveTab] = useState<MemoryTab>("lessons");
	const hasMemory = sessionMemoryExists();

	const tabs: { key: MemoryTab; label: string; count: number }[] = [
		{ key: "lessons", label: "Lessons", count: memory.lessonsLearned.length },
		{ key: "patterns", label: "Patterns", count: memory.successfulPatterns.length },
		{ key: "failed", label: "Failed", count: memory.failedApproaches.length },
		{ key: "notes", label: "Notes", count: Object.keys(memory.taskNotes).length },
	];

	useInput((input, key) => {
		if (key.escape || input === "q") {
			onClose();
		}

		if (input === "c") {
			const stats = getSessionMemoryStats();

			if (
				stats.lessonsCount === 0 &&
				stats.patternsCount === 0 &&
				stats.failedApproachesCount === 0 &&
				stats.taskNotesCount === 0
			) {
				setMessage({ type: "error", text: "Session memory is already empty" });
			} else {
				clearSessionMemory();
				setMessage({ type: "success", text: "Session memory cleared" });
			}

			setTimeout(() => setMessage(null), 3000);
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
		switch (activeTab) {
			case "lessons":
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

			case "patterns":
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

			case "failed":
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

			case "notes": {
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
			}
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />

			<Box flexDirection="column" marginTop={1}>
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
				minHeight={10}
			>
				{renderTabContent()}
			</Box>

			{message && (
				<Box marginTop={1}>
					<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
				</Box>
			)}

			<Box marginTop={1} flexDirection="column">
				<Text dimColor>Press q or Escape to close</Text>
				<Text dimColor>Use ←/→ to switch tabs</Text>
				<Text dimColor>Press c to clear all memory</Text>
			</Box>
		</Box>
	);
};
