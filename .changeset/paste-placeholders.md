---
"ralph": minor
---

Add collapsible paste placeholders for long text in input fields

- When users paste long text (multiline or over 80 characters), display as compact placeholder like "[Pasted text #1]"
- Placeholders are displayed in dim cyan styling inline with regular text
- Multiple pastes in the same input are numbered sequentially
- Full pasted content is preserved and expanded on submission
- Added to CommandInput, InitWizard, and AddTaskWizard description fields
- Added isPasteLongEnough() and expandPastedSegments() utility functions with tests
