# Parallel Execution

Parallel agents primarily reduce elapsed time; they do not automatically reduce credits or total work.

## Parallelize only when

- workstreams are genuinely independent;
- file/module ownership can be separated;
- interfaces/contracts are already defined;
- each worker has its own success gate;
- integration order and owner are explicit;
- duplicated repository reading/reasoning is outweighed by the benefit.

## Avoid

Do not spawn multiple agents to independently solve the same vaguely defined problem by default. This duplicates context, creates conflicting implementations, and increases reconciliation cost.

Do not use generic role names as a substitute for task definition. `backend engineer`, `QA agent`, or `reviewer` is weaker than a worker packet that names the concrete outcome, owned surface, preserved contracts, and evidence required.

## Task-specific workers

Prefer workers shaped around the actual bounded task or feature slice, for example:
- `excel-direction-mapping-investigator` rather than generic `data engineer`;
- `checkout-flow-verifier` rather than generic `QA`;
- `schema-migration-reviewer` rather than generic `reviewer`.

The name itself is not important; the principle is that the worker's context and tools should be optimized for one explicit objective rather than a broad job title.

Where the execution environment supports it, preload only the focused skills/domain references relevant to that worker. Apply `CONTEXT_MANAGEMENT.md` so unrelated project history does not occupy the worker's context.

## Worker packet

Each worker receives:
- objective;
- owned files/modules or decision surface;
- interfaces it may rely on;
- files/areas it must not modify;
- relevant research/scrutiny findings;
- success gates;
- validation commands;
- stop conditions;
- handoff format.

## Fresh-context reviewers

Parallelism can also be used for **test-time review**, not only implementation. A fresh worker may review a plan, diff, or artifact without inheriting the executor's reasoning trail.

Use `skills/independent-review/SKILL.md` when this independence materially reduces acceptance risk. The reviewer may use the same model tier as the executor if the task is within that tier's capability; a stronger model is not automatically required.

Do not run multiple redundant reviewers by default. Add reviewers only when the incremental chance of catching a material problem justifies the extra context/read/reconciliation cost.

## Worktree / isolation

When supported and appropriate, isolate parallel implementation workers in separate branches/worktrees so file ownership and rollback remain clear. Isolation does not remove the need for explicit interface contracts or final integration testing.

## Integration

One owner is responsible for contract reconciliation, merge conflicts, cross-worker tests, and final integration evidence. For complex execution this can be a stronger coding-agent orchestrator; otherwise the primary worker or human/ChatGPT control plane is sufficient.

The integration owner must review the actual combined result. Passing worker-level gates independently does not prove that the integrated system passes its cross-module contracts.
