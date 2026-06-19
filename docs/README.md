# pr-rosey Docs

This directory is the repo-local knowledge base for pr-rosey. Keep it small, current, and useful to
the next agent or human who needs to make a product change.

## Map

- `../AGENTS.md` - root repo policy, monorepo routing, workspace commands, and review expectations
- `../apps/desktop/AGENTS.md` - desktop app architecture, IPC, renderer UI, and app-local checks
- `../packages/pr-watch/AGENTS.md` - PR watch package boundary, CLI, fixtures, and package-local
  checks
- `harness.md` - how agents should work in this repo
- `product.md` - product purpose, boundaries, and current product surface
- `architecture.md` - Electron layer ownership and IPC boundaries
- `agent-runner.md` - managed PR runner direction, Pi integration, auth, worktrees, and delivery
  phases
- `frontend.md` - renderer styling, component, token, badge, and status guidance
- `autonomous-babysit-rubric.md` - binary scorecard for the desktop `Babysit` button's autonomous
  behavior and token discipline
- `babysit-skill-goal.md` - PR babysitting skill success scorecard
- `babysit-skill-adoption-review.md` - human similarity-review checklist for adopting the PR watch
  skill
- `progress.md` - latest handoff state and verification notes
- `plans/` - active and completed work items
- `plan-template.md` - template for approved work items
- `../apps/desktop/` - Electron desktop app workspace
- `../packages/pr-watch/` - private PR watch package used by the PR babysitting skill
- `../skills/` - repo-local implementer, reviewer, and PR watch skills for agent workflow

## Documentation Bias

Working product comes first. Add or update docs after code and verification, or when a durable
boundary decision needs to be preserved.
