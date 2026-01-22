import { Box, Text } from "ink";

interface SelectableListProps<T> {
	items: T[];
	selectedIndex: number;
	emptyMessage?: string;
	getItemKey: (item: T, index: number) => string;
	renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
}

export function SelectableList<T>({
	items,
	selectedIndex,
	emptyMessage = "No items found.",
	getItemKey,
	renderItem,
}: SelectableListProps<T>): React.ReactElement {
	if (items.length === 0) {
		return (
			<Box>
				<Text dimColor>{emptyMessage}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{items.map((item, index) => {
				const isSelected = index === selectedIndex;

				return (
					<Box key={getItemKey(item, index)}>
						<Text color={isSelected ? "cyan" : undefined}>{isSelected ? "❯ " : "  "}</Text>
						{renderItem(item, index, isSelected)}
					</Box>
				);
			})}
		</Box>
	);
}
