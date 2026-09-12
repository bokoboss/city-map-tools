---
name: research-gate
description: Investigate feasibility, prior art, constraints, standards, unknowns, and evidence before committing to a material implementation direction when the answer is not already established.
---

# Research Gate

Use this skill when implementation would otherwise begin before an important feasibility, methodology, architecture, dependency, or external-evidence question is resolved.

## Trigger conditions

Apply when one or more of these are true:
- a proposed feature or integration has material feasibility uncertainty;
- a new framework, library, API, model, standard, or methodology may determine the design;
- several plausible approaches exist and choosing the wrong one would create material rework;
- an engineering or regulatory claim needs authoritative evidence before implementation;
- the request depends on current external facts, compatibility, licensing, or product capability;
- scrutiny identifies an unknown that cannot be responsibly treated as an assumption.

Do not use as ceremony for trivial edits, established project patterns, or work whose required evidence is already present and current.

## Required inputs

- user outcome and current objective;
- verified repository/project state;
- the research question or decision that blocks confident planning;
- known constraints and protected behavior;
- available internal evidence and relevant external sources;
- the cost/risk of a wrong decision.

## Procedure

1. State the decision the research must support; do not research without a decision target.
2. Separate known facts, assumptions, unknowns, and time-sensitive claims.
3. Inspect authoritative project evidence before searching externally.
4. Gather the smallest set of high-quality external evidence needed to resolve the decision; prefer primary/official sources where appropriate.
5. Compare viable options against project constraints, engineering correctness, UX, implementation cost, verification burden, licensing, and reversibility.
6. Record material uncertainty and conflicting evidence rather than smoothing it away.
7. Produce one verdict:
   - `GO` — evidence is sufficient and no material blocker remains;
   - `GO WITH CONDITIONS` — direction is viable if explicit conditions/gates are carried into the execution contract;
   - `NO-GO` — evidence shows the proposed direction should not proceed;
   - `NEEDS MORE EVIDENCE` — an important decision remains under-supported.
8. Translate the verdict into planning inputs: chosen direction, rejected alternatives, conditions, required validation, and stop/escalation triggers.

## Output

Produce a compact research record containing:
- research question / decision;
- verified project facts;
- external evidence and provenance;
- options considered;
- constraints and risks;
- unresolved unknowns;
- recommendation;
- verdict: `GO`, `GO WITH CONDITIONS`, `NO-GO`, or `NEEDS MORE EVIDENCE`;
- implications for scope, acceptance gates, and execution routing.

## Gate rules

- Do not convert weak or stale evidence into a confident `GO`.
- `GO WITH CONDITIONS` conditions must appear in the execution contract and acceptance gates.
- `NO-GO` blocks implementation of the rejected direction until the decision is explicitly revisited with new evidence.
- `NEEDS MORE EVIDENCE` blocks high-risk commitment but may allow bounded experiments whose purpose is to obtain the missing evidence.
- Research findings never override required human approval for protected engineering, safety, security, legal, or similarly high-impact decisions.

## Gotchas

- Research can become scope expansion; stop when the decision is sufficiently supported.
- Popularity is not evidence of project fit.
- A public repository or article is not automatically authoritative or legally reusable.
- Current product/model/API behavior is time-sensitive; date evidence when that matters.
- A prototype proving technical possibility does not prove production suitability.
- Do not bury a negative finding because implementation is already attractive or partially started.

## Stop / escalation

Stop and escalate when:
- authoritative sources materially conflict and the decision is high impact;
- required evidence is inaccessible or cannot be validated;
- licensing/legal interpretation is necessary beyond the available evidence;
- the research reveals a material product/engineering trade-off owned by the human decision maker;
- a bounded experiment or local execution is the cheapest reliable way to resolve the unknown; in that case create a specific evidence-gathering execution packet rather than a full implementation task.
