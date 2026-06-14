# Evaluation Scenarios

Fixtures live in `packages/pr-watch/fixtures/` and are tested by
`packages/pr-watch/src/pr-watch.test.ts`.

| Fixture | Expected Action | Purpose |
| --- | --- | --- |
| `closed-pr.json` | `stop_terminal` | Closed PRs stop the watcher. |
| `pending-ci.json` | `watch_wait` | Pending CI without a failed job waits. |
| `failed-job-early.json` | `surface_failed_job` | A failed current-SHA job is surfaced before all CI finishes. |
| `failed-branch-ci.json` | `diagnose_branch_failure` | Branch-caused lint/type/test failures lead to diagnosis. |
| `failed-flaky-ci.json` | `recommend_rerun` | Flaky failures with budget left recommend a rerun. |
| `exhausted-retry-budget.json` | `ask_user` | Exhausted retry budget blocks automation. |
| `new-review-feedback.json` | `report_human_feedback` | New submitted feedback outranks CI retry work. |
| `draft-pending-review.json` | `ready_keep_watching` | Pending review drafts are ignored until submitted. |
| `non-actionable-comment.json` | `report_human_feedback` | Human comments are shown without posting a reply. |
| `green-open-pr.json` | `ready_keep_watching` | Green open PRs report readiness but continue watching. |

Run the scenario suite with:

```sh
npm test -- --run packages/pr-watch/src/pr-watch.test.ts
```
