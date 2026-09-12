---
name: long-task-guard
description: Keep multi-step or long-running engineering work bounded, observable, resumable, and evidence-driven without unnecessary phase splitting or scope drift.
---

# Long Task Guard

Use this skill for work that spans many steps, multiple validation layers, several tool calls, or a long agent execution where context loss and scope drift are material risks.

## Trigger conditions

Use when:
- the task has multiple dependent implementation/validation steps;
- several agents or workstreams are involved;
- the work may be interrupted and resumed later;
- execution is likely to produce a large volume of logs/status output;
- a phase contains several internal gates but should remain one coherent PR;
- repeated retries risk losing the authoritative baseline or original objective.

This skill does **not** require splitting one coherent task into many phases. Prefer one reviewable work item with internal checkpoints when scope and dependencies remain coherent.

## Required inputs

Establish:
- objective and definition of done;
- authoritative repo/branch/SHA;
- scope and out-of-scope;
- protected invariants;
- ordered success gates;
- worker/file ownership if parallel work is used;
- stop/escalation conditions.

## Procedure

1. Convert the work into a small number of meaningful checkpoints tied to evidence, not arbitrary time slices.
2. Keep a single authoritative task/issue and execution contract unless scope materially changes.
3. At each checkpoint, record current SHA/state, gates passed/failed, remaining blockers, and next action.
4. Prevent agents from expanding scope merely to make progress.
5. When work can run in parallel, apply `PARALLEL_EXECUTION.md` and assign explicit ownership/integration boundaries.
6. When a defect blocks progress, route to `systematic-debug` instead of improvising around it.
7. When new information changes the objective, dependencies, architecture, or risk materially, stop and re-plan rather than silently continuing under the old contract.
8. Before handoff or context reset, produce a compact authoritative checkpoint that another session can reconstruct from GitHub.
9. Finish only when all required gates are resolved and evidence is attached.

## Output

At each meaningful checkpoint report:
- objective still in force;
- authoritative branch/SHA;
- completed gates;
- failed/blocked gates;
- scope changes, if any;
- current risks/unknowns;
- next action;
- whether the current chat/agent context should continue or a clean handoff is safer.

## Gate rules

A checkpoint is not a mini-release. It exists to make the task observable and resumable.

Do not mark overall completion while any required gate remains `FAIL` or `BLOCKED`, unless an explicit human-approved limitation changes the acceptance contract.

## Gotchas

- Do not split work into phases merely because it is long; split when ownership, risk, dependency, or reviewability requires it.
- A checkpoint without branch/SHA and gate state is a narrative, not a resumable checkpoint.
- Repeated retries can silently change the objective; restate the objective after material failures or discoveries.
- Parallel workers that touch overlapping contracts can increase wall-clock time through reconciliation rather than reduce it.
- Percentage-complete reporting is weak when one unresolved gate can still block acceptance.
- Before context reset, preserve decisions and evidence, not the full transcript.

## Stop / escalation

Stop and re-plan when:
- scope materially expands;
- a protected invariant cannot be preserved;
- parallel workers begin overlapping ownership materially;
- the accepted baseline changes underneath the task;
- repeated failures indicate the execution packet or model routing is wrong;
- the remaining work requires a different architecture or approval authority.