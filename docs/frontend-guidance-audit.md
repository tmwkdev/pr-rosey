# Frontend Guidance Audit

Approved scope: audit the current renderer against `docs/frontend.md` and write a practical handoff
for a later implementation agent. This is documentation only; do not implement the UI changes in
this work item.

## Summary

The current renderer mostly follows the project boundaries, but several UI shapes now conflict with
the updated frontend guidance:

- Badge-shaped UI is used for inbox counts, dependency metadata/status, PR state, and CI state. The
  guide says badges should be sparse, object-attached, and not used for ordinary metadata, filters,
  or repeated low-density status rows.
- Initial loading states are plain text blocks and disabled button labels. The guide calls for
  skeletons or spinners when UI/data is not ready, and explicit loading/error/data states.
- Some primitive styling is duplicated inline where a token or a more purpose-specific token would
  keep the visual system clearer.
- Component naming makes badge/chip/pill concepts look interchangeable, which weakens the component
  taxonomy in `docs/frontend.md`.

## Files To Touch

- `src/renderer/features/pull-requests/PullRequestsPanel.tsx`
- `src/renderer/features/readiness/ReadinessPanel.tsx`
- `src/styles/tokens.ts`
- Tests only if behavior or accessible text changes in a way that existing tests should cover. There
  are no current renderer tests.

Do not touch main, preload, shared IPC contracts, GitHub query behavior, or PR discovery logic for
this cleanup.

## Findings

### 1. Inbox count chips use badge styling for metadata

`PullRequestsPanel.tsx` renders `InboxFilterChip` with `tokens.badge.base` for the authored and
review-requested counts. These are not filters, are not interactive, and are not attached to a
single object status. They are section-level summary metadata.

Implementation direction:

- Replace `InboxFilterChip` with quieter metadata/count text in the panel header, or rename it to a
  metadata/count helper if extracting still helps scanability.
- Do not use `tokens.badge.base` for these counts.
- Use ordinary muted text and mono count text, or a purpose-specific metadata token only if the exact
  same primitive class string repeats.

### 2. Readiness dependency pills look like tags/badges

`ReadinessPanel.tsx` renders each dependency as a rounded pill with status color. The frontend guide
prefers status dot plus label for repeated readiness rows. The current pill also repeats
`rounded-full border px-2.5 py-1 text-xs`, which overlaps with badge styling without using the badge
token or a clearer status-row token.

Implementation direction:

- Replace `DependencyStatusPill` with a status row/item: small dot, dependency label, and text status.
- Reuse `tokens.statusDot` for the dot.
- Keep the dependency message available via `title` or accessible text if it remains useful.
- Avoid a badge/tag/pill look unless there is a specific compact-object status need.

### 3. PR and CI status badges are overused in table-like rows

`PullRequestStatusBadge` and `PullRequestCiStatusBadge` use `tokens.badge.base` in every PR row. PR
state (`Open`, `Draft`) is a reasonable compact object status, but CI state is repeated operational
status with supporting summary text and often fits better as a status dot plus label in the CI
column.

Implementation direction:

- Keep a true badge only for `Draft` or another short, high-signal object state if it still improves
  scanning.
- Treat `Open` as lower-priority text unless the row really needs the badge.
- Convert CI status to a status dot plus label and keep `formatCiStatusSummary(status)` as muted
  metadata beneath it.
- Preserve non-color meaning: visible text must still say passing/failing/pending/error/etc.

### 4. Loading indicators are plain text only

Initial PR loading currently renders a single text block. Toolbar buttons only switch labels to
`Checking`, `Refreshing`, and `Opening`. Dependency checks render `checking` in every dependency
item. The guide says skeletons or spinners should represent loading progress while data/UI is not
ready.

Implementation direction:

- Add a small local loading treatment in `PullRequestsPanel.tsx`, such as one or two skeleton rows
  matching the PR row grid. Keep it local unless another feature reuses it.
- For toolbar/open actions, keep disabled labels if desired, but add a compact non-disruptive
  loading cue only if it does not shift button dimensions.
- Avoid showing empty states while initial loading is active.

### 5. Token gaps and naming should be tightened

`tokens.badge.base` is currently the easiest way to create any rounded compact element, which
encourages badge/tag/status/count conflation. `tokens.status` holds badge-like color classes, while
`tokens.statusDot` already exists but is unused in renderer status rows.

Implementation direction:

- Keep `tokens.badge.base` narrow and use it only for true badges.
- Consider adding one purpose-specific token only if repeated class strings remain after replacing
  badges, for example `status.item`, `status.label`, or `text.monoMeta`.
- Do not create generic `pill`, `chip`, or broad wrapper tokens.
- Remove unused tokens only if the cleanup makes them clearly obsolete.

## Acceptance Criteria

- Inbox header counts no longer use badge/chip styling and read as metadata, not filters.
- Readiness dependencies render as repeated status-dot-plus-label items, not rounded pills/tags.
- CI status in PR rows no longer uses a badge shape; it uses text plus a non-color cue.
- PR object status uses badges sparingly; `Draft` may remain a badge, but ordinary `Open` should not
  add visual noise unless the implementer documents the deliberate exception in code or doc notes.
- Initial PR loading has a real loading treatment, such as local skeleton rows or a compact spinner
  with accessible text.
- Any repeated primitive class string introduced by the cleanup is either represented by a
  purpose-specific token in `src/styles/tokens.ts` or intentionally left inline because it is
  one-off.
- No UI component library or new dependency is added.
- No Electron main, preload, IPC, or GitHub data behavior changes.

## Non-Goals

- Do not redesign the full app shell.
- Do not add tabs, filters, sorting, new PR fields, polling, prompt generation, or agent handoff.
- Do not add a shared renderer component directory for one-off local UI.
- Do not create renderer tests unless the implementation changes behavior worth testing.
- Do not update GitHub query semantics or dependency readiness semantics.

## Validation

Run:

```bash
npm run check
```

Because this is renderer UI work, also launch the app and manually inspect the relevant screen:

```bash
npm run dev
```

Manual verification should confirm:

- Initial PR loading does not flash an empty state.
- Readiness, PR status, and CI status remain readable without relying on color alone.
- Button text and loading cues do not resize or shift the toolbar/rows.
- The app still fits at narrow desktop widths without overlapping text.
