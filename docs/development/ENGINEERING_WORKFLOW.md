# Engineering Development Workflow Reference

This project adopts the shared Engineering Development Workflow.

- Upstream: https://github.com/bokoboss/engineering-development-workflow
- Installed workflow version: 1.7.4
- Project-local pinned workflow: `.engineering-workflow/`
- Local project authority: `PROJECT_PROFILE.md` and project-specific `AGENTS.md`

## Operating rule

ChatGPT/control-plane work should read the current upstream workflow. Coding agents executing in
this repository should read the project-local pinned snapshot beginning at
`.engineering-workflow/SKILL.md`.

Before coding-agent execution:
1. route the task with `.engineering-workflow/WORK_MODE_ROUTING.md`;
2. apply `.engineering-workflow/WORKSPACE_SAFETY.md`;
3. load only the additional policies/skills required by the selected mode/task;
4. keep all unapproved writes inside this project root.

FAST / STANDARD / STRICT controls process intensity, not correctness. FAST uses a compact packet
when eligible. STANDARD uses the normal bounded flow. STRICT applies the full evidence-first
workflow for protected/high-impact work.

Do not silently mix incompatible upstream and local policy versions. If the local snapshot is
missing or materially outdated for the current task, install/upgrade/validate it first.

## Local reusable templates

See `.engineering-workflow/templates/`. These are the single installer-managed template set. Do not edit them directly; customize an instantiated work item instead.
