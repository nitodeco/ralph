import { Box, Text } from "ink";
import type { AgentPhase } from "@/lib/agent-phase.ts";
import { PHASE_INFO_BY_PHASE } from "@/lib/agent-phase.ts";

const PHASE_ORDER: AgentPhase[] = [
	"starting",
	"exploring",
	"reading",
	"implementing",
	"running_commands",
	"verifying",
	"committing",
];

interface PhaseStep {
	phase: AgentPhase;
	label: string;
	icon: string;
}

const PHASE_STEPS: PhaseStep[] = PHASE_ORDER.map((phase) => ({
	phase,
	label: PHASE_INFO_BY_PHASE[phase].label,
	icon: getPhaseIcon(phase),
}));

function getPhaseIcon(phase: AgentPhase): string {
	const ICON_BY_PHASE: Record<AgentPhase, string> = {
		starting: "▶",
		exploring: "🔍",
		reading: "📖",
		implementing: "⚡",
		running_commands: "▷",
		verifying: "✓",
		committing: "📝",
		idle: "○",
	};

	return ICON_BY_PHASE[phase];
}

type PhaseIndicatorStyle = "dots" | "timeline" | "compact" | "minimal";

interface PhaseIndicatorProps {
	currentPhase: AgentPhase;
	completedPhases?: AgentPhase[];
	style?: PhaseIndicatorStyle;
	showLabels?: boolean;
}

function getPhaseStatus(
	phase: AgentPhase,
	currentPhase: AgentPhase,
	completedPhases: AgentPhase[],
): "completed" | "current" | "pending" {
	if (completedPhases.includes(phase)) {
		return "completed";
	}

	if (phase === currentPhase) {
		return "current";
	}

	return "pending";
}

function DotsStyle({
	currentPhase,
	completedPhases,
}: {
	currentPhase: AgentPhase;
	completedPhases: AgentPhase[];
}): React.ReactElement {
	return (
		<Box gap={1}>
			{PHASE_STEPS.map(({ phase }) => {
				const status = getPhaseStatus(phase, currentPhase, completedPhases);
				const color = status === "completed" ? "green" : status === "current" ? "cyan" : "gray";
				const symbol = status === "completed" ? "●" : status === "current" ? "◉" : "○";

				return (
					<Text key={phase} color={color}>
						{symbol}
					</Text>
				);
			})}
		</Box>
	);
}

function TimelineStyle({
	currentPhase,
	completedPhases,
	showLabels,
}: {
	currentPhase: AgentPhase;
	completedPhases: AgentPhase[];
	showLabels: boolean;
}): React.ReactElement {
	return (
		<Box flexDirection="column" gap={0}>
			<Box gap={0}>
				{PHASE_STEPS.map(({ phase }, index) => {
					const status = getPhaseStatus(phase, currentPhase, completedPhases);
					const color = status === "completed" ? "green" : status === "current" ? "cyan" : "gray";
					const isLast = index === PHASE_STEPS.length - 1;
					const symbol = status === "completed" ? "●" : status === "current" ? "◉" : "○";
					const lineColor =
						status === "completed" ? "green" : status === "current" ? "cyan" : "gray";

					return (
						<Box key={phase}>
							<Text color={color}>{symbol}</Text>
							{!isLast && <Text color={lineColor}>───</Text>}
						</Box>
					);
				})}
			</Box>
			{showLabels && (
				<Box gap={0}>
					{PHASE_STEPS.map(({ phase, label }, index) => {
						const status = getPhaseStatus(phase, currentPhase, completedPhases);
						const isLast = index === PHASE_STEPS.length - 1;
						const labelWidth = isLast ? label.length : 4;
						const truncatedLabel = label.slice(0, labelWidth).padEnd(labelWidth);

						return (
							<Text
								key={phase}
								dimColor={status === "pending"}
								color={status === "current" ? "cyan" : undefined}
							>
								{truncatedLabel}
							</Text>
						);
					})}
				</Box>
			)}
		</Box>
	);
}

function CompactStyle({ currentPhase }: { currentPhase: AgentPhase }): React.ReactElement {
	const currentIndex = PHASE_ORDER.indexOf(currentPhase);
	const totalPhases = PHASE_ORDER.length;
	const completedCount = Math.max(currentIndex, 0);

	return (
		<Box gap={1}>
			<Text dimColor>Phase:</Text>
			<Text color="cyan" bold>
				{PHASE_INFO_BY_PHASE[currentPhase].label}
			</Text>
			<Text dimColor>
				({completedCount + 1}/{totalPhases})
			</Text>
		</Box>
	);
}

function MinimalStyle({ currentPhase }: { currentPhase: AgentPhase }): React.ReactElement {
	const icon = getPhaseIcon(currentPhase);
	const label = PHASE_INFO_BY_PHASE[currentPhase].label;

	return (
		<Text>
			<Text>{icon}</Text>
			<Text color="cyan"> {label}</Text>
		</Text>
	);
}

export function PhaseIndicator({
	currentPhase,
	completedPhases = [],
	style = "dots",
	showLabels = false,
}: PhaseIndicatorProps): React.ReactElement {
	if (currentPhase === "idle") {
		return <Text dimColor>Idle</Text>;
	}

	if (style === "timeline") {
		return (
			<TimelineStyle
				currentPhase={currentPhase}
				completedPhases={completedPhases}
				showLabels={showLabels}
			/>
		);
	}

	if (style === "compact") {
		return <CompactStyle currentPhase={currentPhase} />;
	}

	if (style === "minimal") {
		return <MinimalStyle currentPhase={currentPhase} />;
	}

	return <DotsStyle currentPhase={currentPhase} completedPhases={completedPhases} />;
}
