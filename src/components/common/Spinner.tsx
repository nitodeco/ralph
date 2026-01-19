import InkSpinner from "ink-spinner";
import { Text } from "ink";

interface SpinnerProps {
	label?: string;
}

export function Spinner({ label }: SpinnerProps): React.ReactElement {
	return (
		<Text>
			<Text color="cyan">
				<InkSpinner type="dots" />
			</Text>
			{label && <Text> {label}</Text>}
		</Text>
	);
}
