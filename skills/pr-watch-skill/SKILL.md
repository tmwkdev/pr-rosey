---
name: pr-watch-skill
description: Use when the user asks an agent to babysit a GitHub pull request by repeatedly inspecting local gh state, CI, and submitted human feedback. Do not use for merging, closing, pushing, commenting, resolving review threads, or running coding agents unless the user separately approves those actions.
---

# PR Watch Skill

This skill helps an agent monitor one GitHub pull request until the PR is closed, merged, or user
input is needed. It is local-first: use the authenticated `gh` CLI and local state files only.

## Operating Loop

1. Identify the PR by URL, number, branch, or current branch.
2. Run the TypeScript watcher:

   ```sh
   npm run pr-watch -- <pr-url-or-number> --pretty
   ```

3. Read the JSON report's `decision.action`, `reasons`, `feedback`, `failedChecks`, and
   `pendingChecks`.
4. Follow the selected action:
   - `stop_terminal`: stop; the PR is closed or merged.
   - `watch_wait`: keep watching; no change is needed yet.
   - `surface_failed_job`: show the failed current-SHA job immediately.
   - `diagnose_branch_failure`: inspect the branch failure and prepare a fix plan.
   - `recommend_rerun`: ask before rerunning checks; the script does not mutate GitHub.
   - `report_human_feedback`: surface the feedback to the user before CI retry or code work.
   - `ready_keep_watching`: report readiness, but keep watching while the PR is open.
   - `ask_user`: stop and ask the user for direction.

Passing CI is not a stop condition. Stop only when the PR is closed/merged or when user input is
required.

## Safety Rules

- Do not merge, close, force-push, mark ready/draft, post comments, resolve threads, or rerun checks
  unless the user explicitly approves that exact action.
- Before any future GitHub write, reload the PR state and confirm the head SHA still matches the
  intended action.
- Treat submitted reviews, issue comments, and review comments as human input. Surface them; do not
  answer on GitHub automatically.
- Ignore draft or pending reviews until GitHub reports them as submitted.
- Do not act on stale checks from older commits. The script filters decisions to the current PR head
  SHA.
- Use the lock warning as a stop sign: do not run two watchers for the same PR without clearing the
  stale local lock intentionally.

## References

- Watcher package: `packages/pr-watch/`
- `references/ci-classification.md`
- `references/review-feedback-policy.md`
- `references/github-state-model.md`
- `references/evaluation-scenarios.md`
