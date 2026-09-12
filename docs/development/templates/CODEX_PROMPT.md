# Codex Execution Prompt

Implement the attached/current execution contract end to end.

Before changing code:
1. Read the project `AGENTS.md`, `PROJECT_PROFILE.md`, current Issue/contract, and every referenced architecture/decision/validation document.
2. Inspect the existing implementation and tests. Do not assume file structure or behavior from the prompt alone.
3. Confirm the authoritative baseline and preserve protected behavior.

During execution:
- Stay within scope.
- Prefer root-cause fixes over symptom patches.
- Do not perform unrelated refactoring or dependency cleanup.
- Add regression coverage appropriate to the change.
- Run each required success gate.
- If a stop condition is reached, stop and report rather than silently expanding scope.
- If parallel workers are authorized, obey file/module ownership and integration contracts.

Completion report:
- summary of behavior changed;
- changed files/modules;
- success-gate outcomes and exact validation commands;
- CI/runtime/browser/artifact evidence where required;
- assumptions and deviations;
- unresolved risks/limitations;
- commit/PR identifiers.

Do not claim completion when a mandatory gate is FAIL or BLOCKED.
