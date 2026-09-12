# Context Management

## Principle

Context is a working set, not a dumping ground. Keep the active context small enough that the model can reason reliably, but large enough to preserve the decisions, constraints, and evidence that actually matter.

This policy is tool-independent. Product-specific commands, context-window percentages, and compaction mechanics may be useful operationally, but they are not universal workflow requirements.

## 1. Authoritative context hierarchy

Prefer durable, reconstructable project state over conversational accumulation:

1. accepted repository/commit/branch state;
2. `PROJECT_PROFILE.md`, `AGENTS.md`, architecture/decision records, and current Issue/execution contract;
3. current validation evidence and unresolved findings;
4. concise handoff/checkpoint notes;
5. conversation history as working convenience, not the sole source of truth.

If the active conversation conflicts with accepted repository evidence, resolve the conflict explicitly rather than silently following the conversation.

## 2. Load only what is relevant

Use progressive disclosure:
- keep root/project instructions concise and durable;
- load focused workflow policies only when the situation triggers them;
- keep component/domain-specific guidance close to the component when the tool supports scoped or lazy loading;
- prefer references, examples, scripts, or templates beside a skill rather than expanding every `SKILL.md` indefinitely;
- provide an executor only the files/contracts/evidence needed for its bounded task plus the interfaces it must preserve.

Do not preload the entire workflow library, all historical logs, every old plan, or unrelated project documentation merely because it exists.

## 3. Choose continue vs fresh context deliberately

Continue the current context when:
- the objective is unchanged;
- recent reasoning and evidence remain directly useful;
- there are no major abandoned approaches polluting the working set;
- continuity reduces rereading without increasing confusion.

Start a fresh context/session when:
- a genuinely new task begins;
- a major phase or responsibility changes;
- the current context contains many failed attempts, contradictory assumptions, or irrelevant history;
- an independent review requires freedom from executor anchoring;
- a high-stakes step benefits from a controlled handoff rather than lossy accumulated context.

When uncertain, prefer a concise authoritative handoff plus a fresh context for high-risk work.

## 4. Context isolation

Use a separate worker/subagent/context when the main thread needs only the conclusion, not the exploration trail. Good candidates include:
- broad repository search;
- external research with many sources;
- independent review;
- bounded diagnostics;
- repetitive evidence gathering;
- isolated implementation in a worktree.

Isolation is useful only when the returned result contains enough provenance and evidence to be audited. Do not hide important assumptions inside an isolated worker.

## 5. Checkpoints and handoffs

A resumable checkpoint should contain:
- repository and accepted/current branch/commit;
- objective and current stage;
- completed work and material decisions;
- open blockers/unknowns;
- protected behavior and constraints;
- evidence already produced;
- exact next action and success gate;
- model/effort recommendation when execution remains;
- anything intentionally discarded from context.

Use GitHub/project documents for durable checkpoints when the state matters beyond the current chat.

## 6. Recover from context pollution

When a working context has degraded:
1. stop adding more speculative corrections;
2. reconstruct authoritative state from repository/project evidence;
3. identify which decisions/findings remain valid;
4. discard failed or superseded reasoning from the next working set;
5. create a concise handoff;
6. continue in a fresh context when that reduces ambiguity.

Do not keep failed attempts in scope merely because work has already been spent on them.

## 7. Skill progressive disclosure

Focused skills should keep `SKILL.md` concise enough to serve as the trigger/procedure contract. When a skill grows, prefer optional subdirectories such as:

```text
skills/<skill>/
├── SKILL.md
├── references/
├── examples/
├── scripts/
└── templates/
```

Only add these when they reduce repeated reconstruction or improve reliability. Do not create empty scaffolding for ceremony.

## 8. Gotchas as learned context

Every focused skill keeps a `## Gotchas` section as the standard place for recurring, high-signal failure modes discovered through real use. If no reusable Gotcha has been observed yet, say so explicitly rather than inventing filler advice.

Good Gotchas:
- capture a repeated mistake or blind spot;
- change how the agent should behave;
- are specific enough to prevent recurrence;
- are reusable across projects.

Do not fill Gotchas with generic advice or one-off project facts. Project-specific lessons belong in the project profile, postmortem, or local documentation.

## 9. Cost and reliability

Context has cost: reading, reasoning, retries, and correction all increase with unnecessary context. Optimize for the smallest reliable working set, not the smallest possible prompt.

A fresh context that must rediscover everything can be wasteful; a huge stale context that causes reasoning drift can be worse. Choose based on expected cost to verified completion.

## 10. Product-specific mechanisms

Tools may provide compaction, rewind, session resume, scoped rules, lazy-loaded instructions, subagents, or context-forking. Use them when they implement the principles above, but keep those mechanics in product-specific operational guidance rather than treating them as universal workflow law.
