# Engineering Development Workflow Reference

This project adopts the shared Engineering Development Workflow.

- Upstream: https://github.com/bokoboss/engineering-development-workflow
- Installed workflow version: 1.4.1
- Local project authority: `PROJECT_PROFILE.md` and project-specific `AGENTS.md`

## Operating rule

Use the upstream repository as the normative workflow source. Keep project-specific facts,
commands, invariants, protected behavior, approvals, and accepted-baseline state in this
repository.

Default control loop:

`Understand -> Bound -> Route -> Execute -> Verify -> Audit -> Accept / Escalate`

For coding-agent work, prepare a bounded execution contract, choose the cheapest model that
can reliably finish the task, prefer Luna for well-specified execution, diagnose failures
before escalation, and require objective evidence before claiming completion. Focused skills
remain upstream; ChatGPT/control-plane work should apply the relevant current skill and pass
its conclusions into the local contract, gates, and coding-agent prompt.

## Local reusable templates

See `docs/development/templates/`. These copies are installer-managed. Do not edit them
directly; customize an instantiated work item instead.
