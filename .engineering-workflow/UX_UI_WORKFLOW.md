# UX/UI Workflow for Engineering Software

## 1. Design from work, not screens

Start with: what is the user trying to accomplish, what must they decide, what must they enter, what must they see, and what happens next. Build screens around that workflow rather than around internal modules.

Prefer task-oriented flows such as `Import -> Map -> Validate -> Analyze -> Review -> Export` over page structures that mirror code organization.

## 2. Review order

Evaluate UX in this order:

1. workflow correctness;
2. clarity and state visibility;
3. friction and unnecessary decisions;
4. error prevention and recovery;
5. consistency;
6. accessibility/localization;
7. visual polish.

Do not start with color, spacing, animation, or decoration while the workflow is wrong.

## 3. Engineering-specific principles

- Use results-first hierarchy where it improves decisions: governing status, KPI/LOS/sufficiency, warnings, and readiness should be prominent.
- Make workflow state explicit: Not ready / Ready / Running / Completed / Needs review / Export ready / Blocked, or project-equivalent states.
- Clear or visibly invalidate stale results when material inputs change.
- Automate only what can be derived reliably; provide mapping/override when real-world data is inconsistent.
- Use progressive disclosure for advanced settings without hiding logic that affects engineering results.
- Keep units, formats, assumptions, thresholds, methodology, and traceability near inputs/results.
- Diagrams must match physical reality, traffic convention, orientation, geometry, and the user's mental model.
- Error messages must say what is wrong, why it matters, and what the user can do next.
- Disable or hide actions according to readiness, with a reason when the reason is not obvious.
- Preserve user work across navigation, locale changes, validation errors, and ordinary state transitions.

## 4. Localization

Treat bilingual support as complete localization, not translated menu labels. Check labels, helper text, validation, errors, states, buttons, units, exports, backend messages, and language leakage.

## 5. Validation

Functional correctness does not close UX work. Validate realistic end-to-end workflows using representative inputs and real artifacts where practical: workbooks, videos, engineering cases, exports, browser flows, viewport checks, keyboard behavior, and human UAT.

## 6. Pre-implementation packet

Before frontend execution, define:
- user workflow;
- information architecture;
- screen hierarchy;
- state model;
- critical interactions;
- error/recovery behavior;
- localization/accessibility expectations;
- acceptance scenarios;
- protected engineering behavior that UI changes must not alter.
