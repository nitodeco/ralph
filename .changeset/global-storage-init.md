---
"ralph": minor
---

Update init flow to use global storage

- InitWizard now registers projects in the global registry (~/.ralph/registry.json) before saving files
- Project files are now stored in ~/.ralph/projects/<folder-name>/ instead of local .ralph directory
- validateProject() now uses isProjectInitialized() from ProjectRegistryService
- Success message shows the global storage path after initialization
