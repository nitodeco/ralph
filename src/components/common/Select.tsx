import SelectInput from "ink-select-input";
import { Box, Text } from "ink";

interface SelectItem<T> {
	label: string;
	value: T;
}

interface SelectProps<T> {
	label: string;
	items: SelectItem<T>[];
	onSelect: (item: SelectItem<T>) => void;
}

export function Select<T>({
	label,
	items,
	onSelect,
}: SelectProps<T>): React.ReactElement {
	return (
		<Box flexDirection="column">
			<Text color="cyan">{label}</Text>
			<SelectInput items={items} onSelect={onSelect} />
		</Box>
	);
}
