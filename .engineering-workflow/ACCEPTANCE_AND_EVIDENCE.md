# Acceptance and Evidence

## Principle

Agent confidence is not evidence. Completion must be supported by the gates appropriate to the change.

For material risk, the executor should not be the sole substantive verifier of its own work. Use risk-based independent review or independent deterministic verification where it materially improves confidence.

## Gate classes

Possible gates include:
- G1 Functional / targeted tests
- G2 Regression
- G3 Contract / schema / compatibility
- G4 Engineering reference / numerical equivalence
- G5 UX / browser / accessibility / localization
- G6 Package / runtime / artifact
- G7 Performance / reliability
- G8 Security / privacy
- G9 CI
- G10 Human approval / UAT
- G11 Evidence completeness
- G12 Independent review / independent recomputation when risk requires it

Use only gates relevant to the change, but explicitly justify omitted high-risk gates. FAST may use a smaller targeted gate set when `WORK_MODE_ROUTING.md` eligibility is satisfied; STRICT requires the fuller matrix justified by risk.

## Gate record

Each non-trivial gate should identify:
- criterion;
- validation method or command;
- expected result;
- actual result;
- evidence/provenance;
- PASS / FAIL / BLOCKED / NOT APPLICABLE.

When a research gate produced `GO WITH CONDITIONS`, those conditions must appear in the acceptance record until they are resolved or explicitly superseded.

## Acceptance rule

A change is accepted only when all mandatory gates are PASS, required independent review is resolved, required research conditions are satisfied, and mandatory approvals are present. BLOCKED is a valid outcome when required evidence cannot yet be obtained.

For high-risk work, executor self-report alone is not sufficient evidence even when the executor also ran tests. Independence can come from a fresh-context reviewer, a different model/agent, a human specialist, or deterministic verification that genuinely exercises or recomputes the material behavior.

## Evidence reuse

Evidence is revision-bound. Reuse valid prior evidence when the relevant code/input/revision and environment have not materially changed and the evidence still covers the risk. Do not rerun broad suites or reviews solely because another workflow stage started. Re-run when evidence is stale, incomplete, invalidated by a change/failure, or explicitly required by repository pre-merge/CI policy.

Record reused evidence provenance clearly enough to audit.

## Evidence hierarchy

Prefer reproducible evidence over prose summaries:
- test output and CI conclusions;
- deterministic fixtures/reference cases;
- browser/E2E results and screenshots where visual state matters;
- artifact hashes/diffs or export comparisons;
- real-data/UAT results;
- independent recomputation or fresh-context review for material risk;
- explicit engineering source references and decision records;
- exact commit/PR identifiers.

## Deterministic enforcement

Prefer deterministic enforcement over instruction-only compliance when a requirement can be reliably encoded or blocked by the system.

Examples:
- behavior invariant -> regression test or property test;
- schema/contract -> schema validation or compatibility check;
- formatting/static rule -> formatter/linter;
- required repository file/metadata -> repository validator;
- branch/merge requirement -> branch protection or required status check;
- safe permission/tool boundary -> deterministic configuration or sandbox where the platform supports it;
- release condition -> CI/release gate.

Prompts and instructions remain useful for judgment, intent, and behavior that cannot be mechanically enforced. Do not rely on repeated "never do X" wording when the platform can prevent or detect X deterministically.

## Independent review rule

Use `skills/independent-review/SKILL.md` when the acceptance risk justifies a second pass. Review scope should target the material risk rather than repeat every check indiscriminately.

FAST does not require independent review by default; STANDARD/STRICT use it when risk justifies it. A different reviewer is not automatically correct. Independent findings must still be reconciled against repository state, tests, references, and other evidence.
