import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog.tsx";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { TextInput } from "@/components/common/TextInput.tsx";
import { MESSAGE_DISMISS_TIMEOUT_MS } from "@/lib/constants/ui.ts";
import { type CustomRule, getRulesService, type RuleScope } from "@/lib/services/index.ts";

interface RulesViewProps {
	version: string;
	onClose: () => void;
}

type ViewMode = "list" | "add" | "confirm-delete" | "select-scope";

interface RulesState {
	globalRules: CustomRule[];
	projectRules: CustomRule[];
}

interface SelectedRule {
	rule: CustomRule;
	scope: RuleScope;
	displayIndex: number;
}

function RulesHeader({ version }: { version: string }): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph v{version} - Custom Rules
			</Text>
		</Box>
	);
}

interface RulesFooterProps {
	viewMode: ViewMode;
}

function RulesFooter({ viewMode }: RulesFooterProps): React.ReactElement {
	if (viewMode === "add") {
		return (
			<Box paddingX={1}>
				<Text dimColor>Press Enter to add, Escape to cancel</Text>
			</Box>
		);
	}

	if (viewMode === "select-scope") {
		return (
			<Box paddingX={1}>
				<Text dimColor>g Global | p Project | Escape to cancel</Text>
			</Box>
		);
	}

	return (
		<Box paddingX={1}>
			<Text dimColor>↑/↓ Navigate | a Add | d Delete | q/Esc Close</Text>
		</Box>
	);
}

function getSelectedRule(rulesState: RulesState, selectedIndex: number): SelectedRule | null {
	const { globalRules, projectRules } = rulesState;

	if (selectedIndex < globalRules.length) {
		const maybeRule = globalRules.at(selectedIndex);

		if (maybeRule) {
			return { rule: maybeRule, scope: "global", displayIndex: selectedIndex };
		}
	}

	const projectIndex = selectedIndex - globalRules.length;
	const maybeRule = projectRules.at(projectIndex);

	if (maybeRule) {
		return { rule: maybeRule, scope: "project", displayIndex: selectedIndex };
	}

	return null;
}

export function RulesView({ version, onClose }: RulesViewProps): React.ReactElement {
	const rulesService = getRulesService();
	const [rulesState, setRulesState] = useState<RulesState>(() => ({
		globalRules: rulesService.getGlobal(),
		projectRules: rulesService.getProject(),
	}));
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [newInstruction, setNewInstruction] = useState("");
	const [selectedScope, setSelectedScope] = useState<RuleScope>("project");
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const totalRules = rulesState.globalRules.length + rulesState.projectRules.length;

	const refreshRules = () => {
		rulesService.invalidate();
		setRulesState({
			globalRules: rulesService.getGlobal(),
			projectRules: rulesService.getProject(),
		});
	};

	const showMessage = (type: "success" | "error", text: string) => {
		setMessage({ type, text });
		setTimeout(() => setMessage(null), MESSAGE_DISMISS_TIMEOUT_MS);
	};

	useInput((input, key) => {
		if (viewMode === "confirm-delete") {
			if (key.escape) {
				setViewMode("list");

				return;
			}

			if (key.return) {
				const selectedRule = getSelectedRule(rulesState, selectedIndex);

				if (selectedRule) {
					rulesService.remove(selectedRule.rule.id, selectedRule.scope);
					refreshRules();

					const newTotalRules = rulesState.globalRules.length + rulesState.projectRules.length - 1;

					if (selectedIndex >= newTotalRules) {
						setSelectedIndex(Math.max(0, newTotalRules - 1));
					}

					showMessage("success", `Removed ${selectedRule.scope} rule`);
				}

				setViewMode("list");
			}

			return;
		}

		if (viewMode === "select-scope") {
			if (key.escape) {
				setViewMode("list");

				return;
			}

			if (input === "g") {
				setSelectedScope("global");
				setViewMode("add");
			}

			if (input === "p") {
				setSelectedScope("project");
				setViewMode("add");
			}

			return;
		}

		if (viewMode === "add") {
			if (key.escape) {
				setViewMode("list");
				setNewInstruction("");
			}

			return;
		}

		if (key.escape || input === "q") {
			onClose();

			return;
		}

		if (key.upArrow && selectedIndex > 0) {
			setSelectedIndex(selectedIndex - 1);
		}

		if (key.downArrow && selectedIndex < totalRules - 1) {
			setSelectedIndex(selectedIndex + 1);
		}

		if (input === "a") {
			setViewMode("select-scope");
		}

		if (input === "d" && totalRules > 0) {
			setViewMode("confirm-delete");
		}
	});

	const handleAddSubmit = (value: string) => {
		if (value.trim()) {
			rulesService.add({ instruction: value.trim(), scope: selectedScope });
			refreshRules();
			showMessage("success", `Added ${selectedScope} rule`);
		}

		setNewInstruction("");
		setViewMode("list");
	};

	const renderRulesSection = (
		rules: CustomRule[],
		sectionTitle: string,
		scope: RuleScope,
		startIndex: number,
	) => {
		if (rules.length === 0) {
			return (
				<Box flexDirection="column" marginTop={1}>
					<Text bold color="yellow">
						{sectionTitle}: <Text dimColor>(none)</Text>
					</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column" marginTop={1}>
				<Text bold color="yellow">
					{sectionTitle}:
				</Text>
				<Box flexDirection="column" marginTop={1}>
					{rules.map((rule, index) => {
						const displayIndex = startIndex + index;
						const isSelected = displayIndex === selectedIndex;

						return (
							<Box key={rule.id} flexDirection="column">
								<Box>
									<Text color={isSelected ? "cyan" : undefined}>{isSelected ? "❯ " : "  "}</Text>
									<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
										{displayIndex + 1}. {rule.instruction}
									</Text>
								</Box>
								{isSelected && (
									<Box paddingLeft={4}>
										<Text dimColor>
											id: {rule.id} | scope: {scope}
										</Text>
									</Box>
								)}
							</Box>
						);
					})}
				</Box>
			</Box>
		);
	};

	const selectedRule = getSelectedRule(rulesState, selectedIndex);

	return (
		<ResponsiveLayout
			header={<RulesHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1} gap={1}>
						{viewMode === "select-scope" ? (
							<Box flexDirection="column">
								<Text bold color="yellow">
									Select Rule Scope:
								</Text>
								<Box marginTop={1} flexDirection="column" gap={1}>
									<Text>
										<Text color="cyan">g</Text> - Global (applies to all projects)
									</Text>
									<Text>
										<Text color="cyan">p</Text> - Project (applies to this project only)
									</Text>
								</Box>
							</Box>
						) : viewMode === "add" ? (
							<Box flexDirection="column">
								<Text bold color="yellow">
									Add New {selectedScope === "global" ? "Global" : "Project"} Rule:
								</Text>
								<Box marginTop={1} gap={1}>
									<Text color="cyan">❯</Text>
									<TextInput
										value={newInstruction}
										onChange={setNewInstruction}
										onSubmit={handleAddSubmit}
										placeholder="Enter rule instruction..."
									/>
								</Box>
							</Box>
						) : (
							<>
								<Box flexDirection="column">
									<Text bold color="yellow">
										Custom Rules ({totalRules} total):
									</Text>
									{totalRules === 0 ? (
										<Box marginTop={1}>
											<Text dimColor>No custom rules configured. Press 'a' to add one.</Text>
										</Box>
									) : (
										<>
											{renderRulesSection(rulesState.globalRules, "Global Rules", "global", 0)}
											{renderRulesSection(
												rulesState.projectRules,
												"Project Rules",
												"project",
												rulesState.globalRules.length,
											)}
										</>
									)}
								</Box>

								{viewMode === "confirm-delete" && selectedRule && (
									<ConfirmationDialog
										title={`Delete ${selectedRule.scope} rule?`}
										message={`"${selectedRule.rule.instruction}"`}
									/>
								)}

								{message && (
									<Box marginTop={1}>
										<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
									</Box>
								)}
							</>
						)}
					</Box>
				</ScrollableContent>
			}
			footer={<RulesFooter viewMode={viewMode} />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
