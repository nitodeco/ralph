---
"ralph": minor
---

Implement task decomposition request handling

- Add DECOMPOSITION_MARKER constant for agent to signal task decomposition
- Create DecompositionRequest and DecompositionSubtask types in prd.types.ts
- Update buildPrompt() to include decomposition instructions for the agent
- Create src/lib/decomposition.ts with parseDecompositionRequest() and applyDecomposition() functions
- Add maxDecompositionsPerTask config option (default: 2) to prevent infinite decomposition loops
- Update orchestrator to detect decomposition marker and apply subtasks to PRD
- Add restartCurrentIteration() to iteration store for seamless decomposition handling
- Add decomposition logging to iteration logs with IterationLogDecomposition type
- Add 'decomposed' status to IterationLogStatus
- Display decomposition feedback in IterationProgress component
- Log decomposition events to progress.txt

