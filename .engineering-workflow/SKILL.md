---
name: engineering-development-workflow
description: Research, scrutinize, plan, route, execute, verify, independently review, accept, hand off, and safely operate recurring engineering-software workflows using explicit contracts, lean context, cost-aware model routing, focused skills, and evidence-first GitHub controls.
---

# Engineering Development Workflow Skill

Use this skill for software-development planning, feasibility research, implementation handoff, repo review, UX/UI remediation, debugging, release qualification, technical-status review, long multi-step work, independent verification, or agent orchestration where engineering correctness and auditability matter.

This file is the **router**. The core workflow remains authoritative; focused modules under `skills/` add procedures for recurring situations without creating separate competing workflows.

## Core router

1. Establish the authoritative project state from the repository and `PROJECT_PROFILE.md` if present.
2. Apply `WORK_MODE_ROUTING.md` and state FAST / STANDARD / STRICT before coding-agent execution.
3. Apply `WORKSPACE_SAFETY.md`; default write authority is the target project root only.
4. Apply `ENGINEERING_DEV_WORKFLOW.md`.
5. Apply `CONTEXT_MANAGEMENT.md` to keep the working set relevant and decide when fresh context or isolation is useful.
6. If the work is recurring, event-driven, or monitored over time, apply `CONTINUOUS_OPERATIONS.md` before enabling automation or increasing autonomy.
7. Apply `MODEL_ROUTING_POLICY.md` before recommending a coding model or reasoning effort.
8. Route focused situations through the skill modules below.
9. Apply `UX_UI_WORKFLOW.md` when UX/UI changes are involved.
10. Apply `PARALLEL_EXECUTION.md` when multiple workers are proposed.
11. Define gates using `ACCEPTANCE_AND_EVIDENCE.md` and `templates/ACCEPTANCE_GATE.md`.
12. Use a compact packet for eligible FAST work; use `templates/EXECUTION_CONTRACT.md` for STANDARD/STRICT or when complexity warrants it.
13. Do not claim completion without the required evidence, review, and approvals.

## Focused skill routing

- **Material unknown / feasibility / new dependency / methodology / external evidence needed before planning** -> `skills/research-gate/SKILL.md`.
- **Plan / concept / architecture / risky change / pre-merge challenge** -> `skills/scrutinize/SKILL.md`.
- **Bug / regression / failing CI / runtime or browser defect** -> `skills/systematic-debug/SKILL.md`.
- **Material plan/implementation needs a fresh-context or cross-model second pass** -> `skills/independent-review/SKILL.md`.
- **Significant fixed defect or incident with reusable lessons** -> `skills/postmortem/SKILL.md`.
- **Long agent report / mixed gates / "what is actually done?"** -> `skills/technical-status/SKILL.md`.
- **Long, multi-step, resumable, or multi-worker execution** -> `skills/long-task-guard/SKILL.md`.
- **Recurring/event-driven loop design, activation, or autonomy increase** -> `skills/loop-readiness/SKILL.md`, together with `CONTINUOUS_OPERATIONS.md`.

Multiple modules may apply to one work item. Use the smallest set that materially improves correctness or control. FAST should normally load no focused skill unless a trigger emerges; STANDARD loads only relevant skills; STRICT uses the full set justified by risk.

## Work mode routing

`WORK_MODE_ROUTING.md` is the first lightweight router. FAST is permitted only for clear, localized, reversible, non-protected work with strong targeted verification. STRICT triggers include protected engineering/safety/security/legal behavior, destructive or low-reversibility work, architecture/schema/public-contract changes, system/global changes, and similarly high-impact uncertainty. Otherwise use STANDARD.

If execution reveals a higher-risk trigger, stop at a safe checkpoint and escalate the mode before continuing.

## Workspace safety

`WORKSPACE_SAFETY.md` applies to every mode and worker. Without explicit human approval, do not create/modify/move/delete files outside the target project root, modify another repository, install globally, or change user/system configuration. A need for external/system mutation is a STRICT trigger and must be reported before action.

## Mandatory scrutiny

Apply `skills/scrutinize/SKILL.md` as a required gate unless explicitly documented as not applicable for:
- material architecture/interface/schema changes;
- protected engineering, safety-critical, security-sensitive, or similarly high-impact logic;
- major work packages where a wrong direction has material cost;
- high-risk PRs before merge;
- important acceptance decisions based on incomplete or contradictory evidence.

Do not turn scrutiny into ceremony for trivial edits.

## Independent review

Use `skills/independent-review/SKILL.md` when a materially independent second pass is justified by risk. High-risk acceptance should not rely solely on the executor's own narrative or review.

Independence may be provided by a fresh context using the same model tier, a different model/agent, deterministic recomputation or end-to-end verification, a human specialist, or an appropriate combination. Do not escalate to a premium model merely to satisfy the word "independent"; choose the cheapest reviewer that can reliably challenge the material risk.

## Continuous operations

For recurring or event-driven work, `CONTINUOUS_OPERATIONS.md` defines the outer operational layer. The loop may observe/triage and then invoke this core workflow when real development work is justified; it does not replace the core workflow or its acceptance authority.

New loop patterns start at A1 observe/report unless an explicit readiness record supports otherwise. Use `templates/LOOP_CONTRACT.md` to record source of truth, operational state, action boundaries, budget/circuit breaker, notification, human gates, observability, and pause/kill behavior. Use `skills/loop-readiness/SKILL.md` before activation or autonomy increases.

Operational state is derived memory, not project truth. Protected engineering/safety/security/legal/destructive decisions retain mandatory human ownership regardless of loop autonomy.

## Progressive disclosure

Load only the policies, skills, references, examples, scripts, and evidence needed for the current decision or task. A focused skill may grow through `references/`, `examples/`, `scripts/`, or `templates/` beside its `SKILL.md`; do not inflate the root router or every working context with optional material.

Use `## Gotchas` in focused skills for recurring, high-signal failure modes learned from real use. Keep project-specific one-off lessons in the target project instead.

## Action-oriented execution

When the user's intent is reasonably clear that they want work performed (for example: "do this", "fix this", "help me implement this", "can you update this", "continue", or "make this work"), treat the request as authorization to carry out the work within the currently approved scope.

Do not stop after acknowledging capability, describing a plan without executing it, suggesting a next step that can be completed now, or asking for confirmation that is not actually required. When the required information, tools, and permissions are already available, proceed through **understanding -> execution -> verification -> completion report**.

A task is not complete merely because requested code or files were written. If verification, tests, review, documentation, commit, push, or PR creation are part of the approved execution contract and are available on the current surface, continue through those steps before reporting completion.

This rule is action-oriented, not permission-expanding. Do not infer authorization beyond the approved scope. Stop and ask only when a required decision cannot be resolved from authoritative project evidence; the action would cross the approved workspace boundary; credentials/secrets or an explicitly protected/destructive/external action is required; repository policy requires human approval; or proceeding creates a material risk of doing the wrong work.

Questions that are clearly informational, exploratory, comparative, or about capability alone should be answered rather than converted into mutation requests. If wording is ambiguous, infer intent from the concrete requested outcome and current execution contract instead of mechanically treating every phrase such as "can you" or "help me" as authorization.

## Control-plane rule

ChatGPT or the human lead should execute as much of these skills as can be completed reliably from repository/GitHub/docs/evidence before invoking Codex. Send only the remaining bounded execution work to the coding agent, with relevant research, scrutiny, context, and review conclusions translated into scope, constraints, gates, and stop conditions.

Keep project-specific facts and protected engineering methodology in the target project, not in this shared skill.
