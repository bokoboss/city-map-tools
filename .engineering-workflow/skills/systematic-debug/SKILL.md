---
name: systematic-debug
description: Diagnose and fix defects from a reliable reproducer and evidence, separating symptoms from root cause and requiring regression proof before closure.
---

# Systematic Debug

Use this skill when a defect, regression, test failure, runtime error, broken workflow, or unexplained behavior must be diagnosed and fixed.

## Trigger conditions

Use when:
- there is a reproducible bug or failing test;
- CI, browser, runtime, package, integration, or real-data validation fails;
- a previous fix did not resolve the actual defect;
- multiple plausible causes exist and guessing would create churn.

If no reliable reproducer exists, the first objective is to create or narrow one rather than immediately editing code.

## Required inputs

Collect:
- observed behavior;
- expected behavior;
- smallest reliable reproducer available;
- current accepted baseline and relevant changes;
- logs, traces, test output, screenshots, or data that distinguish hypotheses;
- invariants and protected behavior that the fix must preserve.

## Procedure

1. Reproduce the failure and record exact evidence.
2. Reduce the reproducer until the failing boundary is clear enough to test hypotheses efficiently.
3. Separate symptom, trigger, failing component, and likely root cause.
4. Form a small set of competing hypotheses; define what evidence would confirm or reject each one.
5. Inspect the relevant code/data path before modifying it.
6. Fix the root cause with the smallest change that preserves contracts and unrelated behavior. Do not mask symptoms with UI suppression, blind retries, broad dependency changes, or hard-coded special cases unless that behavior is the intended design.
7. Add or strengthen a regression test that would have failed before the fix.
8. Run targeted validation first, then the required broader regression gates.
9. Check whether the defect reveals a missing guardrail, observability gap, or documentation issue. For high-impact defects that escaped prior gates, revealed systemic weakness, or are likely to recur, route to the postmortem skill; do not create postmortem ceremony for trivial one-off mistakes.
10. Report root cause, fix, evidence, residual risk, and whether a postmortem is warranted.

## Output

Report:
- reproducer;
- root cause and supporting evidence;
- changed behavior/files;
- regression coverage added or strengthened;
- targeted and broader validation results;
- assumptions and remaining limitations;
- whether the issue is fixed, blocked, or requires escalation.

## Gate rules

A defect is not closed because the symptom disappeared once. Closure requires:
- the reproducer no longer fails for the intended reason;
- a regression test or equivalent repeatable evidence exists when practical;
- required broader gates pass;
- protected behavior remains intact.

## Gotchas

- Editing before a reliable reproducer often converts one unknown into several.
- A passing unit test does not prove browser/runtime/package behavior when the defect crosses those boundaries.
- Change one causal variable at a time where practical; large speculative patches destroy diagnostic information.
- Watch for stale asynchronous/session responses and partial-state cleanup when stateful workflows fail mid-operation.
- A symptom disappearing after restart or retry is not root-cause evidence.
- Do not broaden architecture merely because the local root cause is inconvenient to fix.

## Stop / escalation

Stop scope expansion when evidence points outside the authorized work packet. Re-plan before changing architecture, public contracts, protected engineering logic, or unrelated modules.

Escalate model capability only after distinguishing a capability limitation from a weak reproducer, unclear specification, broken environment, or missing dependency.