import { Box, Text } from "ink";
import type { TechnicalDebtReport } from "@/lib/handlers/index.ts";

interface TechnicalDebtSummaryProps {
	report: TechnicalDebtReport | null;
}

interface SeverityCountProps {
	label: string;
	count: number;
	color: string;
}

function SeverityCount({ label, count, color }: SeverityCountProps): React.ReactElement | null {
	if (count === 0) {
		return null;
	}

	return (
		<Text>
			<Text color={color}>{count}</Text> {label}
		</Text>
	);
}

export function TechnicalDebtSummary({
	report,
}: TechnicalDebtSummaryProps): React.ReactElement | null {
	if (!report || report.totalItems === 0) {
		return null;
	}

	const { itemsBySeverity, recommendations } = report;
	const topRecommendation = recommendations[0];

	return (
		<Box flexDirection="column" paddingX={1} marginTop={1}>
			<Text bold color="yellow">
				Technical Debt Review
			</Text>
			<Box gap={2} marginTop={1}>
				<SeverityCount label="critical" count={itemsBySeverity.critical} color="red" />
				<SeverityCount label="high" count={itemsBySeverity.high} color="yellow" />
				<SeverityCount label="medium" count={itemsBySeverity.medium} color="cyan" />
				<SeverityCount label="low" count={itemsBySeverity.low} color="gray" />
			</Box>
			{topRecommendation && (
				<Box marginTop={1}>
					<Text dimColor>
						Top recommendation: <Text>{topRecommendation}</Text>
					</Text>
				</Box>
			)}
			<Box marginTop={1}>
				<Text dimColor>
					View full report with <Text color="cyan">ralph progress</Text>
				</Text>
			</Box>
		</Box>
	);
}
