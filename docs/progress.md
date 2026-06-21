# pr-rosey Progress

Current restart surface only. Historical detail belongs in git history, completed plans, or the
specific doc that still needs it.

## Current State

- Active plan: `docs/plans/active/harness-cleanup.md`.
- Paused plans: Pi managed runner spike and Pi session console UI are parked under
  `docs/plans/paused/` and should not guide current work.
- Next likely plan after harness cleanup: stabilize `skills/pr-watch-skill` and
  `packages/pr-watch` before returning to scripts or UI.

## Known Risk

- The current app contains Pi/UI work from the previous direction. Treat it as existing code, not as
  the next product center, until explicitly resumed.
- The PR watch skill still needs a focused stabilization pass and the human similarity review noted
  in `docs/babysit-skill-adoption-review.md`.

## Last Verified

- Harness cleanup validation: `git diff --check` passed.
- Stale-reference scan found no live `docs/harness.md` dependency outside the active cleanup
  checklist.
- No product code changed during harness cleanup.
