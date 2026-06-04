# Managed PR Runner

pr-rosey will grow from PR monitoring into approval-gated PR care. The app owns PR selection,
workspace isolation, GitHub state, user approvals, and audit trails. A coding-agent runner owns the
interactive code work inside a managed workspace.

## Direction

Use Pi as the first managed runner.

- Pi is MIT licensed.
- Pi supports API-key and OAuth provider auth, model selection, JSON event streams, and RPC mode.
- Pi can be steered while running, followed up after a run, aborted, and resumed through sessions.
- Pi can run as a subprocess first, then be integrated through its SDK after the product shape is
  clearer.

Keep the runner boundary agent-agnostic. Codex, Claude, Gemini, OpenCode, local models, and custom
commands should fit behind the same pr-rosey runner/session contract later.

## Ownership Split

pr-rosey owns:

- PR discovery, PR subscriptions, and babysit session state.
- Local repository mapping and managed worktree lifecycle.
- GitHub CLI/API interactions for PR metadata, checks, comments, reviews, and pushes.
- Capability gates for pushing, posting comments, resolving review threads, rerunning CI, and any
  future merge-like action.
- Durable logs, user-visible status, cancellation, recovery, and audit trail.

Pi owns:

- LLM provider auth and model selection for the Pi runner.
- Agent session state, prompt processing, tool execution, compaction, and event streaming.
- Steering, follow-up, abort, and session resume behavior.
- Code edits and local commands inside the worktree process it is launched in.

## Local Workspaces

Agents must not run in the user's arbitrary dirty checkout. The first workspace provider should be a
managed git worktree per PR.

Expected shape:

```ts
type ManagedWorktree = {
  kind: "local-worktree";
  repository: string;
  pullRequestNumber: number;
  sourceRepoRoot: string;
  worktreePath: string;
  headRefName: string;
  headSha: string;
};
```

The worktree provider should validate the local repo, fetch the PR head, create or update the PR
worktree, report dirty state, and refuse to continue when workspace safety is unclear.

## Runner Contract

The first concrete runner can be Pi RPC over stdio. The app should still model it as a runner
provider so future runners can be added without rewriting PR care behavior.

```ts
type AgentRunnerProfile = {
  id: string;
  label: string;
  kind: "pi-rpc" | "custom-command";
  command: string;
  args: string[];
};

type AgentAuthStatus = {
  installed: boolean;
  authenticated: boolean;
  source: "external-cli" | "environment" | "auth-file" | "keychain" | "oauth" | "command" | "unknown";
  label?: string;
};
```

The main process should own spawning, stdout/stdin JSONL handling, cancellation, and log persistence.
Renderer code should only display serializable session state and send user actions over typed IPC.

## Auth Strategy

Start with Pi's existing auth and model registry. Users can authenticate Pi once through the CLI
while pr-rosey reports readiness:

- Pi installed and version available.
- Pi auth file or environment-backed provider detected.
- Selected/default model available.
- Clear next action when auth is missing.

Later, wrap Pi auth in native Electron UI:

- API-key entry backed by OS keychain or Pi-compatible auth storage.
- OAuth launch/callback support for subscription providers.
- Provider logout and model selection.
- No secret values exposed in renderer state or logs.

For remote workspaces, prefer keeping provider auth on the host and routing tool execution remotely
when possible. If the whole agent must run remotely, inject the smallest required credential bundle
for the selected session and avoid copying long-lived auth files by default.

## Babysit Loop

A babysit session watches one PR and steers the active runner as GitHub state changes.

Initial priorities:

1. Start from the current PR summary, CI state, branch, and worktree path.
2. Ask the runner to inspect and fix the next obvious issue.
3. Stream tool calls, edits, and assistant output to the UI.
4. Abort on user request, unsafe workspace state, or changed PR head.
5. Require explicit user approval before push, review-thread resolution, PR comments, or CI reruns.

Later priorities:

- Poll review comments and CI failures.
- Classify review comments as actionable, question, note, unsafe, or ambiguous.
- Classify CI failures as branch-caused, flaky, infrastructure, authentication, or ambiguous.
- Use steering for new review comments and follow-up for summaries after the current run.
- Track retry budgets and escalation reasons.

## Delivery Phases

1. Pi RPC spike in a managed local worktree.
2. Pi readiness and model/auth status in the app.
3. PR row action to start a babysit session.
4. Native session console with Pi event rendering and abort.
5. Steering loop for new PR comments and CI changes.
6. Capability gates for push, comments, review-thread resolution, and CI reruns.
7. Native Pi auth UI.
8. Remote workspace provider abstraction.

