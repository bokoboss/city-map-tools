# Project Agent Instructions

This project follows the Engineering Development Workflow:
https://github.com/bokoboss/engineering-development-workflow

Before changing code:
1. Read `PROJECT_PROFILE.md`.
2. Read the project-local pinned router at `.engineering-workflow/SKILL.md`.
3. Apply `.engineering-workflow/WORK_MODE_ROUTING.md` and state FAST / STANDARD / STRICT.
4. Apply `.engineering-workflow/WORKSPACE_SAFETY.md`.
5. Inspect the actual repository and current Git/GitHub state.
6. Preserve project-specific invariants and protected behavior.
7. Define success gates before implementation.

## Project-specific instructions

### Source of truth and startup
- Reconstruct current branch, HEAD, worktree, and relevant GitHub Issue/PR before edits; GitHub, commits, CI, and project files are durable truth, not chat history.
- Read only the local workflow policies and focused skills required by the routed work mode/task.

### Workspace safety
- Default writable boundary: `C:\MyRD\city-map-tools` only.
- Do not modify another repository, including the shared Engineering Development Workflow checkout.
- Do not install tools/packages globally or change PATH, registry, shell/profile, global Git config, services, scheduled tasks, credentials, firewall/proxy, or other user/system configuration without explicit human approval.
- Preserve unknown and untracked user work; do not use destructive reset/clean commands for convenience.

### Product and engineering invariants
- Never present or export synthetic, demo, or pseudo values as validated engineering results.
- Quarantined analytical features remain disabled until their own validation gate is accepted.
- Space Syntax/angular segment analysis (#10) is deferred research; do not implement it without a future explicit `GO` or `GO WITH CONDITIONS`.
- Current routing/accessibility scope is pedestrian only; do not add motor-vehicle routing or traffic-aware isochrones.
- Keep WGS84 storage, metric calculation method/CRS, units, and transformations explicit.
- Engineering/spatial outputs preserve method, source, parameters, units, version, status, and limitations appropriate to their claim.
- Distinguish authored data from derived results; stale or experimental status must remain visible through review/export.

### Static/local-first and credentials
- Core app must remain deployable as a static artifact and usable without a mandatory paid backend.
- External providers are optional and must have explicit attribution, error/failure behavior, usage/licensing notes, and capability state.
- Never commit or persist secrets or API keys. Browser BYOK keys, when permitted by a provider, are runtime-memory-only by default and must not be stored in IndexedDB, localStorage, project files, exports, logs, or analytics.

### Architecture and UX
- Do not perform a big-bang rewrite; follow bounded migration Issues #18–#21.
- Keep analytical/domain logic pure and testable, independent of React, DOM, and MapLibre objects.
- Add dependencies only for demonstrated need; do not recreate the old PRD dependency list automatically.
- UX is task-oriented and extensible through bounded command/panel surfaces; do not create a speculative plugin platform or permanent dead buttons for deferred features.

### Verification and completion
- Define success gates before implementation and run validation appropriate to the changed behavior.
- Review the actual diff and outputs; executor narrative alone is not acceptance evidence.
- Do not claim completion with a mandatory gate failed or blocked.
- Material engineering, security, licensing, or architecture changes require the scrutiny and independent-review gates specified by the applicable Issue/workflow.
- Completion reports must state external writes and global/system changes; the normal expected result is `External writes: none. Global/system changes: none.`
