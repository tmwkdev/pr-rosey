# Product

pr-rosey is a local-first Electron desktop app for monitoring the current GitHub user's open pull
requests.

Future product work may execute user-started coding-agent sessions for open PRs, but only inside an
approved managed workspace such as a per-PR git worktree. The app must keep agent execution visible,
logged, cancellable, and capability-gated. It must not use a hosted backend or automatically merge
PRs.

## Current Product Surface

- Electron desktop app shell.
- Setup/readiness screen.
- Local dependency checks for `gh`, `gh auth status`, and `git`.
- Manual rerun of dependency checks.
- Open PR list for the authenticated `gh` user.
- CI status rollup for each visible PR branch.
- Manual refresh of authored open PR discovery.
- Browser handoff for opening a PR URL.

## Not Yet Product Scope

- Background CI polling or notifications.
- Managed coding-agent runner execution.
- Native coding-agent auth UI.
- Prompt generation outside an approved runner work item.
- GitHub OAuth or hosted auth.
- Hosted backend or team accounts.
- Automatic pushing, PR comments, review-thread resolution, CI reruns, or merging without an
  explicit approved capability gate. The current approved exception is the narrow static-analysis
  autofix path, which may commit and push only after local checks pass on the PR head branch.
