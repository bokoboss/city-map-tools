# Continuous Operations

## Principle

Continuous operations are an **outer operational layer** around the Engineering Development Workflow. They discover or observe recurring work, triage whether attention is needed, apply an autonomy gate, invoke the existing core workflow when real development work is justified, persist a compact operational outcome, and wait for the next trigger.

They do **not** replace research, scrutiny, execution contracts, model routing, debugging, verification, independent review, acceptance, security/governance, or required human approval.

When a loop decides real development work is justified, classify that work through `WORK_MODE_ROUTING.md` before execution. `WORKSPACE_SAFETY.md` applies to every loop action and worker; autonomy level never expands the filesystem/system boundary.

The canonical relationship is:

```text
Observe / Discover
      |
      v
    Triage
      |
      v
Autonomy Gate
      |
      +---- no action ----> record / quiet exit
      |
      v
Engineering Development Workflow
Research when needed
-> Scrutinize
-> Bound / Route
-> Execute
-> Verify
-> Independent Review when needed
-> Accept / Remediate / Block
      |
      v
Persist operational outcome
      |
      v
Wait / trigger again
```

## 1. When to use continuous operations

Use this policy when work is recurring, event-driven, monitored over time, or benefits from detecting a future state change without requiring the human to start every cycle.

Examples include:
- watching PR/CI state;
- periodic issue/backlog triage;
- release-readiness observation;
- dependency or maintenance reporting;
- recurring repository-health checks;
- post-merge cleanup discovery.

Do not create a loop for a one-off task merely because automation is possible. A normal Issue/execution contract is simpler and remains preferred when recurrence adds no material value.

## 2. Autonomy levels

Autonomy is explicit and earned. A higher level is not inherently better.

### A0 — Defined / inactive

The loop has a documented purpose, watched scope, trigger/cadence, source of truth, and guardrails but does not run automatically.

Use A0 while designing or reviewing a pattern before activation.

### A1 — Observe / report

The loop may:
- inspect explicitly authorized sources;
- classify findings;
- maintain derived operational memory when necessary;
- produce a digest or notify on actionable state.

The loop must not:
- edit product code;
- start unattended coding remediation;
- merge;
- close work items;
- mutate protected/high-impact state;
- silently widen permissions.

**New loop patterns start at A1 unless an explicit adoption record justifies otherwise.**

### A2 — Assisted bounded action

The loop may perform narrowly scoped, reversible, allowlisted actions, for example:
- prepare an isolated branch/worktree;
- draft a minimal fix;
- run defined validation;
- open/update a PR;
- apply explicitly allowlisted labels/comments.

A2 requires:
- explicit action allowlist and protected denylist;
- independent verification for code mutation;
- finite action attempts and no-progress detection;
- operational budget and model/escalation ceiling;
- observable run history;
- human escalation path;
- pause/kill mechanism;
- human merge/acceptance unless a separately approved rule says otherwise.

### A3 — Bounded unattended operation

A3 is reserved for mature patterns whose signal quality, verifier, action boundaries, budget, rollback/recovery, observability, and escalation behavior have been demonstrated in real A1/A2 operation.

Documentation alone is not enough to justify A3.

Some loops should remain A1 or A2 permanently.

## 3. Engineering autonomy ceiling

Protected engineering methodology, safety-critical logic, security-sensitive behavior, destructive migrations, legal/regulatory interpretation, sensitive-data behavior, and other project-defined high-impact decisions retain mandatory human ownership.

A loop may observe and escalate these areas.

A2 implementation may occur only after an explicit human-authorized work item enters the normal core workflow with its existing gates.

Passing a loop verifier does not authorize autonomous acceptance or merge of protected behavior.

Generic A3 authority must not include protected areas.

## 4. Source of truth and operational state

GitHub/repository/project evidence remains authoritative.

Operational state is **derived memory/cache/ledger**, not a competing source of truth.

Before acting, a loop refreshes material live facts from the authoritative system rather than trusting stale remembered state.

### State is optional

Do not create `STATE.md`, JSON state, a database record, or another state artifact merely because the loop exists.

Prefer the live system directly when it already holds enough truth.

Add durable operational state only when the loop needs cross-run memory that is not reliably represented elsewhere, such as:
- last observed revision/status;
- last action and outcome;
- attempt count;
- failure fingerprint;
- notification fingerprint;
- human override;
- current action owner;
- cooldown/next eligible action;
- next operational step.

### Logical state contract

When state is needed, the storage format is implementation-specific. The logical contract should identify as applicable:

```text
loop_id
last_run
watched_item_id
authoritative_revision
last_observed_status
last_action
last_outcome
attempt_count
failure_fingerprint
notification_fingerprint
human_override
acting_owner
cooldown_until
next_action
```

Never store secrets or restricted data in committed operational state.

### Current state vs run history

Current state answers: **what matters now?**

Run history answers: **what did the loop do, when, and why?**

Keep these responsibilities distinct. Prune resolved operational state; preserve sufficient run history for diagnosis and accountability.

## 5. Budget and circuit breaker

Recurring automation changes economics: low-cost work can become expensive when repeated frequently.

Every action-capable loop must define:
- event trigger or cadence;
- cheap discovery/triage path;
- early-exit condition;
- finite action-attempt limit;
- repeated-failure/no-progress detection;
- worker-spawn limit where relevant;
- allowed model tier and escalation authority;
- period budget in measurable platform-appropriate units;
- maximum automatic actions/PRs per period when relevant;
- who may approve a budget/authority increase;
- pause and kill conditions.

No universal token budget, cadence, retry count, or model tier is mandated by this workflow. The important requirement is that the bounds are **finite, explicit, reviewable, and appropriate to risk**.

If an action-capable loop lacks an explicit attempt/budget policy, it remains A1.

### Circuit-breaker check

Before repeating an action, establish:

1. Is the watched item and authoritative revision still the same?
2. Is the observed failure materially the same?
3. Did the previous attempt produce measurable progress?
4. Is another attempt still within the explicit cap?
5. Is the period budget still available?
6. Is the action still inside the allowlist?
7. Has a human override, pause, or ownership change occurred?

If a required answer is unknown, stop and escalate rather than retrying optimistically.

Model escalation is not a substitute for a circuit breaker. A recurring loop must not automatically climb model tiers merely because retries are available.

## 6. Notification policy

Default: **silence on no-op**.

Notify a human when a new actionable state requires awareness or judgment, for example:
- a human decision/approval is required;
- a new or materially changed failure/blocker appears;
- required checks are absent/unknown and policy matters;
- an item becomes ready for human review/merge/acceptance;
- the attempt cap, budget, or circuit breaker is reached;
- protected/high-impact behavior is implicated;
- the loop itself experiences an operational incident.

A1 overview loops may use periodic digest mode.

Suppress repeated notification of an unchanged finding until a documented aging/escalation threshold is reached.

Notification volume is not a success metric.

## 7. Multi-loop coordination

When more than one recurring loop observes the same project:

- at most one action owner may mutate a branch/PR/item at a time;
- report-only loops must not compete with action loops;
- action loops check for existing ownership before mutation;
- operational state is namespaced by loop/pattern;
- all loops share the same protected-area/human-approval policy;
- aggregate cost/budget must be considered, not only per-loop cost;
- conflicting ownership or priority goes to an explicit human inbox/escalation path;
- code mutation uses branch/worktree isolation where appropriate;
- integration and acceptance still follow the core Engineering Development Workflow.

v1.6 defines these contracts but does not require a distributed locking system.

## 8. Least privilege and mutation boundaries

Grant only the read/write capabilities required by the current autonomy level.

A1 should normally be read-only except for explicitly approved reporting destinations.

A2 write capabilities should be allowlisted and reversible.

Do not grant merge, destructive, credential, production-data, or protected-environment permissions merely for convenience.

Use deterministic permission/configuration boundaries where the platform supports them rather than relying only on prompt text.

## 9. Observability

A recurring loop should make its behavior inspectable without requiring a reader to reconstruct chat history.

Record enough evidence to answer:
- when the run occurred;
- what authoritative revision/state was inspected;
- whether anything actionable was found;
- what action, if any, was taken;
- what verification ran;
- whether a human was notified/escalated;
- whether budget/circuit-breaker controls affected the outcome.

For A2/A3, retain enough run history to investigate wrong action, repeated failure, cost spike, or collision.

## 10. Graduation and rollback

Use `skills/loop-readiness/SKILL.md` before increasing autonomy.

Graduation should be based on observed operating evidence such as:
- signal quality / false positives;
- duplicate-notification rate;
- cost per actionable finding;
- verifier quality;
- retry/no-progress behavior;
- human escalation quality;
- absence and handling of scope violations;
- rollback/recovery performance where applicable.

After an incident, material cost spike, repeated false action, or loss of verifier trust, reduce autonomy or pause the loop. Autonomy can move backward as well as forward.

## 11. Product-specific implementations

Schedulers, automations, GitHub Actions, webhooks, task systems, coding-agent products, state stores, and connector APIs are implementation choices.

Keep product-specific commands and mechanics in local/project operational guidance unless they are broadly reusable and tool-independent.

This shared workflow defines the contract, not a mandatory automation runtime.

## 12. First v1.6 pilot

The first reference pattern is `patterns/pr-ci-watcher.md`.

It is intentionally **A1 report-only**.

It must not mutate code, invoke automatic Codex remediation, merge, or close work items.

Its purpose is to measure whether recurring observation produces reliable actionable signal before any A2 capability is considered.
