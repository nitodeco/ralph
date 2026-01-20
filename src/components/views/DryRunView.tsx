import { Box, Text } from "ink";
import type { RalphConfig } from "@/types.ts";
import { Spinner } from "../common/Spinner.tsx";
import { Header } from "../Header.tsx";

export interface DryRunState {
	status: "idle" | "validating" | "simulating" | "complete";
	currentIteration: number;
	logs: string[];
	errors: string[];
	warnings: string[];
}

interface DryRunViewProps {
	version: string;
	config: RalphConfig | null;
	projectName?: string;
	dryRunState: DryRunState;
}

export function DryRunView({
	version,
	config,
	projectName,
	dryRunState,
}: DryRunViewProps): React.ReactElement {
	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} agent={config?.agent} projectName={projectName} />
			<Box flexDirection="column" marginY={1} paddingX={1}>
				<Box marginBottom={1}>
					<Text color="cyan" bold>
						◆ Dry-Run Mode
					</Text>
					{dryRunState.status !== "complete" && (
						<Box marginLeft={1}>
							<Spinner />
						</Box>
					)}
				</Box>

				{dryRunState.logs.map((log, logIndex) => (
					<Text key={`log-${logIndex}-${log.slice(0, 20)}`} dimColor={log.startsWith("  ")}>
						{log}
					</Text>
				))}

				{dryRunState.errors.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						{dryRunState.errors.map((error, errorIndex) => (
							<Text key={`error-${errorIndex}-${error.slice(0, 20)}`} color="red">
								✗ {error}
							</Text>
						))}
					</Box>
				)}

				{dryRunState.warnings.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						{dryRunState.warnings.map((warning, warningIndex) => (
							<Text key={`warning-${warningIndex}-${warning.slice(0, 20)}`} color="yellow">
								! {warning}
							</Text>
						))}
					</Box>
				)}

				{dryRunState.status === "complete" && (
					<Box marginTop={1}>
						<Text dimColor>Press Ctrl+C to exit</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
}
