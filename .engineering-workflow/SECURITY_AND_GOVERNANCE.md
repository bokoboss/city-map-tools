# Security and Governance

`WORKSPACE_SAFETY.md` is normative for local filesystem/system boundaries and applies to every work mode.

## Protected changes

Projects should explicitly identify changes that require human approval before merge, including as applicable:
- engineering equations, methodology, thresholds, or governing business rules;
- safety-critical behavior;
- authentication/authorization and sensitive-data handling;
- destructive migrations or irreversible actions;
- high-impact defaults;
- legal/regulatory interpretations.

## Secrets and private data

Never commit credentials, tokens, personal secrets, production private data, or temporary debug artifacts containing them. Use environment/secret-management facilities appropriate to the project.

## Licensed and restricted references

Do not commit or redistribute licensed standards, manuals, workbooks, client documents, or copyrighted source material merely because an agent can access them locally. Record provenance and keep controlled references local when required.

## Tool and remote-agent boundary

Grant only the mutation, network, filesystem, and credential capabilities required for the work. Default local write authority is the explicit target project root only; external/system writes require explicit human approval under `WORKSPACE_SAFETY.md`. Remote automation that increases attack surface should be justified by concrete workflow value rather than convenience alone.

## Human approval

Human approval is a design control, not a failure of automation. Preserve it where the cost of an incorrect autonomous decision exceeds the benefit of removing the gate.
