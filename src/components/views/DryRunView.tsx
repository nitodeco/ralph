import { Box, Text } from "ink";
import { ResponsiveLayout, useResponsive } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
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

function DryRunHeader({
	version,
	config,
	projectName,
}: {
	version: string;
	config: RalphConfig | null;
	projectName?: string;
}): React.ReactElement {
	const { isNarrow, isMedium } = useResponsive();
	const headerVariant = isNarrow ? "minimal" : isMedium ? "compact" : "full";

	return (
		<Header
			version={version}
			agent={config?.agent}
			projectName={projectName}
			variant={headerVariant}
		/>
	);
}

function DryRunFooter({ isComplete }: { isComplete: boolean }): React.ReactElement {
	if (!isComplete) {
		return (
			<Box paddingX={1}>
				<Text dimColor>Running dry-run simulation...</Text>
			</Box>
		);
	}

	return (
		<Box paddingX={1}>
			<Text dimColor>Press Ctrl+C to exit</Text>
		</Box>
	);
}

export function DryRunView({
	version,
	config,
	projectName,
	dryRunState,
}: DryRunViewProps): React.ReactElement {
	const isComplete = dryRunState.status === "complete";

	return (
		<ResponsiveLayout
			header={<DryRunHeader version={version} config={config} projectName={projectName} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1}>
						<Box marginBottom={1}>
							<Text color="cyan" bold>
								◆ Dry-Run Mode
							</Text>
							{!isComplete && (
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
					</Box>
				</ScrollableContent>
			}
			footer={<DryRunFooter isComplete={isComplete} />}
			headerHeight={10}
			footerHeight={2}
		/>
	);
}
