# Engineering Development Workflow

Version: 1.7.4

## 1. Purpose

Provide a reusable control system for software work where correctness, auditability, cost, regression risk, engineering judgment, context quality, and real-world usability matter.

## 2. Roles

### Human owner
Owns product intent, high-impact trade-offs, protected engineering decisions, safety/security approvals, and final acceptance where required.

### ChatGPT / control-plane lead
Do as much non-environment-dependent work as possible before coding execution: research, repository/GitHub inspection, requirements clarification, decomposition, architecture/UX reasoning, scrutiny, acceptance criteria, test planning, prompt preparation, PR/diff/CI review, independent-review routing, and final synthesis.

### Coding agent / executor
Make bounded changes in the real repository/environment, run tests, inspect runtime/browser behavior, produce artifacts, and return evidence.

### Optional coding-agent orchestrator
Used only when execution itself is complex enough to justify an intelligent in-repo coordinator. It should delegate bounded work rather than consume premium capacity on routine bulk implementation.

### Independent reviewer
Provides a meaningfully fresh second pass when risk justifies it. This may be a fresh context at the same model tier, a different model/agent, deterministic independent verification, or a human specialist. The reviewer does not inherit the executor's conclusion as an unquestioned premise.

## 3. Source of truth and context

Use this precedence unless a project explicitly overrides it:

1. Repository state and accepted commit/branch.
2. Project `AGENTS.md`, `PROJECT_PROFILE.md`, PRD/architecture/decision records.
3. Current Issue / execution contract.
4. Verified CI/test/runtime evidence.
5. Concise handoff/checkpoint records.
6. Conversation history and memory as convenience, not authoritative project state.

Apply `WORK_MODE_ROUTING.md` first, then `CONTEXT_MANAGEMENT.md`. Classify the task as FAST, STANDARD, or STRICT before coding-agent execution and load only the workflow/skill material justified by that mode and task. When chat context is long, stale, polluted by failed approaches, or missing, reconstruct from Git/GitHub and project documents rather than guessing.

## 3A. Work mode and workspace safety

Before entering the full workflow, apply `WORK_MODE_ROUTING.md` and state the selected **FAST / STANDARD / STRICT** mode, rationale, evidence that can be reused, and escalation triggers.

All modes inherit `WORKSPACE_SAFETY.md`. The default writable boundary is the explicit target project root only. External/system mutation requires explicit human approval for the exact path/resource/action and is STRICT by definition.

Work mode controls process intensity, not correctness. FAST reduces ceremony; it does not waive the common quality floor, required repository CI, protected-change rules, or actual diff review.

## 4. Focused skills

The core workflow is authoritative. Focused modules under `skills/` add repeatable procedures for recurring situations:

- `skills/research-gate/SKILL.md` — resolve material feasibility/evidence unknowns before committing to a direction;
- `skills/scrutinize/SKILL.md` — challenge plans, designs, assumptions, risk, and readiness;
- `skills/systematic-debug/SKILL.md` — diagnose defects from a reliable reproducer and evidence;
- `skills/independent-review/SKILL.md` — obtain a fresh-context/cross-model/human second pass when acceptance risk justifies it;
- `skills/postmortem/SKILL.md` — preserve lessons after significant resolved defects/incidents;
- `skills/technical-status/SKILL.md` — translate raw execution output into decision-ready status;
- `skills/long-task-guard/SKILL.md` — keep long or multi-step work bounded, observable, and resumable;
- `skills/loop-readiness/SKILL.md` — assess whether a recurring/event-driven loop is safe for A1, A2, or A3 autonomy.

Use the smallest set of skills that materially improves the work. Skills do not replace the Issue/execution contract, validation gates, project profile, or human approval requirements.

Explicit scrutiny is required unless documented as not applicable for material architecture/interface/schema changes, protected engineering or safety/security-sensitive logic, major work packages with material wrong-direction cost, high-risk pre-merge decisions, and important acceptance decisions based on incomplete or contradictory evidence.

Research and independent review are conditional gates: invoke them when the unresolved uncertainty or acceptance risk justifies their cost, not as ceremony for routine work.

## 4A. Continuous operations outer layer

Recurring or event-driven operation is governed by `CONTINUOUS_OPERATIONS.md`. It sits outside this core workflow:

`Observe / Discover -> Triage -> Autonomy Gate -> invoke core workflow when action is justified -> persist operational outcome -> wait / trigger again`

The outer layer may decide that work deserves attention; it cannot bypass research, scrutiny, execution contracts, model routing, verification, independent review, acceptance, security/governance, or human approval.

New loop patterns default to A1 observe/report. Operational state is derived memory/cache/ledger and must be refreshed against authoritative repository/GitHub/project evidence before action. Use `skills/loop-readiness/SKILL.md` and `templates/LOOP_CONTRACT.md` before activation or autonomy increases.

Protected engineering, safety, security, legal/regulatory, destructive, and other human-owned decisions are not generically eligible for unattended acceptance or merge.

## 5. End-to-end loop

### Stage 0 — Route mode, establish state, and working context
- Apply `WORK_MODE_ROUTING.md` and record FAST / STANDARD / STRICT before coding-agent execution.
- Confirm target project root and `WORKSPACE_SAFETY.md` boundary before any mutation.
- Confirm repository, branch, accepted baseline, dirty/local constraints, standard commands, protected behavior, and current objective.
- Inspect before modifying.
- Establish the smallest reliable working context using `CONTEXT_MANAGEMENT.md`.
- Decide whether to continue the current context or create a clean handoff/fresh context before high-risk work.

### Stage 1 — Understand, research when needed, and scrutinize
- Translate the request into user outcome and engineering behavior.
- Identify ambiguity, invariants, risks, affected contracts, likely regressions, and material unknowns.
- If an important feasibility, methodology, dependency, compatibility, licensing, or external-evidence question is unresolved, route to `skills/research-gate/SKILL.md` before committing to implementation direction.
- Route to `skills/scrutinize/SKILL.md` when scrutiny is required or materially useful.
- Do not proceed past a research or scrutiny blocker merely because implementation is possible.

### Stage 2 — Bound the work
For FAST, a compact execution packet is sufficient when FAST eligibility remains satisfied. For STANDARD/STRICT, create an execution contract containing objective, scope, out-of-scope, constraints, protected areas, likely modules, dependencies, relevant research verdict/conditions, success gates, validation, independent-review requirement if any, stop conditions, and definition of done.

Prefer one coherent phase/PR when the work is related and still reviewable. Split only when scope, risk, dependency, ownership, or reviewability justifies it.

For long or multi-step work, apply `skills/long-task-guard/SKILL.md` and use meaningful evidence checkpoints rather than arbitrary phase splitting.

### Stage 3 — Route execution
Use `MODEL_ROUTING_POLICY.md`.

Default principle: **cheapest model that can reliably finish the bounded task**.

Do not use a premium model to compensate for a vague packet that ChatGPT or the human lead could improve first. Distinguish executor routing from reviewer routing; a task may be implemented by one tier and independently reviewed by the same tier in fresh context or another tier when justified.

### Stage 4 — Execute
- Work on an isolated branch/worktree when appropriate.
- Preserve existing contracts unless explicitly authorized.
- Fix root cause before polish or unrelated cleanup.
- Add or update tests with the implementation.
- Stop rather than silently expanding scope when a stop condition is reached.
- For reproducible defects, apply `skills/systematic-debug/SKILL.md` rather than trial-and-error editing.
- For parallel work, use task/feature-specific worker packets with explicit ownership rather than vague generic roles.

### Stage 5 — Verify
Reuse valid revision-bound evidence according to `WORK_MODE_ROUTING.md`; do not rerun broad validation merely because a workflow stage changed. Run or rerun the gates required by the change: targeted tests, regression suites, type/lint/build checks, package/runtime checks, browser/E2E, artifact comparison, numerical/reference equivalence, real-data validation, performance/security checks, or CI.

Prefer deterministic enforcement when a rule can be encoded reliably in tests, schemas, validators, settings, branch protection, hooks, or CI. Do not rely on instruction-only compliance for behavior that can be mechanically checked or blocked.

### Stage 6 — Audit and review
Review the actual diff and evidence against the Issue/contract or compact FAST packet, not merely the executor summary. Check scope containment, behavior, regression risk, documentation, UX, security, protected areas, research conditions, and unresolved assumptions.

Use `skills/technical-status/SKILL.md` when execution evidence is long, fragmented, or mixed so the acceptance decision remains explicit.

Use `skills/independent-review/SKILL.md` when risk justifies a second pass. High-risk acceptance should not depend solely on the executor's own narrative or self-review. Independence may be achieved by a fresh context at the same tier, a different model/agent, independent deterministic verification, or a human specialist.

Run the required scrutiny gate again before high-risk merge/acceptance when the implemented result materially differs from the original reviewed plan or when evidence reveals new risk.

### Stage 7 — Diagnose failures
A failed attempt is not an automatic reason to use a stronger model.

Classify the failure:
- specification failure -> improve the packet;
- research/evidence gap -> return to the research gate;
- environment/tooling failure -> repair environment/tooling;
- scope discovery -> re-plan;
- integration conflict -> reconcile ownership/contracts;
- context pollution/anchoring -> create a clean handoff or fresh context;
- demonstrated capability limitation -> escalate model tier.

For defects or unexplained failures, route through `skills/systematic-debug/SKILL.md` before escalating merely on model strength.

### Stage 8 — Accept, remediate, or block
Accept only when required gates pass, required independent review (if any) is resolved, research conditions are satisfied, and required approvals exist. Otherwise remediate or mark the work blocked with explicit missing evidence.

For a significant resolved defect/incident whose lesson is likely to prevent recurrence or reduce future diagnosis cost, apply `skills/postmortem/SKILL.md` after the fix is validated.

## 6. Completion semantics

Implementation exists != work complete.

A completion claim must identify:
- work mode used and any escalation;
- accepted commit/PR;
- gates executed and outcomes;
- exact CI status when CI is required;
- research conditions that remain relevant;
- independent-review outcome when required;
- evidence for protected or engineering logic;
- known limitations and deferred items;
- human approvals still required.

## 7. Handoff

For a new chat, phase, executor, or independent reviewer, use a compact authoritative handoff: repo, baseline, completed work, material decisions, open issues, protected behavior, validation commands, current objective, relevant research findings, recommended model/effort, and next success gates.

Use the existing context when scope is continuous and recent reasoning remains useful; start a fresh context when a new task begins, context pollution/anchoring would reduce reliability, or independent review requires separation from the executor's reasoning.

For long work, the handoff/checkpoint rules in `skills/long-task-guard/SKILL.md` and the working-set rules in `CONTEXT_MANAGEMENT.md` apply.