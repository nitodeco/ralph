import type { SpinnerName } from "cli-spinners";
import { Text } from "ink";
import InkSpinner from "ink-spinner";

type SpinnerVariant =
	| "default"
	| "processing"
	| "waiting"
	| "success"
	| "warning"
	| "error"
	| "thinking"
	| "network"
	| "progress";

interface SpinnerConfig {
	type: SpinnerName;
	color: string;
}

const SPINNER_CONFIG_BY_VARIANT: Record<SpinnerVariant, SpinnerConfig> = {
	default: { type: "dots", color: "cyan" },
	processing: { type: "dots12", color: "cyan" },
	waiting: { type: "clock", color: "yellow" },
	success: { type: "dots", color: "green" },
	warning: { type: "triangle", color: "yellow" },
	error: { type: "dots", color: "red" },
	thinking: { type: "bouncingBar", color: "magenta" },
	network: { type: "dots8", color: "blue" },
	progress: { type: "dots10", color: "cyan" },
};

interface SpinnerProps {
	label?: string;
	variant?: SpinnerVariant;
	labelColor?: string;
}

export function Spinner({
	label,
	variant = "default",
	labelColor,
}: SpinnerProps): React.ReactElement {
	const config = SPINNER_CONFIG_BY_VARIANT[variant];

	return (
		<Text>
			<Text color={config.color}>
				<InkSpinner type={config.type} />
			</Text>
			{label && <Text color={labelColor}> {label}</Text>}
		</Text>
	);
}
