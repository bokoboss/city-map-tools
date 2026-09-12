---
name: postmortem
description: Turn a significant resolved defect or incident into a concise learning record with causes, detection gaps, remediation evidence, and prevention actions.
---

# Postmortem

Use this skill after a meaningful defect or incident has been fixed and validated, when preserving the lesson will reduce recurrence or future diagnosis cost.

## Trigger conditions

Use when one or more applies:
- the defect reached users, field validation, release qualification, or production-like use;
- the issue caused repeated failed attempts or substantial rework;
- a protected invariant or important contract was violated;
- CI/tests failed to catch the problem early;
- the root cause revealed a systemic gap in process, testing, observability, documentation, or ownership.

Do not create a postmortem for every trivial bug. The record should earn its maintenance cost.

## Required inputs

Collect verified facts only:
- timeline or sequence of relevant events;
- user/system impact;
- reproducer and root cause;
- accepted fix and validation evidence;
- detection and prevention gaps;
- related issue, PR, commit, CI, release, or field evidence identifiers.

## Procedure

1. State what happened and what was affected without blame language.
2. Separate trigger, technical root cause, and contributing conditions.
3. Explain why existing controls did not prevent or detect the problem sooner.
4. Record the remediation and evidence proving it fixed the issue.
5. Identify prevention actions, prioritizing changes that improve the system rather than relying on memory or vigilance.
6. Assign each follow-up as completed, planned, accepted risk, or not justified.
7. Link the record to authoritative GitHub evidence.

## Output

Produce:
- summary;
- impact;
- detection/reproducer;
- root cause;
- contributing factors;
- remediation and validation;
- what worked / what failed in the development process;
- prevention actions and owners/status when known;
- residual risk and accepted limitations.

## Gate rules

Do not write a definitive root cause when evidence supports only a hypothesis. Mark uncertainty explicitly.

A postmortem is complete when the accepted fix is validated and prevention actions are either tracked or consciously declined with rationale.

## Gotchas

- Hindsight makes the root cause look obvious; record what evidence was actually available at each stage.
- Avoid blame labels such as "human error" when a system, test, interface, or guardrail could have prevented recurrence.
- Do not create prevention actions that amount only to "remember to be careful" when deterministic controls are possible.
- Keep trigger, root cause, and contributing conditions distinct; combining them weakens prevention.
- A long incident narrative is not a useful postmortem unless it changes future behavior.
- Do not close follow-ups implicitly; track them or explicitly accept the residual risk.

## Stop / escalation

Escalate to human/project leadership when the record involves personnel-sensitive matters, contractual/client impact, security disclosure, safety implications, or decisions about accepting material engineering risk.