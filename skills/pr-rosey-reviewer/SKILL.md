---
name: pr-rosey-reviewer
description: Independently review a completed pr-rosey implementation chunk before it is reported complete. Use only from a separate reviewer agent, never the agent that implemented the change, to check scope, correctness, architecture boundaries, tests, documentation, and remaining risk.
---

# pr-rosey Reviewer

Use this skill to review a completed implementation chunk from a different agent.

## Independence Rule

The reviewer must be a separate agent from the implementer. The implementing agent can coordinate the review, but cannot satisfy this gate by reviewing its own work.

## Review Inputs

Expect the implementer to provide:

- Approved scope and acceptance criteria.
- Changed files, branch, commit, or diff.
- Checks already run.
- Known limitations or uncertainties.

If those inputs are missing, inspect the repo directly and state the gap in the review.

## Review Stance

Lead with findings. Prioritize:

- Behavior that does not meet the approved scope.
- Architecture boundary violations, especially renderer/main/preload/shared ownership.
- Local-first boundary violations, hosted backend usage, OAuth additions, or direct AI-agent execution.
- Missing error, empty, loading, or manual refresh states when required.
- Security and shell-command risks.
- Broken types, tests, or documentation handoff.

Avoid proposing unrelated refactors or future product work.

## Review Workflow

1. Read `AGENTS.md`, `docs/harness.md`, and any active plan relevant to the change.
2. Inspect the diff against the target branch.
3. Run or verify the relevant checks when feasible. At minimum, confirm whether `npm run check` was run.
4. Compare the implementation to the acceptance criteria and project boundaries.
5. Return findings ordered by severity with file and line references.
6. If there are no findings, say that clearly and list any residual risks or unverified manual behavior.

## Output Format

Use this structure:

- Findings: severity, file/line, issue, and concrete impact.
- Open questions or assumptions.
- Checks reviewed or run.
- Residual risk.

Keep the review concise and actionable.
