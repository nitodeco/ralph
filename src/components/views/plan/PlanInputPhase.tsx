import { Box, Text } from "ink";
import { useState } from "react";
import {
	expandPastedSegments,
	type PastedTextSegment,
	TextInput,
} from "@/components/common/TextInput.tsx";
import type { Prd } from "@/types.ts";

interface PlanInputPhaseProps {
	existingPrd: Prd | null;
	onSubmit: (specification: string) => void;
}

export function PlanInputPhase({ existingPrd, onSubmit }: PlanInputPhaseProps): React.ReactElement {
	const [inputValue, setInputValue] = useState("");
	const [pastedSegments, setPastedSegments] = useState<PastedTextSegment[]>([]);

	const handlePaste = (segment: PastedTextSegment) => {
		setPastedSegments((prev) => [...prev, segment]);
	};

	const handleSubmit = (value: string) => {
		const expandedValue = expandPastedSegments(value, pastedSegments);
		const specification = expandedValue.trim();

		if (!specification) {
			return;
		}

		onSubmit(specification);
	};

	return (
		<Box flexDirection="column" gap={1}>
			{existingPrd && (
				<>
					<Text dimColor>Existing project: {existingPrd.project}</Text>
					<Text dimColor>
						Current tasks: {existingPrd.tasks.length} (
						{existingPrd.tasks.filter((task) => task.done).length} done)
					</Text>
				</>
			)}
			<Box marginTop={1} flexDirection="column" gap={1}>
				<Text color="cyan">
					{existingPrd
						? "Describe the changes or additions to your project:"
						: "Describe what you want to build:"}
				</Text>
				<Box>
					<Text color="green">❯ </Text>
					<TextInput
						value={inputValue}
						onChange={setInputValue}
						onSubmit={handleSubmit}
						placeholder="I want to build..."
						collapsePastedText
						pastedSegments={pastedSegments}
						onPaste={handlePaste}
					/>
				</Box>
			</Box>
			<Text dimColor>
				Tip: You can paste multi-line text. The AI will generate tasks based on your specification.
			</Text>
		</Box>
	);
}
