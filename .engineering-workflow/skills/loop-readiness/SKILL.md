---
name: loop-readiness
description: Assess whether a recurring or event-driven agent loop is safely ready for A1 observe/report, A2 assisted bounded action, or A3 bounded unattended operation.
---

# Loop Readiness

Use this skill before enabling a new recurring loop, increasing its autonomy, materially widening its watched/action scope, or re-enabling it after a significant loop incident.

The skill evaluates the loop contract against `CONTINUOUS_OPERATIONS.md`. It does not award autonomy merely because configuration files exist.

## Trigger conditions

Apply when:
- a recurring/event-driven agent workflow is proposed;
- an A0 design is about to become active;
- an A1 loop is being considered for A2 action;
- an A2 loop is being considered for A3 unattended operation;
- permissions, watched scope, mutation authority, cadence, or budget widen materially;
- a loop incident, repeated false positive/action, cost spike, or circuit-breaker event calls existing readiness into question.

Do not use this skill for ordinary one-off development work.

## Required inputs

Gather:
- loop purpose and explicit non-goals;
- current autonomy level and requested level;
- watched scope and trigger/cadence;
- authoritative source(s) of truth;
- operational-state strategy and refresh/prune rules;
- action allowlist and protected denylist;
- verifier/independent-review strategy;
- attempt cap and no-progress/circuit-breaker rule;
- budget and model/escalation ceiling;
- human handoff destination and triggers;
- notification/deduplication policy;
- run observability/history;
- collision/ownership rules;
- pause/kill/rollback behavior;
- connector/tool permissions;
- success metrics and, for graduation, actual prior operating evidence.

## Procedure

1. Verify the loop is actually recurring/event-driven; otherwise prefer the normal core workflow.
2. Restate the requested autonomy transition.
3. Check purpose, scope, source-of-truth, and non-goals for ambiguity.
4. Confirm operational state cannot supersede live authoritative state and is not mandatory without need.
5. Check permissions/action boundaries against the requested autonomy.
6. Check verifier independence and deterministic evidence for any mutation path.
7. Check finite attempts, no-progress detection, budget/model ceiling, and pause/kill behavior.
8. Check human escalation and selective-notification behavior.
9. Check multi-loop collision/ownership handling where relevant.
10. Check observability sufficient to diagnose a bad run without relying on chat memory.
11. For A3, require credible evidence from real A1/A2 operation; documentation-only readiness is insufficient.
12. Produce the highest level actually supported by evidence, not necessarily the level requested.

## Output

Produce a loop-readiness record containing:
- loop/pattern identifier;
- requested autonomy;
- evidence reviewed;
- readiness by dimension;
- blockers;
- non-blocking improvements;
- protected-area/human-approval constraints;
- observed operating evidence when graduation is requested;
- highest supported outcome:
  - `READY FOR A1`
  - `READY FOR A2`
  - `READY FOR A3`
  - `NOT READY`
- exact conditions required before a higher level may be reconsidered.

## Gate rules

### READY FOR A1

Requires at minimum:
- clear purpose/non-goals;
- explicit watched scope and trigger;
- authoritative source-of-truth definition;
- safe read/report permissions;
- notification destination/policy;
- pause/disable path.

### READY FOR A2

Requires all relevant A1 controls plus:
- explicit reversible action allowlist;
- protected-area denylist/human gates;
- verifier or independent deterministic verification for mutation;
- finite attempt cap and no-progress detection;
- budget/model ceiling;
- run history/observability;
- human escalation path;
- ownership/collision rule where applicable.

### READY FOR A3

Requires all relevant A2 controls plus:
- real operating evidence from lower autonomy;
- demonstrated signal quality and verifier reliability;
- proven budget/circuit-breaker behavior;
- recovery/rollback and kill behavior;
- least-privilege unattended permissions;
- no unresolved high-risk finding.

A3 does not authorize protected engineering/safety/security/legal/destructive acceptance or merge.

If evidence supports only a lower level, report that lower level and block the requested increase.

## Gotchas

- Files-on-disk can create readiness theater; operating evidence matters.
- A quiet loop can still be unsafe if it has excessive permissions.
- A strong verifier does not compensate for unlimited retries or budget.
- A low false-positive rate does not prove safe mutation behavior.
- State completeness is not a reason to create state when live GitHub already contains the truth.
- Autonomy should be reduced after incidents when trust assumptions no longer hold.

## Stop / escalation

Stop and escalate when:
- the requested autonomy includes protected/high-impact decisions without human ownership;
- action permissions are broader than the stated purpose;
- authoritative state cannot be established reliably;
- the loop can retry or spend without finite bounds;
- A3 is requested without lower-level operating evidence;
- a human owner must decide an acceptable risk/cost trade-off;
- enabling the requested level would require weakening an existing core workflow gate.
