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
  default: { color: "cyan", type: "dots" },
  error: { color: "red", type: "dots" },
  network: { color: "blue", type: "dots8" },
  processing: { color: "cyan", type: "dots12" },
  progress: { color: "cyan", type: "dots10" },
  success: { color: "green", type: "dots" },
  thinking: { color: "magenta", type: "bouncingBar" },
  waiting: { color: "yellow", type: "clock" },
  warning: { color: "yellow", type: "triangle" },
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
