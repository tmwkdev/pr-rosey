# Pi Managed PR Runner Spike

## Goal

Prove that pr-rosey can start and supervise a Pi coding-agent session inside an isolated managed
worktree for a selected pull request.

## User Value

A user can ask pr-rosey to babysit one PR and see a managed agent session run in the correct local
workspace, with visible output and a reliable stop path.

## Build Scope

- Add a Pi runner readiness check for install/version and basic auth/model availability.
- Add local repository mapping for a PR repository if the app cannot infer a trusted local path.
- Create or update a managed git worktree for one selected PR.
- Start PR watching from the Electron main process and defer Pi work until the watch decision needs
  repository diagnosis.
- Start a Pi `AgentSession` in that worktree from the Electron main process only when a read-only
  diagnosis prompt is needed.
- Send a babysit diagnosis prompt to Pi using the PR URL, branch, CI summary, and worktree path only
  after watcher/API state selects that path.
- Stream Pi AgentSession events into renderer-visible session state.
- Allow the user to abort the running Pi session.
- Persist enough session metadata and logs to inspect what happened after the process exits.

## Out Of Scope

- Native Pi OAuth or API-key entry UI.
- Automatic push, PR comments, review-thread resolution, CI reruns, merge, or branch deletion.
- Background polling after the user-started babysit session exits.
- Remote workspaces.
- Multiple simultaneous babysit sessions.
- Support for non-Pi runners beyond keeping the runner boundary extensible.

## Touched Surfaces

- Main process services for git worktrees, Pi readiness, Pi AgentSession supervision, and log
  storage.
- Shared types for runner readiness, babysit session state, and serializable Pi event summaries.
- Preload IPC for runner readiness, start, abort, and session-state reads.
- Renderer PR UI for a "Babysit" action and a session detail/log surface.
- Docs and tests for the runner/worktree boundary.

## Capability Budget

- `git` commands for repo validation, fetch, worktree create/update, branch status, and dirty-state
  checks.
  Main process owns these commands. User-visible effect is an isolated local PR workspace.
  Verify with unit tests around command construction and a manual local smoke test.
- `gh` commands or existing PR data for PR metadata and CI summary.
  Main process owns GitHub CLI use. User-visible effect is an accurate runner prompt.
  Verify with existing PR discovery tests plus a live smoke check when credentials are available.
- Pi `AgentSession` launched with `cwd` set to the managed worktree.
  Main process owns session lifecycle, event normalization, prompt writes, output capture, and abort.
  Verify with a fake AgentSession in tests and one manual Pi smoke run.
- Local app data storage for session metadata and logs.
  Main process owns writes. Renderer only receives redacted serializable state.
  Verify logs do not include raw credential values.

## Autonomy Impact

This changes product behavior from PR monitoring to user-started managed coding-agent execution.
The approved boundary is: agent execution may run only in an approved managed workspace, with visible
session state, durable logs, and explicit gates for actions that affect GitHub or the remote branch.

No hosted backend, GitHub OAuth, team accounts, automatic merge, or autonomous follow-on work is in
scope for this spike.

## Acceptance Criteria

- The app can report whether Pi is installed and whether Pi appears to have usable auth/model
  configuration without exposing secret values.
- Starting babysit for one PR creates or reuses a managed local worktree rather than running in the
  user's current checkout.
- The main process starts PR watching first, starts Pi in the worktree only when repository
  diagnosis is needed, and records the spawned session id/state when Pi starts.
- The renderer shows session status, important streamed output, tool activity summaries, errors, and
  exit state.
- The user can abort a running Pi process and the app records the aborted state.
- Push, PR comments, review-thread resolution, CI reruns, and merge are not performed by the app.
- Tests cover command construction, unsafe workspace refusal, Pi event parsing, and abort state.

## Validation

```sh
npm run check
```

Also run `npm run dev` and manually verify a local Pi AgentSession smoke path against a test PR or fixture
worktree.

## Handoff Notes

- Keep the first implementation narrow. A fake Pi AgentSession is acceptable for automated tests.
- The current implementation uses the Pi SDK AgentSession boundary rather than a raw subprocess.
- Keep auth detection redacted; renderer state should say where auth was found, not what it is.
- Stop after this spike and wait for explicit approval before adding push/comment/CI automation.

## Approval Checkpoint

Stop after reporting acceptance criteria. Do not continue to adjacent product work without explicit
human approval.
