# CI Classification

The watcher classifies only current-head checks. A result from an older commit may be displayed for
context by GitHub, but it must not drive retries or code-work recommendations.

## Branch-Caused

Use `diagnose_branch_failure` when the failure points at code or repository state from the PR
branch. Common examples:

- lint, formatting, typecheck, compile, build, or test failures
- deterministic unit or integration test errors
- missing files, changed APIs, or broken generated output

For this class, inspect logs and prepare a branch fix. Do not rerun first unless there is separate
evidence that the job is flaky or infrastructure-caused.

## Flaky Or Infrastructure

Use `recommend_rerun` only when the failed checks are likely unrelated to branch content and the
retry budget remains for the current SHA. Examples:

- runner startup failures
- network, cache, or rate-limit failures
- explicit flaky/intermittent labels in the job name, summary, or logs
- timeout without branch-specific failure evidence

The current script recommends a rerun but does not run one. If a future automation adds reruns, it
must reload PR state immediately before the rerun and refuse if the head SHA changed.

## Unknown

Use `ask_user` when the failure does not clearly fit branch-caused, flaky, or infrastructure-caused
classes. Guessing here risks either wasting retries or editing code for the wrong reason.

## Retry Budget

The default retry budget is two recommended reruns per head SHA. A new commit gets a fresh budget
because it may represent a different branch state. Exhausted budget means stop and ask the user.

