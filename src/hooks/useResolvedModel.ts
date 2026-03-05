import { useEffect, useState } from "react";
import { getCurrentModelFromAgent } from "@/lib/services/model-catalog.ts";
import type { RalphConfig } from "@/types.ts";

export function useResolvedModel(config: RalphConfig | null): string | undefined {
  const [fetchedModel, setFetchedModel] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!config || config.model !== undefined || config.agent !== "cursor") {
      return;
    }

    let isCancelled = false;

    void getCurrentModelFromAgent("cursor").then((model) => {
      if (!isCancelled && model) {
        setFetchedModel(model);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [config?.agent, config?.model]);

  if (!config) {
    return undefined;
  }

  if (config.model !== undefined) {
    return config.model;
  }

  return fetchedModel;
}
