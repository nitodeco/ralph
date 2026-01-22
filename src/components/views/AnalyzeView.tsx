import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { ResponsiveLayout, useResponsive } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import {
	clearFailureHistory,
	formatPatternReport,
	generatePatternReport,
	getSuggestedGuardrails,
} from "@/lib/failure-patterns.ts";
import { getGuardrailsService } from "@/lib/services/index.ts";
import { Header } from "../Header.tsx";

interface AnalyzeViewProps {
	version: string;
	onClose: () => void;
}

function AnalyzeHeader({ version }: { version: string }): React.ReactElement {
	const { isNarrow, isMedium } = useResponsive();
	const headerVariant = isNarrow ? "minimal" : isMedium ? "compact" : "full";

	return <Header version={version} variant={headerVariant} />;
}

interface AnalyzeFooterProps {
	hasSuggestedGuardrails: boolean;
}

function AnalyzeFooter({ hasSuggestedGuardrails }: AnalyzeFooterProps): React.ReactElement {
	return (
		<Box paddingX={1} flexDirection="column">
			<Text dimColor>Press q or Escape to close | c to clear failure history</Text>
			{hasSuggestedGuardrails && <Text dimColor>Use ↑/↓ to select, Enter to add guardrail</Text>}
		</Box>
	);
}

export const AnalyzeView: React.FC<AnalyzeViewProps> = ({ version, onClose }) => {
	const [report] = useState(() => generatePatternReport());
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

	const suggestedGuardrails = getSuggestedGuardrails();

	useInput((input, key) => {
		if (key.escape || input === "q") {
			onClose();
		}

		if (input === "c") {
			clearFailureHistory();
			setMessage({ type: "success", text: "Failure history cleared" });
			setTimeout(() => setMessage(null), 3000);
		}

		if (suggestedGuardrails.length > 0) {
			if (key.upArrow) {
				setSelectedSuggestionIndex((previous) =>
					previous > 0 ? previous - 1 : suggestedGuardrails.length - 1,
				);
			}

			if (key.downArrow) {
				setSelectedSuggestionIndex((previous) =>
					previous < suggestedGuardrails.length - 1 ? previous + 1 : 0,
				);
			}

			if (key.return && suggestedGuardrails[selectedSuggestionIndex]) {
				const guardrail = suggestedGuardrails[selectedSuggestionIndex];

				try {
					getGuardrailsService().add({
						instruction: guardrail.instruction,
						category: guardrail.category,
						addedAfterFailure: guardrail.addedAfterFailure,
					});
					setMessage({ type: "success", text: `Added guardrail: "${guardrail.instruction}"` });
				} catch {
					setMessage({ type: "error", text: "Failed to add guardrail" });
				}

				setTimeout(() => setMessage(null), 3000);
			}
		}
	});

	const reportLines = formatPatternReport(report).split("\n");

	return (
		<ResponsiveLayout
			header={<AnalyzeHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1}>
						<Box flexDirection="column">
							{reportLines.map((line, lineIndex) => (
								<Text key={`report-line-${lineIndex}-${line.slice(0, 20)}`}>{line}</Text>
							))}
						</Box>

						{suggestedGuardrails.length > 0 && (
							<Box flexDirection="column" marginTop={1}>
								<Text bold color="yellow">
									Suggested Guardrails (press Enter to add):
								</Text>
								{suggestedGuardrails.map((guardrail, index) => (
									<Box key={guardrail.id} paddingLeft={1}>
										<Text color={index === selectedSuggestionIndex ? "cyan" : undefined}>
											{index === selectedSuggestionIndex ? "▸ " : "  "}
											{guardrail.instruction}
										</Text>
									</Box>
								))}
							</Box>
						)}

						{message && (
							<Box marginTop={1}>
								<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
							</Box>
						)}
					</Box>
				</ScrollableContent>
			}
			footer={<AnalyzeFooter hasSuggestedGuardrails={suggestedGuardrails.length > 0} />}
			headerHeight={10}
			footerHeight={3}
		/>
	);
};
