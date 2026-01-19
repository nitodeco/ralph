import { Text } from "ink";

type MessageType = "info" | "success" | "warning" | "error";

interface MessageProps {
	type: MessageType;
	children: React.ReactNode;
}

const MESSAGE_STYLES: Record<MessageType, { color: string; prefix: string }> = {
	info: { color: "blue", prefix: "ℹ" },
	success: { color: "green", prefix: "✔" },
	warning: { color: "yellow", prefix: "⚠" },
	error: { color: "red", prefix: "✖" },
};

export function Message({ type, children }: MessageProps): React.ReactElement {
	const style = MESSAGE_STYLES[type];

	return (
		<Text>
			<Text color={style.color}>{style.prefix} </Text>
			<Text>{children}</Text>
		</Text>
	);
}
