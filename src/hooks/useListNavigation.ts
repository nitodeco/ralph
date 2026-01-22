import { useInput } from "ink";
import { useCallback, useEffect, useState } from "react";
import { STATUS_MESSAGE_TIMEOUT_MS } from "@/lib/constants/ui.ts";

interface UseListNavigationOptions {
	itemCount: number;
	isActive?: boolean;
	onClose?: () => void;
}

interface UseListNavigationResult {
	selectedIndex: number;
	setSelectedIndex: (index: number) => void;
	statusMessage: string | null;
	setStatusMessage: (message: string | null) => void;
}

export function useListNavigation({
	itemCount,
	isActive = true,
	onClose,
}: UseListNavigationOptions): UseListNavigationResult {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	useEffect(() => {
		if (statusMessage) {
			const timeout = setTimeout(() => setStatusMessage(null), STATUS_MESSAGE_TIMEOUT_MS);

			return () => clearTimeout(timeout);
		}
	}, [statusMessage]);

	useEffect(() => {
		if (selectedIndex >= itemCount && itemCount > 0) {
			setSelectedIndex(Math.max(0, itemCount - 1));
		}
	}, [itemCount, selectedIndex]);

	useInput(
		(input, key) => {
			if (key.escape || input === "q") {
				onClose?.();

				return;
			}

			if (key.upArrow && selectedIndex > 0) {
				setSelectedIndex(selectedIndex - 1);

				return;
			}

			if (key.downArrow && selectedIndex < itemCount - 1) {
				setSelectedIndex(selectedIndex + 1);
			}
		},
		{ isActive },
	);

	const boundSetSelectedIndex = useCallback(
		(index: number) => {
			const clampedIndex = Math.max(0, Math.min(index, itemCount - 1));

			setSelectedIndex(clampedIndex);
		},
		[itemCount],
	);

	return {
		selectedIndex,
		setSelectedIndex: boundSetSelectedIndex,
		statusMessage,
		setStatusMessage,
	};
}
