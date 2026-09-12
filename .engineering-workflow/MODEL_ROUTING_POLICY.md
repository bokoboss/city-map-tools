# Model Routing Policy

Version: 1.3.1

## 1. Objective

Minimize **cost to verified completion**, not merely token count, model price, or number of attempts.

Model capability and reasoning effort are separate routing axes.

The routing goal is not to maximize model capability. It is to use the least expensive route that is still likely to produce a correct, reviewable, accepted result without avoidable retry or remediation cost.

## 2. Control-plane rule

Before invoking a coding agent, ChatGPT or the human lead should complete as much research, repo inspection, decomposition, architecture/UX reasoning, acceptance design, and prompt preparation as practical. This converts ambiguous work into bounded execution packets and increases the share of work that lower-cost models can complete reliably.

## 2A. Work mode first

Apply `WORK_MODE_ROUTING.md` before model selection.

Work mode and model tier are separate axes:
- FAST often fits Luna Medium, or Luna High for a slightly broader but still low-risk bounded change;
- STANDARD often fits Luna High/Max, with Terra when materially more judgment is needed;
- STRICT does not automatically require Astra or another premium model. After ChatGPT has completed high-risk reasoning and bounded the implementation, a lower-cost executor may still be appropriate if the execution itself is mechanical and strongly testable.

Do not use a stronger model as a substitute for scrutiny, evidence, workspace safety, or a clear packet.

## 3. Default routing

Current profile as of 2026-09-05; model availability, product-surface access, capability, and economics can change and should be re-verified periodically.

- **Luna Medium** — small, direct, patterned work with strong tests and low ambiguity.
- **Luna High** — multi-file implementation with clear boundaries and established contracts.
- **Luna Max** — difficult or long execution that is well specified, testable, and bounded; preferred before automatic escalation when increased reasoning within Luna is economically sensible.
- **Terra High/Max** — balanced escalation when a bounded task needs materially more judgment or cross-module synthesis than Luna, but does not justify the most capable end-to-end agent.
- **Astra High** — preferred premium route for difficult end-to-end agentic execution spanning several of the following: code mutation, terminal work, browser/computer use, runtime integration, dependency work, performance investigation, and long multi-step follow-through.
- **Astra XHigh/Max** — reserve for the hardest end-to-end tasks where additional reasoning/verification materially reduces failure risk: ambiguous architecture, major migrations, difficult unknown-root-cause work, conflicting contracts/evidence, high-impact cross-system integration, or premium independent adjudication.
- **Sol High/Max** — valid premium fallback or continuity route when Astra is unavailable or usage-constrained, when preserving an existing productive Sol context materially lowers verified completion cost, or when task-specific evidence favors Sol. Do not retain Sol as the automatic frontier default merely because it was the prior premium route.

Astra is not the default for routine implementation. Its higher capability is most valuable when the task shape actually uses its end-to-end agentic strengths.

Do not assume that a higher model tier with lower effort is automatically more cost-effective than a lower tier with higher effort. Evaluate model tier, effort, context-reuse value, verification burden, and likely retry cost together.

## 3A. Dated economic guardrail

A user-supplied Codex credit schedule dated 2026-09-05 reported these per-1M-token rates:

| Model | Input | Cached input | Output |
| --- | ---: | ---: | ---: |
| GPT-5.6 Luna | 5 credits | 0.5 credits | 30 credits |
| GPT-5.6 Terra | 50 credits | 5 credits | 300 credits |
| GPT-5.6 Sol | 100 credits | 10 credits | 500 credits |
| GPT-6 Astra | 250 credits | 25 credits | 1,250 credits |

Treat this table as a **dated economic snapshot, not timeless pricing**. Re-check the user's current product-surface pricing before making a cost-sensitive routing decision when rates may have changed.

Under this snapshot, relative to Luna:
- Terra is approximately 10x on input, cached input, and output;
- Sol is approximately 20x on input/cached input and 16.7x on output;
- Astra is approximately 50x on input/cached input and 41.7x on output.

Therefore, fewer retries alone do not justify a premium-model escalation. A premium route should be selected only when its expected capability advantage is large enough to change feasibility, materially reduce expensive rework, protect a high-impact decision, or avoid a failure mode that lower-cost routes are unlikely to overcome economically.

Do not reason as if two or three avoided Luna retries automatically justify Astra. With a large price ratio, many lower-cost attempts can still be cheaper in raw credits; the real decision must consider whether those attempts are likely to add useful evidence or merely repeat a capability-limited failure.

## 4. Luna-first principle

For bounded implementation, refactoring with preserved contracts, test creation/repair, UI implementation against a clear UX specification, and debugging with a reliable reproducer, consider Luna first.

The strongest default pattern is often:

`ChatGPT plans -> Luna executes -> tests/CI produce evidence -> ChatGPT reviews`

Use Terra when the bounded work mainly needs more judgment. Use Astra when the work is materially end-to-end/agentic rather than simply difficult.

For high-volume implementation such as routine code edits, test generation, repetitive refactoring, documentation boilerplate, fixture creation, and iterative UI adjustments, prefer Luna or Terra unless there is task-specific evidence that a premium model is necessary.

## 4A. Astra-fit principle

Prefer Astra High over repeated lower-tier retries when several of these are true:

- the task spans code mutation plus terminal/runtime/browser/computer interaction;
- execution is long and multi-step, with important state that must remain coherent across many tool calls;
- success requires integrating several technology stacks or environments;
- the agent must gather evidence, adapt to intermediate results, and continue to a verified end state;
- task-boundary adherence is important because adjacent future scope must remain blocked;
- runtime/performance/packaging/security evidence is part of the implementation itself rather than a separate simple test.

Do not use Astra merely because:
- the work mode is STRICT;
- the repository is large;
- the prompt is long;
- the task is routine but tedious;
- Luna has not yet been given a clear bounded packet;
- Astra is expected to be somewhat better or somewhat faster on the same strongly testable implementation task.

When Astra is selected for a well-bounded complex task, start at **High** unless specific evidence justifies XHigh/Max. Increase effort only when the additional reasoning or verification is expected to reduce total cost to verified completion.

## 4B. Premium-model leverage pattern

When the premium model is valuable for only part of the task, use it surgically rather than assigning the entire execution volume to it.

Preferred pattern:

`ChatGPT control plane -> Astra diagnosis/architecture/orchestration -> bounded Luna/Terra execution -> tests/CI -> ChatGPT review`

Examples of high-leverage premium work:
- resolving contradictory architecture constraints before implementation;
- diagnosing an unknown-root-cause failure after lower-cost evidence gathering has stalled;
- defining a migration sequence where a wrong decision would create broad rework;
- coordinating a long cross-tool integration where state coherence is itself the hard part;
- independently adjudicating a high-impact design or remediation decision.

Examples of work that should normally return to Luna/Terra after the premium reasoning step:
- routine edits across already-identified files;
- bulk test or fixture implementation;
- repetitive API/client/schema updates with a fixed contract;
- ordinary documentation updates;
- straightforward UI implementation from an accepted specification.

This is the default **Astra-as-surgeon** rule: spend premium capability on the narrow part where additional intelligence changes the outcome, then move execution volume back to the least expensive reliable worker.

## 5. Escalation

Escalation is no longer a single linear ladder.

After a lower-tier failure, diagnose the failure class first:

- weak specification -> improve the packet;
- environment/tooling failure -> repair the environment/tooling;
- missing research/dependency evidence -> return to the research gate;
- bounded task needs more judgment -> consider Terra High/Max;
- long cross-tool/end-to-end agentic task exceeds Luna/Terra reliability -> consider Astra High;
- architecture/evidence remains materially contradictory or the hardest end-to-end reasoning is required -> consider Astra XHigh/Max and/or independent review;
- Astra unavailable, quota-constrained, economically unjustified, or task-specific evidence favors prior-model continuity -> consider Sol High/Max or return to a lower-cost bounded route.

Do **not** use:

`Luna failed -> Astra Max`

as an automatic rule.

Escalate only after determining that the problem is a capability/effort mismatch rather than a weak specification, broken environment, undiscovered dependency, integration mistake, or context pollution.

A repeated lower-tier attempt should either test a new hypothesis, use a materially improved packet, or gather new evidence. Do not spend cheap-model credits on blind repetition merely because they are inexpensive.

## 6. Orchestrated execution

Use a premium orchestrator only when in-repository coordination itself is complex enough to justify it.

A useful pattern for large parallelizable work is:

`ChatGPT control plane -> Astra technical orchestrator -> bounded Luna/Terra workers -> Astra integration verification when justified -> CI/evidence -> ChatGPT final review`

If Astra is unavailable or task-specific continuity favors Sol, Sol may serve the same orchestrator/adjudicator role.

The premium orchestrator should coordinate and adjudicate rather than spend premium capacity on routine edits that bounded workers can complete reliably.

Do not automatically bring Astra back for integration verification if deterministic tests, CI, or a lower-cost reviewer already provide sufficient evidence.

## 7. Retry economics

Choose the route expected to minimize total verified cost including:
- initial execution;
- context rereads;
- retries;
- failed CI;
- merge conflict/reconciliation;
- human review;
- remediation;
- downstream rework caused by an incorrect architecture or implementation decision.

A cheaper worker that requires many retries can be more expensive than a stronger worker used once. Conversely, a premium worker on routine, strongly testable work can waste scarce allowance without improving verified completion.

For long work, include the value of context continuity in the routing decision. Preserving useful execution state can be cheaper than switching models and reconstructing the task, but continuity must not override the need for a fresh independent reviewer when independence is required.

Use the following decision order:
1. Can ChatGPT/control-plane work reduce ambiguity enough for Luna?
2. Can higher Luna effort finish reliably without changing model tier?
3. If not, is Terra likely to cross the capability threshold at acceptable total cost?
4. If not, does Astra materially change feasibility or high-impact failure risk?
5. If Astra is justified, can its role be limited to diagnosis, architecture, orchestration, or adjudication while Luna/Terra performs the bulk execution?

## 8. Recommendation format

Whenever recommending Codex/coding-agent execution, state:
- work mode (FAST / STANDARD / STRICT) and rationale;
- workspace write boundary and whether any external write is explicitly approved;
- model;
- reasoning effort;
- existing chat or new chat;
- why this tier is sufficient;
- why a higher tier is not currently required;
- expected cost rationale when recommending Terra, Sol, or Astra over Luna;
- if Astra is selected, what end-to-end/agentic property justifies it and whether its role can be narrowed to a high-leverage phase;
- explicit escalation trigger, including work-mode escalation when scope/risk grows;
- fallback route if the preferred model is unavailable or economically unattractive on the user's current product surface.
