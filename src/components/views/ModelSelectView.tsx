import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { TRANSITION_DELAY_MS } from "@/lib/constants/ui.ts";
import { getConfigService, getModelsForAgent } from "@/lib/services/index.ts";
import type { AgentType } from "@/types.ts";

interface ModelSelectViewProps {
  version: string;
  onClose: () => void;
}

const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
  cursor: "Cursor",
  claude: "Claude Code",
  codex: "Codex",
};

function ModelSelectHeader({ version }: { version: string }): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        ◆ ralph v{version} - Select Model
      </Text>
    </Box>
  );
}

function ModelSelectFooter(): React.ReactElement {
  return (
    <Box paddingX={1}>
      <Text dimColor>Press Escape or 'q' to cancel</Text>
    </Box>
  );
}

export function ModelSelectView({ version, onClose }: ModelSelectViewProps): React.ReactElement {
  const configService = getConfigService();
  const effectiveConfig = configService.get();
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const currentAgent = effectiveConfig.agent;

  useInput((input, key) => {
    if (key.escape || input === "q") {
      onClose();
    }
  });

  useEffect(() => {
    let isCancelled = false;

    const loadModels = async () => {
      setIsLoadingModels(true);
      const modelCatalogResult = await getModelsForAgent(currentAgent, { forceRefresh: true });

      if (isCancelled) {
        return;
      }

      if (!modelCatalogResult.success || !modelCatalogResult.catalog) {
        setMessage({
          text:
            modelCatalogResult.error ??
            `Unable to discover models for ${AGENT_DISPLAY_NAMES[currentAgent]}.`,
          type: "error",
        });
        setAvailableModels([]);
        setIsLoadingModels(false);

        return;
      }

      setAvailableModels(modelCatalogResult.catalog.models);
      setIsLoadingModels(false);
    };

    void loadModels();

    return () => {
      isCancelled = true;
    };
  }, [currentAgent]);

  const selectItems = useMemo(
    () =>
      availableModels.map((modelIdentifier) => ({
        label: modelIdentifier,
        value: modelIdentifier,
      })),
    [availableModels],
  );

  const selectedModel = effectiveConfig.model;
  const selectedModelForCurrentAgent = selectedModel
    ? availableModels.find(
        (modelIdentifier) => modelIdentifier.toLowerCase() === selectedModel.toLowerCase(),
      )
    : undefined;
  const initialIndex = selectedModel
    ? selectItems.findIndex(
        (modelItem) =>
          modelItem.value.toLowerCase() === (selectedModelForCurrentAgent ?? "").toLowerCase(),
      )
    : 0;

  const handleModelSelect = (item: { value: string }) => {
    configService.saveGlobal({
      ...configService.loadGlobal(),
      model: item.value,
    });
    configService.invalidateAll();
    setMessage({
      text: `Model changed to ${item.value}`,
      type: "success",
    });

    setTimeout(() => {
      onClose();
    }, TRANSITION_DELAY_MS);
  };

  return (
    <ResponsiveLayout
      header={<ModelSelectHeader version={version} />}
      content={
        <ScrollableContent>
          <Box flexDirection="column" paddingX={1} gap={1}>
            <Box flexDirection="column">
              <Text bold color="yellow">
                Select a model for {AGENT_DISPLAY_NAMES[currentAgent]}
              </Text>
              <Text dimColor>Current model: {selectedModelForCurrentAgent ?? "default"}</Text>
              {selectedModel !== undefined &&
                selectedModelForCurrentAgent === undefined &&
                !isLoadingModels && (
                  <Text dimColor>
                    Saved model "{selectedModel}" is not available for this agent.
                  </Text>
                )}
            </Box>

            {isLoadingModels && <Text dimColor>Loading available models...</Text>}

            {!isLoadingModels && selectItems.length > 0 && (
              <Box marginTop={1}>
                <SelectInput
                  items={selectItems}
                  initialIndex={initialIndex >= 0 ? initialIndex : 0}
                  onSelect={handleModelSelect}
                />
              </Box>
            )}

            {!isLoadingModels && selectItems.length === 0 && !message && (
              <Text color="red">
                No models were discovered for {AGENT_DISPLAY_NAMES[currentAgent]}.
              </Text>
            )}

            {message && (
              <Box marginTop={1}>
                <Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
              </Box>
            )}
          </Box>
        </ScrollableContent>
      }
      footer={<ModelSelectFooter />}
      headerHeight={3}
      footerHeight={2}
    />
  );
}
