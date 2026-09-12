# Codex Execution Prompt

Implement the attached/current execution packet end to end.

The control plane must provide before execution:
- Work mode: FAST / STANDARD / STRICT
- Mode rationale and escalation triggers
- Target project root / writable boundary
- External writes approved: normally No
- Recommended model + reasoning effort + existing/new chat
- Required local workflow policies/skills
- Success gates

Before changing code:
1. Confirm the explicit target project root. Treat it as the only writable filesystem boundary unless the human explicitly approved a specific external mutation.
2. Read project `AGENTS.md`, `PROJECT_PROFILE.md`, `.engineering-workflow/SKILL.md`, `.engineering-workflow/WORK_MODE_ROUTING.md`, and `.engineering-workflow/WORKSPACE_SAFETY.md`.
3. Read only the additional local policies/skills referenced by the selected work mode/task.
4. Read the current Issue/packet and relevant architecture/decision/validation documents.
5. Inspect the existing implementation and tests. Do not assume file structure or behavior from the prompt alone.
6. Confirm the authoritative baseline and preserve protected behavior.

During execution:
- Stay within scope and the target project root.
- Do not create/modify/move/delete files outside the project, modify another repository, install globally, or change user/system configuration without explicit human approval for that exact action.
- Prefer project-local environments, dependencies, caches, staging, and generated artifacts.
- Where the harness supports writable-root/sandbox controls, keep the project root as the only writable root; do not enable unrestricted filesystem access for convenience.
- Preserve pre-existing user/uncommitted work; do not use blanket destructive cleanup/reset commands as a convenience.
- If the task needs an external/system write, STOP before action and report the exact resource, mutation, reason, safer local alternative, and rollback.
- Stay within scope.
- Prefer root-cause fixes over symptom patches.
- Do not perform unrelated refactoring or dependency cleanup.
- Add regression coverage appropriate to the change.
- Run each required success gate.
- If a stop condition is reached, stop and report rather than silently expanding scope.
- If FAST/STANDARD encounters a higher-risk trigger, stop at a safe checkpoint and escalate the work mode before continuing.
- If parallel workers are authorized, obey file/module ownership and integration contracts.

Completion report:
- summary of behavior changed;
- changed files/modules;
- success-gate outcomes and exact validation commands;
- CI/runtime/browser/artifact evidence where required;
- assumptions and deviations;
- unresolved risks/limitations;
- commit/PR identifiers;
- work mode used and any escalation;
- target project root;
- external writes performed (normally none);
- global/system changes performed (normally none).

Do not claim completion when a mandatory gate is FAIL or BLOCKED.
