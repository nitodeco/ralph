import type { PromptGuardrail } from "./types.ts";

export function createDefaultGuardrails(): PromptGuardrail[] {
  const timestamp = new Date().toISOString();

  return [
    {
      addedAt: timestamp,
      category: "quality",
      enabled: true,
      id: "verify-before-commit",
      instruction: "Verify changes work before committing",
      trigger: "always",
    },
    {
      addedAt: timestamp,
      category: "quality",
      enabled: true,
      id: "read-existing-patterns",
      instruction: "Read existing code patterns before writing new code",
      trigger: "always",
    },
    {
      addedAt: timestamp,
      category: "safety",
      enabled: true,
      id: "fix-build-before-proceeding",
      instruction: "If build fails, fix it before proceeding",
      trigger: "always",
    },
  ];
}
