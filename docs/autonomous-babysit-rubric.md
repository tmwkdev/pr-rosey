# Autonomous Babysit Rubric

This rubric defines what "Babysit" should mean in the desktop app: the button starts an owned,
visible PR monitoring loop that uses cheap GitHub state first, asks Pi only when repository
diagnosis is useful, and escalates only when the app cannot safely continue.

It is inspired by the behavior shape of OpenAI's `babysit-pr` skill, but it is not a source port.
Keep this repo's implementation local-first, TypeScript-based, fixture-testable, and bounded by
pr-rosey's stricter no-mutation product rules.

## Pass Rule

The app-button behavior passes when all critical checks pass and at least 14 of 16 standard checks
pass. Every check is binary: pass means the current implementation has direct evidence in tests,
code, docs, or a manual verification note; fail means the evidence is missing or contradicted.

## Critical Checks

| Check | Pass Criteria |
| --- | --- |
| User-owned session | Clicking `Babysit` starts one visible, cancellable session for the selected PR. |
| Continuous watch | The session keeps polling PR state until a strict stop condition or user-help escalation. |
| Strict stops | The loop stops only for closed/merged PRs, user-required blockers, explicit abort, or bounded test iteration. |
| Green is not terminal | Passing CI on an open PR records readiness and keeps watching. |
| API/watch first | The first babysit action is a watcher/API evaluation, not a generated Pi report. |
| Token discipline | Pi is prompted only when the watch decision needs repository diagnosis that GitHub state cannot answer. |
| No app-driven GitHub writes | The app does not merge, close, push, comment, resolve threads, mark draft/ready, or rerun CI. |
| Explicit escalation | Review feedback, unknown failures, exhausted retry budget, permissions, and write actions surface to the user instead of being silently handled. |

## Standard Checks

| Check | Pass Criteria |
| --- | --- |
| Selected PR context | The session records repository, PR number, URL, local path, log path, start time, status, and activity. |
| Trusted local workspace | Babysit refuses to start unless the PR repository maps to a trusted local clone. |
| Single active session | The app refuses to start a second active babysit session. |
| Current-SHA discipline | Failed and pending checks used for decisions belong to the current PR head SHA or are explicitly SHA-less. |
| Early failed-job surfacing | A failed current-SHA job can be surfaced before the whole workflow finishes. |
| Branch failure diagnosis | Branch-caused CI failures trigger one read-only Pi diagnosis prompt per unchanged action/SHA/check set. |
| Duplicate prompt suppression | Repeated identical watch decisions do not resend the same Pi diagnosis prompt. |
| Pending CI wait | Pending-only CI keeps watching without prompting Pi or escalating. |
| Readiness milestone | Green, mergeable, review-clean PRs record `ready_keep_watching` without stopping. |
| Review feedback priority | Submitted feedback is surfaced before CI retry or diagnosis work. |
| Pending review safety | Draft or pending review feedback is ignored until submitted. |
| Retry budget | Flaky or infrastructure failures recommend user-approved rerun only while per-SHA retry budget remains. |
| Local state | Seen feedback and retry counts persist in local state scoped to the session or watcher. |
| Visible log trail | Watch decisions, prompts, stop states, and aborts are written to visible session state and durable logs. |
| Read-only Pi tools | Pi sessions are limited to read/list/find/grep-style tools and prompts forbid shell, edits, commits, pushes, comments, reruns, and merge. |
| Fixture coverage | Automated fixtures cover terminal PR, pending CI, early failed job, branch failure, flaky failure, exhausted retries, review feedback, pending review, non-actionable comment, and green open PR. |

## Current Score

As of the latest implementation, the intended score is 24/24:

| Area | Result | Evidence |
| --- | --- | --- |
| Critical checks | 8/8 pass | `apps/desktop/src/main/piRunnerService.ts`, `apps/desktop/src/main/piRunnerService.test.ts`, `packages/pr-watch/src/decision.ts` |
| Standard checks | 16/16 pass | `packages/pr-watch/src/pr-watch.test.ts`, PR-watch fixtures, desktop runner tests |

Do not count this current score as final unless the evidence still passes after the change under
review. Re-score whenever babysit behavior, PR-watch decisions, Pi prompting, or runner session
state changes.

## Scoring Workflow

1. Run the focused PR-watch and desktop runner tests.
2. Inspect the app-session code path from button click through watch-loop decisions.
3. Mark each row pass or fail using only current evidence.
4. Any critical failure blocks completion.
5. Standard failures should become follow-up tasks unless they also violate a critical check.

Minimum evidence for a completed scoring pass:

```sh
npm run test --workspace @pr-rosey/pr-watch -- --run
npm run test --workspace @pr-rosey/desktop -- --run src/main/piRunnerService.test.ts
```

Run `npm run check` before reporting product work complete.
