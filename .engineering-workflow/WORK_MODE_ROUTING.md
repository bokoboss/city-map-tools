# Work Mode Routing

Version: 1.0.1

## Principle

Choose the **minimum process sufficient to achieve verified, safe completion**.

Work mode controls process intensity, not quality.

Every software task is classified before coding-agent execution as:

- **FAST** — low-risk, localized, reversible, strongly verifiable work;
- **STANDARD** — ordinary feature/bug work with moderate scope or uncertainty;
- **STRICT** — protected, high-impact, security/safety-sensitive, destructive, architectural, or materially ambiguous work.

If the mode is uncertain, choose the safer higher mode until evidence supports a lower one.

Do not downgrade a task merely to save time or model quota.

## 1. Common quality floor

All modes require:

1. identify the target project and writable workspace boundary;
2. inspect the relevant current state before modifying;
3. define bounded scope and protected/out-of-scope behavior;
4. avoid unrelated cleanup/refactoring;
5. use root-cause discipline for defects;
6. run validation appropriate to the changed behavior;
7. review the actual diff/output rather than relying only on executor narrative;
8. preserve required repository CI/merge gates;
9. stop when scope, risk, permissions, or required evidence materially changes;
10. never claim completion while a mandatory gate is FAIL/BLOCKED.

FAST is faster because it omits unnecessary ceremony, not because it accepts weaker work.

## 2. STRICT triggers

Use **STRICT** when any material part of the task includes:

- protected engineering equations, methodology, thresholds, governing rules, or safety-critical behavior;
- authentication, authorization, secrets, privacy, sensitive-data handling, permission boundaries, or security architecture;
- legal/regulatory interpretation or compliance-sensitive behavior;
- destructive/irreversible operations, data migrations, schema migrations, history rewriting, or broad cleanup;
- public API/interface/schema/protocol changes with material compatibility impact;
- material architecture change or broad cross-module refactor;
- high-impact data semantics, financial/engineering calculations, reference datasets, or client-facing correctness obligations;
- production/release-critical change with large blast radius or difficult rollback;
- system/global configuration, credentials, network exposure, services, scheduled tasks, registry, shell/profile, or writes outside project root;
- unknown root cause combined with high blast radius or weak reproducibility;
- evidence that is contradictory, incomplete, or insufficient for a high-impact acceptance decision.

STRICT normally uses the full evidence-first workflow, explicit scrutiny, full execution contract, relevant research gate, stronger validation, and risk-appropriate independent review/human approval.

## 3. FAST eligibility

Use **FAST** only when all material conditions are true:

- objective and expected behavior are clear;
- change is localized and does not materially alter architecture/public contracts/data semantics;
- no protected engineering/safety/security/legal/destructive behavior is involved;
- write scope stays inside the target project;
- change is easy to reverse;
- at least one concrete proof path exists before mutation: a reliable reproducer, an existing test that directly exercises the behavior, or a deterministic before/after check;
- regression surface is narrow and identifiable;
- targeted validation can directly exercise the changed behavior and distinguish success from failure;
- no unresolved external feasibility/dependency/licensing question changes implementation direction.

Typical FAST examples:
- typo/documentation correction;
- small test/fixture repair with unchanged production semantics;
- localized UI spacing/text polish with established behavior;
- bounded config correction inside the project with deterministic validation;
- obvious low-risk bug with a reliable reproducer and targeted regression test.

### Looks FAST but is not

Do **not** classify by line count or apparent simplicity alone. Examples:
- one-line engineering formula/threshold/methodology change -> **STRICT**;
- one-line authentication/authorization/permission/secret-handling change -> **STRICT**;
- small configuration edit that changes network exposure, filesystem/system authority, or credential behavior -> **STRICT**;
- small schema/migration/public protocol change -> **STRICT**;
- dependency/version bump with uncertain compatibility or security impact -> **STANDARD or STRICT** until bounded;
- a bug with no reliable reproducer and unclear root cause -> **STANDARD** by default, or **STRICT** when blast radius is high.

FAST requires a credible answer to: **"How will we prove this exact change is correct?"** If the answer is only visual confidence, executor intuition, or "it should work," use STANDARD.

FAST flow:

`relevant inspect -> compact packet -> bounded change -> targeted validation -> actual diff review -> required CI -> accept/remediate`

FAST does **not** require by default:
- research gate;
- formal scrutiny;
- independent review;
- full repository reconstruction;
- broad/full regression suite;
- a full execution contract.

Any emerging STRICT trigger immediately escalates the task.

## 4. STANDARD mode

Use **STANDARD** when the work is not clearly FAST and no STRICT trigger applies.

Typical STANDARD work:
- ordinary feature implementation;
- multi-file bug fix with known architecture;
- moderate UI/UX change;
- non-protected refactor with clear contracts;
- package/dependency change with bounded compatibility impact;
- integration work with normal regression risk.

STANDARD flow:

`inspect -> scope -> conditional research/scrutiny -> bounded execution -> relevant targeted/regression validation -> PR/CI -> ChatGPT review -> accept/remediate`

Use focused skills only when their trigger materially applies.

## 5. Dynamic escalation

Work mode is a live risk classification.

Escalate:
- FAST -> STANDARD when scope expands, behavior becomes cross-module, validation weakens, or uncertainty grows;
- FAST/STANDARD -> STRICT when any STRICT trigger appears.

When mode escalates:
1. stop mutation at a safe checkpoint;
2. state the new risk/trigger;
3. load the newly required policy/skill set;
4. strengthen gates/contract/reviewer as needed;
5. continue only after the new mode is adequately bounded.

Do not silently continue under the old mode.

## 6. De-escalation

De-escalation is allowed only before material execution when new evidence clearly removes the higher-risk trigger.

Do not de-escalate:
- to save time/quota;
- after a risky mutation has already occurred;
- while evidence remains contradictory;
- when a human/protected approval requirement still applies.

Record the reason when de-escalating STRICT or STANDARD.

## 7. Work mode and model tier are separate

Mode determines **process intensity**.

Model/effort determine **execution capability/cost**.

Examples:
- FAST often maps to Luna Medium;
- STANDARD often maps to Luna High/Max;
- STRICT may still use Luna for a mechanically bounded implementation after ChatGPT has completed the difficult reasoning, while scrutiny/review uses a stronger or fresh reviewer where justified.

Do not route every STRICT task to Sol automatically.

Use `MODEL_ROUTING_POLICY.md` after the work mode is known.

## 8. Evidence reuse

Evidence is revision-bound.

Reuse prior evidence when:
- the relevant code/input/revision has not changed;
- the validation still exercises the material risk;
- no new dependency/environment/policy condition invalidates it;
- provenance is clear enough to audit.

Do not rerun a broad suite or repeat an independent review merely because another workflow stage begins.

Re-run when:
- the relevant revision changed;
- the prior evidence did not cover the changed behavior;
- the environment/toolchain materially changed;
- a failure/contradiction invalidated prior confidence;
- repository pre-merge/CI policy explicitly requires a fresh run.

For FAST, prefer targeted validation plus required CI.
For STANDARD, add relevant regression coverage.
For STRICT, use the full validation matrix justified by risk.

## 9. Required routing output

Before coding-agent execution, ChatGPT/control plane should state:

```text
Work mode: FAST / STANDARD / STRICT
Mode confidence: high / medium / low
Mode rationale:
Quality floor:
Workspace write boundary:
External writes allowed: No, unless explicitly approved
Required workflow/policies/skills:
Evidence that can be reused:
Model:
Reasoning effort:
Existing/new chat:
Scope:
Success gates:
Stop/escalation conditions:
```

If mode confidence is low, do not choose FAST.

## 10. Efficiency rules

- Load only policies/skills triggered by the selected mode and task.
- Do not reconstruct repository history unrelated to the requested change.
- Prefer one focused inspection over broad inventory when scope is already known.
- Prefer a compact FAST packet over a full execution contract when FAST eligibility is satisfied.
- Reuse valid evidence rather than rerunning it mechanically.
- Keep independent review targeted to material risk.
- Stop early on no-op/already-correct findings.

## 11. Safety override

`WORKSPACE_SAFETY.md` applies to every mode.

No work mode can grant permission to write outside the target project root or weaken protected/system boundaries.

A task that genuinely requires external/system mutation is STRICT and requires explicit human approval for the exact external action.
