import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog.tsx";
import { DetailPanel } from "@/components/common/DetailPanel.tsx";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { SelectableList } from "@/components/common/SelectableList.tsx";
import { TextInput } from "@/components/common/TextInput.tsx";
import { useListNavigation } from "@/hooks/useListNavigation.ts";
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

interface RuleWithScope {
	rule: CustomRule;
	scope: RuleScope;
	globalIndex: number;
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

function createRulesWithScope(rulesState: RulesState): RuleWithScope[] {
	const globalRulesWithScope: RuleWithScope[] = rulesState.globalRules.map((rule, index) => ({
		rule,
		scope: "global" as RuleScope,
		globalIndex: index,
	}));

	const projectRulesWithScope: RuleWithScope[] = rulesState.projectRules.map((rule, index) => ({
		rule,
		scope: "project" as RuleScope,
		globalIndex: rulesState.globalRules.length + index,
	}));

	return [...globalRulesWithScope, ...projectRulesWithScope];
}

interface RuleItemProps {
	ruleWithScope: RuleWithScope;
	isSelected: boolean;
}

function RuleItem({ ruleWithScope, isSelected }: RuleItemProps): React.ReactElement {
	const { rule, globalIndex } = ruleWithScope;

	return (
		<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
			{globalIndex + 1}. {rule.instruction}
		</Text>
	);
}

interface RuleDetailProps {
	ruleWithScope: RuleWithScope;
}

function RuleDetail({ ruleWithScope }: RuleDetailProps): React.ReactElement {
	const { rule, scope } = ruleWithScope;

	return (
		<DetailPanel borderColor="gray">
			<Text bold color="yellow">
				Rule Details
			</Text>
			<Box marginTop={1} flexDirection="column">
				<Text>
					<Text bold>Instruction: </Text>
					{rule.instruction}
				</Text>
				<Text dimColor>
					id: {rule.id} | scope: {scope}
				</Text>
			</Box>
		</DetailPanel>
	);
}

interface ScopeSelectorProps {
	onSelectScope: (scope: RuleScope) => void;
}

function ScopeSelector({ onSelectScope }: ScopeSelectorProps): React.ReactElement {
	useInput((input) => {
		if (input === "g") {
			onSelectScope("global");
		}

		if (input === "p") {
			onSelectScope("project");
		}
	});

	return (
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
	);
}

interface AddRuleFormProps {
	scope: RuleScope;
	value: string;
	onChange: (value: string) => void;
	onSubmit: (value: string) => void;
}

function AddRuleForm({ scope, value, onChange, onSubmit }: AddRuleFormProps): React.ReactElement {
	const scopeLabel = scope === "global" ? "Global" : "Project";

	return (
		<Box flexDirection="column">
			<Text bold color="yellow">
				Add New {scopeLabel} Rule:
			</Text>
			<Box marginTop={1} gap={1}>
				<Text color="cyan">❯</Text>
				<TextInput
					value={value}
					onChange={onChange}
					onSubmit={onSubmit}
					placeholder="Enter rule instruction..."
				/>
			</Box>
		</Box>
	);
}

interface RulesListSectionProps {
	title: string;
	rulesWithScope: RuleWithScope[];
	selectedIndex: number;
	startIndex: number;
}

function RulesListSection({
	title,
	rulesWithScope,
	selectedIndex,
	startIndex,
}: RulesListSectionProps): React.ReactElement {
	if (rulesWithScope.length === 0) {
		return (
			<Box flexDirection="column" marginTop={1}>
				<Text bold color="yellow">
					{title}: <Text dimColor>(none)</Text>
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" marginTop={1}>
			<Text bold color="yellow">
				{title}:
			</Text>
			<Box flexDirection="column" marginTop={1}>
				<SelectableList
					items={rulesWithScope}
					selectedIndex={selectedIndex - startIndex}
					emptyMessage=""
					getItemKey={(ruleWithScope) => ruleWithScope.rule.id}
					renderItem={(ruleWithScope, _index, isSelected) => (
						<RuleItem ruleWithScope={ruleWithScope} isSelected={isSelected} />
					)}
				/>
			</Box>
		</Box>
	);
}

export function RulesView({ version, onClose }: RulesViewProps): React.ReactElement {
	const rulesService = getRulesService();
	const [rulesState, setRulesState] = useState<RulesState>(() => ({
		globalRules: rulesService.getGlobal(),
		projectRules: rulesService.getProject(),
	}));
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [newInstruction, setNewInstruction] = useState("");
	const [selectedScope, setSelectedScope] = useState<RuleScope>("project");

	const allRulesWithScope = createRulesWithScope(rulesState);
	const totalRules = allRulesWithScope.length;

	const { selectedIndex, setSelectedIndex, statusMessage, setStatusMessage } = useListNavigation({
		itemCount: totalRules,
		isActive: viewMode === "list",
		onClose,
	});

	const refreshRules = () => {
		rulesService.invalidate();
		setRulesState({
			globalRules: rulesService.getGlobal(),
			projectRules: rulesService.getProject(),
		});
	};

	useInput(
		(input, key) => {
			if (viewMode === "confirm-delete") {
				if (key.escape) {
					setViewMode("list");

					return;
				}

				if (key.return) {
					const selectedRuleWithScope = allRulesWithScope.at(selectedIndex);

					if (selectedRuleWithScope) {
						rulesService.remove(selectedRuleWithScope.rule.id, selectedRuleWithScope.scope);
						refreshRules();

						const newTotalRules = totalRules - 1;

						if (selectedIndex >= newTotalRules) {
							setSelectedIndex(Math.max(0, newTotalRules - 1));
						}

						setStatusMessage(`Removed ${selectedRuleWithScope.scope} rule`);
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

			if (input === "a") {
				setViewMode("select-scope");
			}

			if (input === "d" && totalRules > 0) {
				setViewMode("confirm-delete");
			}
		},
		{ isActive: viewMode !== "list" || viewMode === "list" },
	);

	const handleAddSubmit = (value: string) => {
		if (value.trim()) {
			rulesService.add({ instruction: value.trim(), scope: selectedScope });
			refreshRules();
			setStatusMessage(`Added ${selectedScope} rule`);
		}

		setNewInstruction("");
		setViewMode("list");
	};

	const selectedRuleWithScope = allRulesWithScope.at(selectedIndex);
	const globalRulesWithScope = allRulesWithScope.filter((r) => r.scope === "global");
	const projectRulesWithScope = allRulesWithScope.filter((r) => r.scope === "project");

	const isGlobalSelected = selectedIndex < rulesState.globalRules.length;
	const globalStartIndex = 0;
	const projectStartIndex = rulesState.globalRules.length;

	return (
		<ResponsiveLayout
			header={<RulesHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1} gap={1}>
						{viewMode === "select-scope" ? (
							<ScopeSelector
								onSelectScope={(scope) => {
									setSelectedScope(scope);
									setViewMode("add");
								}}
							/>
						) : viewMode === "add" ? (
							<AddRuleForm
								scope={selectedScope}
								value={newInstruction}
								onChange={setNewInstruction}
								onSubmit={handleAddSubmit}
							/>
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
											<RulesListSection
												title="Global Rules"
												rulesWithScope={globalRulesWithScope}
												selectedIndex={isGlobalSelected ? selectedIndex : -1}
												startIndex={globalStartIndex}
											/>
											<RulesListSection
												title="Project Rules"
												rulesWithScope={projectRulesWithScope}
												selectedIndex={isGlobalSelected ? -1 : selectedIndex}
												startIndex={projectStartIndex}
											/>
										</>
									)}
								</Box>

								{selectedRuleWithScope && <RuleDetail ruleWithScope={selectedRuleWithScope} />}

								{viewMode === "confirm-delete" && selectedRuleWithScope && (
									<ConfirmationDialog
										title={`Delete ${selectedRuleWithScope.scope} rule?`}
										message={`"${selectedRuleWithScope.rule.instruction}"`}
									/>
								)}

								{statusMessage && (
									<Box marginTop={1}>
										<Text color="green">{statusMessage}</Text>
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
