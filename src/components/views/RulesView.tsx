import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog.tsx";
import { TextInput } from "@/components/common/TextInput.tsx";
import { type CustomRule, getRulesService } from "@/lib/services/index.ts";

interface RulesViewProps {
	version: string;
	onClose: () => void;
}

type ViewMode = "list" | "add" | "confirm-delete";

export function RulesView({ version, onClose }: RulesViewProps): React.ReactElement {
	const rulesService = getRulesService();
	const [rules, setRules] = useState<CustomRule[]>(() => rulesService.get());
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [newInstruction, setNewInstruction] = useState("");
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const refreshRules = () => {
		rulesService.invalidate();
		setRules(rulesService.get());
	};

	const showMessage = (type: "success" | "error", text: string) => {
		setMessage({ type, text });
		setTimeout(() => setMessage(null), 3000);
	};

	useInput((input, key) => {
		if (viewMode === "confirm-delete") {
			if (key.escape) {
				setViewMode("list");

				return;
			}

			if (key.return) {
				const rule = rules[selectedIndex];

				if (rule) {
					rulesService.remove(rule.id);
					refreshRules();

					if (selectedIndex >= rules.length - 1) {
						setSelectedIndex(Math.max(0, rules.length - 2));
					}

					showMessage("success", "Rule removed");
				}

				setViewMode("list");
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

		if (key.downArrow && selectedIndex < rules.length - 1) {
			setSelectedIndex(selectedIndex + 1);
		}

		if (input === "a") {
			setViewMode("add");
		}

		if (input === "d" && rules.length > 0) {
			setViewMode("confirm-delete");
		}
	});

	const handleAddSubmit = (value: string) => {
		if (value.trim()) {
			rulesService.add({ instruction: value.trim() });
			refreshRules();
			showMessage("success", "Rule added");
		}

		setNewInstruction("");
		setViewMode("list");
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
				<Text bold color="cyan">
					◆ ralph v{version} - Custom Rules
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} paddingX={1} gap={1}>
				{viewMode === "add" ? (
					<Box flexDirection="column">
						<Text bold color="yellow">
							Add New Rule:
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
						<Box marginTop={1}>
							<Text dimColor>Press Enter to add, Escape to cancel</Text>
						</Box>
					</Box>
				) : (
					<>
						<Box flexDirection="column">
							<Text bold color="yellow">
								Custom Rules ({rules.length} total):
							</Text>
							<Box flexDirection="column" marginTop={1}>
								{rules.length === 0 ? (
									<Text dimColor>No custom rules configured. Press 'a' to add one.</Text>
								) : (
									rules.map((rule, index) => {
										const isSelected = index === selectedIndex;

										return (
											<Box key={rule.id} flexDirection="column">
												<Box>
													<Text color={isSelected ? "cyan" : undefined}>
														{isSelected ? "❯ " : "  "}
													</Text>
													<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
														{index + 1}. {rule.instruction}
													</Text>
												</Box>
												{isSelected && (
													<Box paddingLeft={4}>
														<Text dimColor>id: {rule.id}</Text>
													</Box>
												)}
											</Box>
										);
									})
								)}
							</Box>
						</Box>

						{viewMode === "confirm-delete" && rules[selectedIndex] && (
							<ConfirmationDialog
								title="Delete rule?"
								message={`"${rules[selectedIndex]?.instruction}"`}
							/>
						)}

						{message && (
							<Box marginTop={1}>
								<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
							</Box>
						)}

						<Box flexDirection="column" marginTop={1}>
							<Text dimColor>↑/↓ Navigate | a Add | d Delete | q/Esc Close</Text>
						</Box>
					</>
				)}
			</Box>
		</Box>
	);
}
