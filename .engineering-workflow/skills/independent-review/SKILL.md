---
name: independent-review
description: Review a material plan or implementation from a fresh context or different model/agent when independent verification can reduce confirmation bias or executor blind spots.
---

# Independent Review

Use this skill when the cost of accepting an executor's own interpretation is high enough to justify a second, meaningfully independent pass.

## Trigger conditions

Apply when one or more of these are true:
- the change affects protected engineering, safety, security, public interfaces, schemas, migrations, or other high-impact behavior;
- the implementation is large, cross-module, difficult to reason about, or materially different from the reviewed plan;
- tests/CI pass but important correctness still depends on judgment or assumptions;
- the change is material and the same executor produced both the implementation and the only substantive review;
- a defect escaped earlier checks and recurrence risk is material;
- evidence is mixed, contradictory, or unusually easy to rationalize;
- a fresh-context review is cheap relative to the consequence of a missed defect.

Do not require a second agent for every trivial change. Independence is risk-based, not ceremonial.

## Required inputs

- Issue/execution contract and accepted baseline;
- actual diff or implementation artifact;
- validation evidence already produced;
- protected behavior and relevant project references;
- known risks, assumptions, and deviations from plan;
- explicit review question: what must the reviewer independently establish?

## Procedure

1. Define the review boundary and success criteria before selecting the reviewer.
2. Prefer a reviewer that did not generate the implementation context. Independence may come from:
   - a fresh session/context using the same model tier;
   - a different model or agent;
   - a human specialist;
   - deterministic verification that independently recomputes or exercises behavior.
3. Give the reviewer authoritative project facts, the contract, the actual diff/artifact, and evidence. Avoid feeding the executor's persuasive narrative as the primary frame.
4. Ask the reviewer to challenge correctness, scope containment, assumptions, regression risk, missing tests, and evidence quality.
5. Require findings to distinguish verified defects, plausible risks, questions, and non-issues.
6. Reconcile findings against the actual repository/evidence; do not accept reviewer claims merely because they are independent.
7. Produce a decision:
   - `PASS` — no material unresolved finding;
   - `PASS WITH CONDITIONS` — acceptable only if explicit conditions are completed;
   - `REMEDIATE` — material finding requires change and re-verification;
   - `BLOCKED` — reviewer cannot reach a reliable conclusion from available evidence.
8. If remediation changes material behavior, repeat the appropriate targeted and independent checks rather than relying on the old review.

## Output

Produce an independent-review record containing:
- review scope and reviewer independence basis;
- evidence inspected;
- material findings with severity/confidence;
- disagreements with executor assumptions or claims;
- missing evidence/tests;
- decision: `PASS`, `PASS WITH CONDITIONS`, `REMEDIATE`, or `BLOCKED`;
- required follow-up and re-review conditions.

## Gate rules

- For high-risk changes, executor self-report alone is not sufficient acceptance evidence.
- Independence does not require a stronger or more expensive model by default; fresh context at the same tier may be sufficient.
- A stronger reviewer is justified when the review itself requires materially greater judgment than the implementation.
- Automated tests/CI remain independent evidence but may not replace human/model review where the untested risk is conceptual, architectural, UX, safety, or methodology-related.
- Reviewer findings must be validated; independent hallucinations are still hallucinations.
- Human approval remains mandatory where the project marks it mandatory.

## Gotchas

- Giving the reviewer the executor's conclusion first can anchor the review and reduce independence.
- Two agents reading the same flawed assumption are not truly independent if the assumption is never challenged.
- A different model is not automatically a better reviewer; review quality depends on task fit and evidence.
- Re-running the same tests is not independent review if the risk lies outside what those tests cover.
- Review scope that is too broad becomes expensive noise; target the material risk.
- A clean review does not erase missing required evidence.

## Stop / escalation

Stop and escalate when:
- reviewer and executor disagree on protected/high-impact behavior and evidence does not resolve the conflict;
- the review reveals an architecture or methodology decision requiring human ownership;
- the reviewer needs unavailable local/runtime evidence;
- repeated fresh-context reviews produce contradictory conclusions without new evidence;
- the cost of uncertainty now exceeds the cost of a stronger reviewer, targeted experiment, or human specialist.
