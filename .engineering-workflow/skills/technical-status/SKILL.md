---
name: technical-status
description: Convert long technical execution output, logs, CI results, or agent reports into a decision-ready status without losing blockers, evidence, risks, or the next action.
---

# Technical Status

Use this skill when raw technical status is too verbose, fragmented, or implementation-focused for a useful project decision.

## Trigger conditions

Use when:
- a coding agent returns a long completion/debug report;
- CI/test/package/browser results must be summarized;
- a branch/PR has mixed pass/fail gates;
- the user asks what has actually been completed, what remains, or what to do next;
- a handoff needs to preserve technical truth without carrying the full execution transcript.

## Required inputs

Prefer authoritative evidence:
- current branch/SHA and accepted baseline;
- issue/PR state;
- test and CI results;
- changed behavior/files;
- blockers and failed gates;
- assumptions, limitations, and protected-change status.

Do not convert an agent claim into a verified fact unless supporting evidence exists.

## Procedure

1. Identify the decision the status must support: continue, remediate, merge, accept, release, or escalate.
2. Separate verified facts from agent claims, interpretation, and unknowns.
3. Compress implementation detail while retaining evidence identifiers and any failure that changes the decision.
4. State completed work by outcome, not by activity count.
5. State remaining work by blocker/gate, not by vague percentage.
6. Surface contradictions such as frontend pass/backend fail, local pass/CI fail, or code complete/UAT blocked.
7. End with one concrete next action and the condition for moving beyond it.

## Output

Use a compact status with:
- **Current state** — one sentence;
- **Verified completed** — outcomes with evidence;
- **Blocked / failed** — unresolved gates and impact;
- **Risks / limitations** — only decision-relevant items;
- **Decision** — `CONTINUE`, `REMEDIATE`, `READY FOR REVIEW`, `ACCEPT`, or `BLOCKED`;
- **Next action** — one explicit action or execution packet.

## Gate rules

Never summarize a mixed result as simply "passed" or "done". A failed required gate keeps the overall status failed or blocked until the workflow explicitly accepts the limitation.

When evidence is stale or incomplete, say so and avoid an acceptance decision.

## Gotchas

- A long list of commands run is not proof of completion; summarize outcomes and required gates.
- Always anchor status to the current branch/SHA when state may have moved.
- Do not hide one failed mandatory gate behind many passing checks.
- Distinguish "implemented", "validated locally", "CI green", "UAT accepted", and "merged"; they are different states.
- Preserve exact evidence identifiers when compressing logs so the conclusion can be audited.
- Avoid percentage-complete estimates when the remaining blocker could dominate the actual effort or acceptance risk.

## Stop / escalation

Escalate when conflicting evidence cannot be reconciled from available sources, when a protected change lacks approval, or when the requested status would require inventing progress not demonstrated by Git/GitHub/tests/CI/real-data evidence.