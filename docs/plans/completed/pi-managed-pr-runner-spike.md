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
- Spawn `pi --mode rpc` in that worktree from the Electron main process.
- Send an initial babysit prompt over Pi RPC using the PR URL, branch, CI summary, and worktree path.
- Stream Pi JSONL events into renderer-visible session state.
- Allow the user to abort the running Pi session.
- Persist enough session metadata and logs to inspect what happened after the process exits.

## Out Of Scope

- Native Pi OAuth or API-key entry UI.
- Direct integration with the Pi SDK.
- Automatic push, PR comments, review-thread resolution, CI reruns, merge, or branch deletion.
- Background polling after the first runner process exits.
- Remote workspaces.
- Multiple simultaneous babysit sessions.
- Support for non-Pi runners beyond keeping the runner boundary extensible.

## Touched Surfaces

- Main process services for git worktrees, Pi readiness, Pi RPC process supervision, and log storage.
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
- `pi --mode rpc` subprocess launched with `cwd` set to the managed worktree.
  Main process owns process lifecycle, JSONL parsing, stdin writes, stdout/stderr capture, and abort.
  Verify with a fake RPC process in tests and one manual Pi smoke run.
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
- The main process starts Pi RPC in the worktree and records the spawned session id/state.
- The renderer shows session status, important streamed output, tool activity summaries, errors, and
  exit state.
- The user can abort a running Pi process and the app records the aborted state.
- Push, PR comments, review-thread resolution, CI reruns, and merge are not performed by the app.
- Tests cover command construction, unsafe workspace refusal, Pi RPC event parsing, and abort state.

## Validation

```sh
npm run check
```

Also run `npm run dev` and manually verify a local Pi RPC smoke path against a test PR or fixture
worktree.

## Handoff Notes

- Implemented a narrow subprocess-backed Pi RPC spike with managed worktree creation/reuse, typed
  runner IPC, renderer session state, abort, and durable session metadata/log files.
- Local repository mapping is intentionally minimal for the spike: the renderer asks for an absolute
  trusted repo path and the main process validates it before creating or reusing a managed worktree.
- Existing managed worktrees are refused when dirty or when their origin does not match the selected
  PR repository.
- Verification passed: `npm test -- --run src/main/gitWorktreeService.test.ts`, `npm run check`,
  and `npm run dev` with `http://localhost:5173/` returning HTTP 200 before shutdown.
- Live Pi smoke passed in a disposable git worktree. `pi -p --no-tools --no-session` returned
  `pr-rosey smoke ok`; `pi --mode rpc` accepted `{ "type": "prompt", "message": "..." }`, streamed
  assistant JSONL events, returned `pr-rosey smoke ok`, responded to `get_state` with a session id,
  responded to `abort`, and left the fixture repo clean.
- Smoke testing found the initial app payload used `prompt` instead of Pi's required `message` field.
  The runner now sends `message`, requests `get_state`, records Pi's session id, and summarizes
  `message_update` deltas without dumping raw nested payloads into renderer state.
- Separate-agent review first found the existing-worktree origin safety gap; after the fix and
  regression test, re-review found no findings.
- Remaining risk: live smoke used a disposable fixture worktree, not a real GitHub PR worktree with
  CI context and a long-running fix loop.
- Stop after this spike and wait for explicit approval before adding push/comment/CI automation.

## Approval Checkpoint

Stop after reporting acceptance criteria. Do not continue to adjacent product work without explicit
human approval.
