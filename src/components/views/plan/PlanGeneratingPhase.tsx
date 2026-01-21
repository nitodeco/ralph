import { Box, Text } from "ink";
import { Spinner } from "@/components/common/Spinner.tsx";

interface PlanGeneratingPhaseProps {
	agentOutput: string;
}

export function PlanGeneratingPhase({ agentOutput }: PlanGeneratingPhaseProps): React.ReactElement {
	return (
		<Box flexDirection="column" gap={1}>
			<Spinner label="Generating PRD from your specification..." />
			{agentOutput && (
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>Agent output:</Text>
					<Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
						<Text dimColor>{agentOutput.slice(-500)}</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
}
