---
name: scrutinize
description: Stress-test a plan, design, change, or proposed decision before execution or acceptance, especially when engineering correctness, architecture, safety, or high-impact behavior is involved.
---

# Scrutinize

Use this skill to challenge whether a proposed direction is actually ready to proceed. It is a structured adversarial review, not a generic request for more detail.

## Trigger conditions

Use when any of the following applies:
- a major phase or feature is about to start;
- architecture, interfaces, data contracts, or project structure will change;
- protected engineering, safety-critical, security-sensitive, or high-impact behavior may change;
- a risky PR is approaching merge;
- the user asks to check a plan, concept, design, scope, proposal, or readiness before presenting or implementing it;
- evidence is incomplete but a go/no-go decision is being considered.

For architecture changes, protected engineering/safety logic, and high-risk pre-merge decisions, this skill is a **required gate** unless the project explicitly documents why it is not applicable.

## Required inputs

Gather the minimum authoritative evidence available:
- objective and decision being considered;
- current repository/project state;
- scope and out-of-scope;
- constraints, invariants, and protected behavior;
- acceptance criteria or intended outcome;
- relevant tests, references, evidence, and known uncertainties.

Do not invent missing project facts. If evidence is unavailable, make the conclusion conditional.

## Procedure

1. Restate the actual decision in one sentence.
2. Check whether the problem is framed correctly or whether the proposed solution is answering the wrong problem.
3. Test scope boundaries: missing work, unnecessary work, hidden dependencies, and scope creep.
4. Test assumptions and invariants: what must remain true, and what evidence proves it.
5. Examine failure modes, reversibility, migration/rollback, operational impact, and downstream effects.
6. Check whether success gates can detect a false success.
7. Look for simpler alternatives that achieve the objective with less risk or cost.
8. Separate blockers from non-blocking improvements.
9. Produce a decision: `GO`, `GO WITH CONDITIONS`, `REPLAN`, or `NO-GO`.

## Pre-merge review order

When scrutinizing an implementation or PR before acceptance, review in this order:

1. scope and intent;
2. behavior and correctness;
3. protected engineering logic and data contracts;
4. regression risk;
5. tests and evidence quality;
6. UX, error recovery, accessibility, and localization when relevant;
7. security, privacy, and secrets;
8. maintainability and documentation;
9. cosmetic polish.

A passing CI run is necessary when required, but it is not sufficient when the tests do not exercise the acceptance contract.

## Output

Report:
- decision and confidence;
- blockers;
- conditions that must be satisfied before proceeding;
- important risks and assumptions;
- missing evidence;
- recommended next action;
- exact success gates that should be added or strengthened.

## Gate rules

A `GO` requires no unresolved blocker and enough evidence to show the proposed work can be validated.

Use `GO WITH CONDITIONS` when execution can start safely but named conditions must be satisfied before acceptance or merge.

Use `REPLAN` when the objective is valid but scope, design, sequencing, or validation strategy is materially weak.

Use `NO-GO` when proceeding would violate a protected invariant, create unacceptable risk, or rely on evidence that cannot support the decision.

## Gotchas

- An implementable plan is not necessarily the right plan; test the problem framing before implementation detail.
- More detail can hide a weak assumption. Do not confuse document completeness with decision quality.
- Separate blockers from preferences so scrutiny does not become endless polish.
- Do not reward sunk cost: partially implemented work can still deserve `REPLAN` or `NO-GO`.
- Missing evidence should lower confidence, not be silently converted into assumptions.
- Do not turn scrutiny into ceremony for low-risk edits where the review cost exceeds the plausible failure cost.

## Stop / escalation

Stop and request a higher-level decision or human approval when the review reaches a protected methodology, safety-critical rule, destructive operation, irreversible migration, or material engineering judgment that the workflow does not authorize an agent to decide.