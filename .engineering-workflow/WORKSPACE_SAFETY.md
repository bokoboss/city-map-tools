# Workspace Safety

## Principle

The default writable boundary for coding-agent execution is:

> **the explicit target project root, and only that project root.**

This boundary applies to FAST, STANDARD, STRICT, focused skills, workers, scripts, installers, debugging, and cleanup.

Convenience is not permission to modify the user's machine.

## 1. Default filesystem authority

Without explicit human approval for a specific external action, an agent may create, modify, move, rename, or delete files only inside the target project root.

External paths are non-writable by default.

If the project uses a linked reference, dataset, licensed manual, SDK, or other external resource, reading may be allowed when the task and access rights permit it, but reading does not grant mutation authority.

## 2. Forbidden external mutations by default

Do not create/modify/delete/move/rename:

- another repository or project;
- the checked-out Engineering Development Workflow source repository used as installer input;
- arbitrary directories under the user's home/profile;
- shell/profile startup files;
- global IDE/editor settings;
- global Git configuration;
- SSH/GPG/cloud credentials or credential stores;
- system folders;
- Windows registry or equivalent system configuration;
- services/daemons;
- scheduled tasks;
- global environment variables;
- firewall/network/system proxy configuration;
- global package/tool installations;
- unrelated temporary/staging directories outside the project.

Do not intentionally create persistent working/staging folders elsewhere on the machine when a project-local location can be used.

Normal temporary files/caches created internally by an already-approved toolchain are not an authorization for the agent to manage unrelated external directories.

## 3. Project-local preference

Prefer project-local:
- virtual environments;
- dependency directories;
- caches when configurable;
- generated artifacts;
- test fixtures;
- scratch/staging directories;
- configuration;
- logs;
- downloaded test assets where licensing permits.

If a tool supports both global and project-local installation/configuration, choose project-local by default.

## 3A. Harness / sandbox enforcement

Where the coding harness supports deterministic writable-root allowlists, sandboxing, or per-action approval, configure execution so the target project root is the only writable root by default.

Prefer a harness-enforced boundary over prompt-only compliance.

Do not enable unrestricted/full-filesystem mutation merely to avoid approval friction. Do not let the workflow installer modify global agent settings to enforce this; global configuration itself requires explicit human ownership/approval. Use project-scoped or session-scoped controls when available.

## 4. Dirty worktree and user work

Before destructive or broad mutation:
- inspect Git/worktree state;
- preserve unknown or pre-existing user changes;
- do not delete untracked files merely because they are not part of the task;
- do not overwrite files whose ownership/purpose is unclear.

Do not use blanket destructive commands such as recursive force deletion, `git clean -fdx`, destructive reset/history rewrite, or equivalent cleanup as a convenience step.

If such an operation is genuinely necessary, treat it as STRICT and require explicit human approval after reporting what can be lost.

## 5. Symlink / junction / reparse-point safety

A path lexically inside the project can still point outside it.

Before writing through:
- symbolic links;
- directory junctions;
- reparse points;
- mounted/link-like paths;

confirm the resolved destination remains inside the approved project root.

If containment cannot be established deterministically, do not write through the path.

Installers and automation should fail closed on managed destinations that can escape the project through link-like filesystem objects.

## 6. External-write approval protocol

If the task appears to require a write outside the project, stop before the mutation and report:

```text
External resource/path:
Exact mutation requested:
Why it is necessary:
Why project-local alternatives are insufficient:
Safer project-local alternative considered:
Reversibility/rollback:
Risk if approved:
```

Proceed only after explicit human approval for that exact resource/action.

Approval for one external path/action does not grant general external write access.

## 7. System/global changes

Any system/global change is STRICT.

Examples:
- installing a global package/tool;
- editing PATH globally;
- changing registry;
- adding a service;
- adding a scheduled task;
- changing shell profile;
- changing global Git config;
- changing firewall/proxy/network settings;
- writing credentials/config under home/system locations.

Prefer a project-local or user-performed alternative.

If no safe local alternative exists, stop and ask for explicit approval with exact commands/effects.

## 8. Network and downloads

Network access is separate from filesystem write authority.

A task may require network access for dependencies/research, but:
- do not download executable/tooling content to arbitrary external folders;
- do not run downloaded code merely because it is available;
- pin/review security-sensitive dependencies where appropriate;
- keep project artifacts inside the project where practical;
- preserve licensing/provenance constraints.

## 9. Worker and subagent inheritance

Every worker/subagent inherits the same workspace boundary.

A parent agent cannot delegate broader filesystem authority than it possesses.

Worker packets must not use another worktree/repository unless that location is explicitly part of the approved project execution strategy.

## 10. Installer boundary

The workflow installer itself must:
- perform no network access;
- accept an explicit target directory;
- reject dangerous targets such as filesystem root, user home, or the workflow source checkout;
- write only under the resolved target root;
- refuse managed writes through symlink/junction/reparse-point escape paths;
- preserve project-owned files;
- refuse conflicts instead of overwriting;
- never perform arbitrary recursive deletion.

## 11. Stop conditions

Stop before mutation when:
- target project root is unclear;
- a write resolves outside the project;
- a link/junction destination cannot be proven contained;
- a command may delete unknown user work;
- global/system mutation appears necessary;
- another repository must be changed;
- a permission boundary must be widened;
- the task needs credentials or secrets not already safely available.

Report the blocker and the minimum explicit approval or safer alternative needed.

## 12. Completion evidence

For material execution, the completion report should confirm:
- target project root used;
- whether any external writes occurred;
- whether any destructive command occurred;
- whether any global/system configuration changed.

The expected safe answer for ordinary work is:

`External writes: none. Global/system changes: none.`
