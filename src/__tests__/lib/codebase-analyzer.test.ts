import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CodebaseAnalysis,
  analyzeCodebase,
  formatAnalysisReport,
  generateAnalysisReport,
  generateGuardrailsFromAnalysis,
} from "@/lib/codebase-analyzer.ts";

const TEST_DIR = join(tmpdir(), `ralph-codebase-analyzer-test-${Date.now()}`);

function createTestProject(structure: Record<string, string | object>): void {
  for (const [path, content] of Object.entries(structure)) {
    const fullPath = join(TEST_DIR, path);
    const directory = fullPath.substring(0, fullPath.lastIndexOf("/"));

    if (directory && !existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    writeFileSync(
      fullPath,
      typeof content === "string" ? content : JSON.stringify(content, null, 2),
    );
  }
}

beforeEach(() => {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { force: true, recursive: true });
  }
});

describe("analyzeCodebase - package manager detection", () => {
  test("detects bun from bun.lockb", () => {
    createTestProject({
      "bun.lockb": "",
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.packageManager).toBe("bun");
  });

  test("detects bun from bun.lock", () => {
    createTestProject({
      "bun.lock": "",
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.packageManager).toBe("bun");
  });

  test("detects pnpm from pnpm-lock.yaml", () => {
    createTestProject({
      "package.json": { name: "test" },
      "pnpm-lock.yaml": "",
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.packageManager).toBe("pnpm");
  });

  test("detects yarn from yarn.lock", () => {
    createTestProject({
      "package.json": { name: "test" },
      "yarn.lock": "",
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.packageManager).toBe("yarn");
  });

  test("detects npm from package-lock.json", () => {
    createTestProject({
      "package-lock.json": {},
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.packageManager).toBe("npm");
  });

  test("detects package manager from packageManager field", () => {
    createTestProject({
      "package.json": { name: "test", packageManager: "pnpm@8.0.0" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.packageManager).toBe("pnpm");
  });

  test("returns unknown when no lock file or packageManager field", () => {
    createTestProject({
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.packageManager).toBe("unknown");
  });
});

describe("analyzeCodebase - TypeScript detection", () => {
  test("detects TypeScript from tsconfig.json", () => {
    createTestProject({
      "package.json": { name: "test" },
      "tsconfig.json": { compilerOptions: {} },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasTypeScript).toBe(true);
  });

  test("detects TypeScript from tsconfig.base.json", () => {
    createTestProject({
      "package.json": { name: "test" },
      "tsconfig.base.json": { compilerOptions: {} },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasTypeScript).toBe(true);
  });

  test("returns false when no TypeScript config", () => {
    createTestProject({
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasTypeScript).toBe(false);
  });
});

describe("analyzeCodebase - test framework detection", () => {
  test("detects vitest from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { vitest: "^1.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.testFramework).toBe("vitest");
  });

  test("detects jest from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { jest: "^29.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.testFramework).toBe("jest");
  });

  test("detects mocha from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { mocha: "^10.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.testFramework).toBe("mocha");
  });

  test("detects bun test from test script", () => {
    createTestProject({
      "bun.lockb": "",
      "package.json": { name: "test", scripts: { test: "bun test" } },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.testFramework).toBe("bun");
  });

  test("detects vitest from config file", () => {
    createTestProject({
      "package.json": { name: "test" },
      "vitest.config.ts": "export default {}",
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.testFramework).toBe("vitest");
  });

  test("detects jest from config file", () => {
    createTestProject({
      "jest.config.js": "module.exports = {}",
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.testFramework).toBe("jest");
  });
});

describe("analyzeCodebase - linter detection", () => {
  test("detects oxlint from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { oxlint: "^1.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.linter).toBe("oxlint");
  });

  test("detects oxlint from config file", () => {
    createTestProject({
      ".oxlintrc.json": {},
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.linter).toBe("oxlint");
  });

  test("detects biome from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { "@biomejs/biome": "^1.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.linter).toBe("biome");
  });

  test("detects eslint from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { eslint: "^8.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.linter).toBe("eslint");
  });

  test("detects biome from config file", () => {
    createTestProject({
      "biome.json": {},
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.linter).toBe("biome");
  });

  test("detects eslint from config file", () => {
    createTestProject({
      "eslint.config.js": "module.exports = {}",
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.linter).toBe("eslint");
  });

  test("detects eslint from legacy config file", () => {
    createTestProject({
      ".eslintrc.json": {},
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.linter).toBe("eslint");
  });
});

describe("analyzeCodebase - formatter detection", () => {
  test("detects oxfmt from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { oxfmt: "^0.30.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.formatter).toBe("oxfmt");
  });

  test("detects oxfmt from config file", () => {
    createTestProject({
      ".oxfmtrc.json": {},
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.formatter).toBe("oxfmt");
  });

  test("detects prettier from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { prettier: "^3.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.formatter).toBe("prettier");
  });

  test("detects biome as formatter", () => {
    createTestProject({
      "package.json": { devDependencies: { "@biomejs/biome": "^1.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.formatter).toBe("biome");
  });

  test("detects prettier from config file", () => {
    createTestProject({
      ".prettierrc": "{}",
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.formatter).toBe("prettier");
  });
});

describe("analyzeCodebase - framework detection", () => {
  test("detects Next.js", () => {
    createTestProject({
      "package.json": { dependencies: { next: "^14.0.0", react: "^18.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.framework).toBe("nextjs");
  });

  test("detects React", () => {
    createTestProject({
      "package.json": { dependencies: { react: "^18.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.framework).toBe("react");
  });

  test("detects Vue", () => {
    createTestProject({
      "package.json": { dependencies: { vue: "^3.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.framework).toBe("vue");
  });

  test("detects Svelte", () => {
    createTestProject({
      "package.json": { dependencies: { svelte: "^4.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.framework).toBe("svelte");
  });

  test("detects Angular", () => {
    createTestProject({
      "package.json": { dependencies: { "@angular/core": "^17.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.framework).toBe("angular");
  });
});

describe("analyzeCodebase - build tool detection", () => {
  test("detects Vite from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { vite: "^5.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.buildTool).toBe("vite");
  });

  test("detects Webpack from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { webpack: "^5.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.buildTool).toBe("webpack");
  });

  test("detects Vite from config file", () => {
    createTestProject({
      "package.json": { name: "test" },
      "vite.config.ts": "export default {}",
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.buildTool).toBe("vite");
  });
});

describe("analyzeCodebase - git hooks detection", () => {
  test("detects husky from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { husky: "^9.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasGitHooks).toBe(true);
  });

  test("detects husky from .husky directory", () => {
    createTestProject({
      ".husky/pre-commit": "npm test",
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasGitHooks).toBe(true);
  });

  test("detects lint-staged from devDependencies", () => {
    createTestProject({
      "package.json": { devDependencies: { "lint-staged": "^15.0.0" }, name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasGitHooks).toBe(true);
  });
});

describe("analyzeCodebase - CI detection", () => {
  test("detects GitHub Actions", () => {
    createTestProject({
      ".github/workflows/ci.yml": "name: CI",
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasCi).toBe(true);
  });

  test("detects GitLab CI", () => {
    createTestProject({
      ".gitlab-ci.yml": "stages: []",
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasCi).toBe(true);
  });

  test("returns false when no CI config", () => {
    createTestProject({
      "package.json": { name: "test" },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasCi).toBe(false);
  });
});

describe("analyzeCodebase - monorepo detection", () => {
  test("detects from workspaces in package.json", () => {
    createTestProject({
      "package.json": { name: "test", workspaces: ["packages/*"] },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasMonorepo).toBe(true);
  });

  test("detects from pnpm-workspace.yaml", () => {
    createTestProject({
      "package.json": { name: "test" },
      "pnpm-workspace.yaml": "packages: ['packages/*']",
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasMonorepo).toBe(true);
  });

  test("detects from turbo.json", () => {
    createTestProject({
      "package.json": { name: "test" },
      "turbo.json": {},
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.hasMonorepo).toBe(true);
  });
});

describe("analyzeCodebase - script detection", () => {
  test("detects build script", () => {
    createTestProject({
      "package.json": { name: "test", scripts: { build: "vite build" } },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.detectedScripts.build).toBe("build");
  });

  test("detects test script", () => {
    createTestProject({
      "package.json": { name: "test", scripts: { test: "vitest" } },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.detectedScripts.test).toBe("test");
  });

  test("detects lint script", () => {
    createTestProject({
      "package.json": { name: "test", scripts: { lint: "eslint ." } },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.detectedScripts.lint).toBe("lint");
  });

  test("detects format script", () => {
    createTestProject({
      "package.json": { name: "test", scripts: { format: "prettier --write ." } },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.detectedScripts.format).toBe("format");
  });

  test("detects typecheck script", () => {
    createTestProject({
      "package.json": { name: "test", scripts: { typecheck: "tsc --noEmit" } },
    });

    const result = analyzeCodebase(TEST_DIR);

    expect(result.detectedScripts.typecheck).toBe("typecheck");
  });
});

describe("generateGuardrailsFromAnalysis", () => {
  test("generates TypeScript guardrail when TypeScript is detected", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: {},
      formatter: "unknown",
      framework: "unknown",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: true,
      linter: "unknown",
      packageManager: "npm",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    expect(guardrails.some((g) => g.instruction.includes("TypeScript"))).toBe(true);
  });

  test("generates test guardrail when test framework is detected", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: { test: "test" },
      formatter: "unknown",
      framework: "unknown",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: false,
      linter: "unknown",
      packageManager: "npm",
      testFramework: "vitest",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    expect(guardrails.some((g) => g.instruction.includes("test suite"))).toBe(true);
  });

  test("generates linter guardrail when linter is detected", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: { lint: "lint" },
      formatter: "unknown",
      framework: "unknown",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: false,
      linter: "eslint",
      packageManager: "npm",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    expect(guardrails.some((g) => g.instruction.includes("linter"))).toBe(true);
  });

  test("generates CI guardrail when CI is detected", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: {},
      formatter: "unknown",
      framework: "unknown",
      hasCi: true,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: false,
      linter: "unknown",
      packageManager: "npm",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    expect(guardrails.some((g) => g.instruction.includes("CI"))).toBe(true);
  });

  test("generates monorepo guardrail when monorepo is detected", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: {},
      formatter: "unknown",
      framework: "unknown",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: true,
      hasTypeScript: false,
      linter: "unknown",
      packageManager: "npm",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    expect(guardrails.some((g) => g.instruction.includes("monorepo"))).toBe(true);
  });

  test("uses correct package manager command", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: {},
      formatter: "unknown",
      framework: "unknown",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: true,
      linter: "unknown",
      packageManager: "pnpm",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    expect(guardrails.some((g) => g.instruction.includes("pnpm"))).toBe(true);
  });

  test("generates Next.js guardrail for Next.js projects", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: {},
      formatter: "unknown",
      framework: "nextjs",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: false,
      linter: "unknown",
      packageManager: "npm",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    expect(guardrails.some((g) => g.instruction.includes("Next.js"))).toBe(true);
  });

  test("generates React guardrail for React projects (non-Next.js)", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: {},
      formatter: "unknown",
      framework: "react",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: false,
      linter: "unknown",
      packageManager: "npm",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    expect(guardrails.some((g) => g.instruction.includes("React"))).toBe(true);
  });

  test("uses oxlint fallback command when linter is oxlint and no lint script", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: {},
      formatter: "unknown",
      framework: "unknown",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: false,
      linter: "oxlint",
      packageManager: "bun",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    const linterGuardrail = guardrails.find((g) => g.instruction.includes("linter"));

    expect(linterGuardrail).toBeDefined();
    expect(linterGuardrail?.instruction).toContain("bun run oxlint");
  });

  test("uses oxfmt fallback command when formatter is oxfmt and no format script", () => {
    const analysis: CodebaseAnalysis = {
      buildTool: "unknown",
      detectedScripts: {},
      formatter: "oxfmt",
      framework: "unknown",
      hasCi: false,
      hasDocker: false,
      hasGitHooks: false,
      hasMonorepo: false,
      hasTypeScript: false,
      linter: "unknown",
      packageManager: "bun",
      testFramework: "unknown",
    };

    const guardrails = generateGuardrailsFromAnalysis(analysis);

    const formatterGuardrail = guardrails.find((g) => g.instruction.includes("formatter"));

    expect(formatterGuardrail).toBeDefined();
    expect(formatterGuardrail?.instruction).toContain("bun run oxfmt");
  });
});

describe("generateAnalysisReport", () => {
  test("generates report with all sections", () => {
    createTestProject({
      "bun.lockb": "",
      "package.json": {
        devDependencies: { vitest: "^1.0.0", typescript: "^5.0.0" },
        name: "test",
        scripts: { test: "vitest", build: "vite build" },
      },
      "tsconfig.json": {},
    });

    const report = generateAnalysisReport(TEST_DIR);

    expect(report.analysis).toBeDefined();
    expect(report.suggestedGuardrails).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.summary.totalSuggestions).toBeGreaterThan(0);
    expect(report.summary.detectedTools.length).toBeGreaterThan(0);
  });
});

describe("formatAnalysisReport", () => {
  test("formats report as readable string", () => {
    createTestProject({
      "package.json": {
        devDependencies: { vitest: "^1.0.0" },
        name: "test",
        scripts: { test: "vitest" },
      },
    });

    const report = generateAnalysisReport(TEST_DIR);
    const formatted = formatAnalysisReport(report);

    expect(formatted).toContain("Codebase Analysis Report");
    expect(formatted).toContain("Detected Configuration");
    expect(formatted).toContain("Suggested Guardrails");
  });

  test("includes script information when available", () => {
    createTestProject({
      "package.json": {
        name: "test",
        scripts: { build: "vite build", test: "vitest" },
      },
    });

    const report = generateAnalysisReport(TEST_DIR);
    const formatted = formatAnalysisReport(report);

    expect(formatted).toContain("Detected Scripts");
  });
});
