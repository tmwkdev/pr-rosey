---
name: watch-pr
description: Monitor an open GitHub pull request for CI failures, review comments, merge conflicts, and readiness changes. Use when the user asks Codex to watch, babysit, monitor, keep an eye on, fix CI for, or address review feedback on a PR, including requests to keep working autonomously until the PR is merged/closed or user input is required.
---

# Watch PR

## Objective

Monitor one GitHub PR with the GitHub CLI. Fix branch-caused CI failures and actionable review feedback, then push and keep watching until the PR is merged/closed or user judgment is required.

## Quick Start

First identify the PR:

```bash
gh pr view --json number,title,url,state,headRefName,headRefOid,baseRefName,isDraft,mergeable,mergeStateStatus,reviewDecision
```

For a specific PR, add the number, URL, or branch after `gh pr view`, `gh pr checks`, and `gh pr diff`.

Check current status:

```bash
gh pr checks --json name,workflow,state,bucket,link,description,startedAt,completedAt
gh pr view --comments --json comments,reviews,latestReviews,reviewDecision
```

Inspect changed code:

```bash
gh pr diff
gh pr view --json files,commits
```

Inspect failing workflow logs:

```bash
gh run view <run-id> --log-failed
gh run view <run-id> --json conclusion,createdAt,databaseId,event,headBranch,headSha,name,status,url
```

## Operating Loop

1. Snapshot the PR with `gh pr view` and `gh pr checks`.
2. If review feedback exists, inspect it before retrying CI. Review fixes usually start new checks after the next push.
3. If checks failed, open the failed check link or extract the Actions run id from the URL and use `gh run view <run-id> --log-failed`.
4. Classify failures:
   - PR-caused: logs point to code, tests, typing, linting, build output, or docs changed by this branch.
   - External/flaky: runner outage, dependency registry/network failure, rate limit, timeout, or unrelated pre-existing failure.
   - Unknown: logs do not provide enough evidence.
5. For PR-caused failures or actionable review feedback, edit the code, run the narrowest useful local verification, commit, push, then return to step 1.
6. For external/flaky failures, rerun only the failed job/run after confirming it is not branch-caused.
7. For pending checks, wait and poll with `gh pr checks` until there is a new state.
8. Continue until the PR is merged/closed or a stop condition applies.

## GitHub Write Policy

Allowed without further confirmation:

- Push commits to the PR head branch when the fix is clearly required by CI or review feedback.
- Rerun failed workflow jobs when the failure appears flaky or external.

Ask before doing any of these:

- Posting comments or replies on GitHub.
- Resolving review threads involving humans other than the user.
- Closing, reopening, merging, marking draft, or marking ready for review.
- Making speculative infrastructure, dependency, or CI configuration changes.

Useful rerun commands:

```bash
gh run rerun <run-id> --failed
gh run rerun <run-id>
```

## Git Safety

- Check `git status --short` before editing. If unrelated local changes exist, avoid touching them and ask when they block the fix.
- Work on the PR head branch. Do not switch branches unless needed to recover the PR context.
- Avoid destructive commands.
- Use focused commits, for example `codex: fix PR CI failure (#123)` or `codex: address PR review feedback (#123)`.
- Push after each fix, then continue the monitor loop.

## Stop Conditions

Stop only when:

- The PR is merged or closed.
- Permissions, repeated flakes, unclear feedback, merge policy, or risky ambiguity requires user input.
- The user explicitly tells you to stop.

Do not stop merely because checks are pending, feedback is quiet, or the PR is temporarily green while still open.
