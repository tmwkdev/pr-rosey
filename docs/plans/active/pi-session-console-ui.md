# Pi Session Console UI

## Goal

Turn the approved HTML mockup at `docs/mockups/pi-session-console.html` into the real renderer
surface for viewing one Pi runner session.

## User Value

A user can keep the pull-request list scannable while opening a durable Pi session console that
shows what the runner is doing, where it is running, important output, errors, exit state, and the
available stop path.

## Build Scope

- Add a selected-session detail pane to the pull-request screen, matching the mockup's split layout.
- Keep PR rows dense: status, last meaningful Pi activity, stop/open-session actions, and no long log
  stream in the row.
- Render Pi output as an activity timeline with normalized event types such as system, user prompt,
  Pi response, tool activity, important output, and error.
- Show session metadata in the detail pane: PR identity, status, pid/session id, worktree/local path,
  started time, last activity, log file path, exit code, and error when present.
- Keep the Stop Pi action available for active sessions from both the row and detail pane.
- Add a disabled steering composer area that communicates the intended next interaction surface
  without sending new prompts yet.
- Preserve the existing compact evidence path enough that a session remains visible when the detail
  pane is not selected.

## Out Of Scope

- Real user steering or follow-up prompts sent to Pi.
- Push, PR comments, review-thread resolution, CI reruns, merge, branch deletion, or any remote
  mutation.
- Native Pi auth UI, model selection UI, or Pi SDK integration.
- Multiple simultaneous active Pi sessions.
- Full managed worktree implementation beyond what the active runner spike separately approves.
- New UI component libraries or broad frontend refactors.

## Touched Surfaces

- Shared Pi runner types for renderer-safe event summaries.
- Main Pi runner service event parsing and session snapshot shaping.
- Preload/shared IPC types only if session snapshots need a new event-summary field.
- Renderer Pi runner hook for selected session state and polling behavior.
- Renderer pull-request screen and a new Pi session console feature component if that keeps ownership
  clearer.
- `src/styles/tokens.ts` only for repeated primitive class strings.
- Tests for event normalization and renderer-safe session snapshot behavior.
- Docs/progress handoff after implementation.

## Capability Budget

- Existing Pi runner session reads and abort IPC.
  Main process owns process lifecycle and log persistence; renderer only reads serializable state and
  requests abort.
  User-visible effect is a richer session display and the same explicit stop path.
  Verify with unit tests, `npm run check`, and manual `npm run dev` inspection.
- Existing local log file paths may be displayed as metadata.
  Main process owns file writes; renderer must not read arbitrary log files directly.
  User-visible effect is auditability without broad filesystem access.
  Verify that the renderer receives only the path string and event summaries.

## Autonomy Impact

This changes only the app display surface for already user-started Pi sessions. It does not add new
AI-agent execution behavior, steering, background scheduling, hosted services, commits, pushes,
merges, PR comments, CI reruns, queue runners, or autonomous follow-on work.

The disabled composer is an affordance only. It must not call Pi or write to process stdin until a
separate approved steering work item exists.

## Acceptance Criteria

- The pull-request screen can select and display a Pi session in a split session console based on the
  approved mockup.
- PR rows stay compact and do not expand into a long chat/log transcript.
- The session console shows session status, PR identity, workspace path, log path, pid/session id,
  started/updated/exit metadata, recent activity timeline, errors, and exit state.
- Timeline entries are grouped into user-comprehensible event kinds rather than raw JSONL lines
  wherever parsing allows.
- Raw/unrecognized stdout and stderr remain visible as output/error summaries without breaking the
  timeline.
- Stop Pi works from the detail pane for active sessions and records the same aborted lifecycle as
  the current implementation.
- The steering composer is visible but disabled and has no IPC behavior.
- No remote mutations or new runner capabilities are added.

## Validation

```sh
npm run check
```

Also run `npm run dev` and manually inspect the pull-request screen with at least one fake or live Pi
session state. Compare the implemented shape against `docs/mockups/pi-session-console.html`.

## Handoff Notes

- The mockup is the visual target, not a pixel-perfect contract.
- Prefer a narrow `PiSessionConsole` feature component over growing
  `PullRequestsPanel.tsx` substantially.
- Normalize display events at the shared/main boundary so the renderer does not need to understand
  raw Pi JSONL.
- Keep the first implementation useful with current repository-verification sessions; the later
  babysit prompt/worktree work can feed the same console.

## Approval Checkpoint

Stop after reporting acceptance criteria. Do not continue to real steering or adjacent runner work
without explicit human approval.
