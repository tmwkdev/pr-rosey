# pr-rosey Codex Harness

pr-rosey is built through small, approval-gated product increments. Each step should produce a
working slice, validate it, report acceptance criteria, and then stop.

Future agents should:

- Read `AGENTS.md` first.
- Read the current step file under `.codex/steps/`.
- Implement only the approved step.
- Run the listed validation commands.
- Report acceptance criteria before asking for approval to continue.

Do not create future-step documentation until a human approves that step.
