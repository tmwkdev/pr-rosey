# Agent Guide

## Project Purpose

pr-rosey is a local-first Electron desktop app for monitoring the current GitHub user's open pull
requests. Future product work may inspect CI state and generate useful prompts for external AI coding
agents, but the app must not directly execute coding agents, edit code, commit, push, merge, or use a
hosted backend.

## Current Product Boundaries

- Current product surface is app shell and dependency readiness only.
- No PR discovery yet.
- No GitHub OAuth or hosted auth.
- No team accounts.
- No direct AI-agent execution.
- Local system access belongs in the Electron main process.
- Renderer code owns React UI, visual state, and user interaction.
- Preload exposes a typed IPC boundary.

## Commands

- `npm install` installs dependencies.
- `npm run dev` launches the desktop app locally.
- `npm run format` formats with Biome.
- `npm run lint` checks formatting and lint rules with Biome.
- `npm run check` runs lint, typecheck, and tests.
- `npm test -- --run` runs Vitest once.

## Coding Conventions

- Use TypeScript throughout.
- Keep architecture boring and explicit.
- Keep main-process system access, preload IPC exposure, renderer UI, and shared types separate.
- Prefer small modules with clear ownership over broad abstractions.
- Do not add UI component libraries mid-task.
- Use Vitest only where it adds useful confidence.

## Frontend Consistency Rules

When building UI components, always follow these rules in priority order.

### Tokens First

A file exists at `src/styles/tokens.ts` that defines base class strings for common elements
including inputs, labels, buttons, cards, and form groups. Before writing any Tailwind class on a
primitive HTML element, check if a token covers it. If it does, import and use it. Do not inline
equivalent classes.

### When To Create A Component

Extract a component when it has meaningful local state, is reused, represents a named UI region, or
makes the parent materially easier to scan.

Do not split components just to split them. If something is only styled, use a token. Do not create
wrapper components that only apply CSS.

### When To Add A New Token

If the same Tailwind class string appears more than once for the same element type, add it to
`tokens.ts` instead. Do not create a component for this.

### Never Do These Things

- Do not add new dependencies to add UI components.
- Do not create a token for a one-off style.
- Do not create a component file for something used in one place unless size, state, or behavior
  makes that file boundary clearer.
- Do not restyle an existing primitive element in a way that diverges from its token without
  flagging it as a deliberate deviation.

### When In Doubt

Default to the simplest thing. A flat JSX file with token imports is better than a component
hierarchy that does not need to exist yet.

## Testing And Check Expectations

Before reporting product work complete, run `npm run check`. If Electron behavior changed, also
launch the app with `npm run dev` and verify the relevant screen manually.

## Harness

Use `docs/harness.md` as the current product-development harness. Product work should follow:

1. Working code.
2. Iteration and verification.
3. Independent review by a separate agent.
4. Minimal documentation of what changed and what remains.

Use `docs/README.md` as the documentation map. Read any active work item under `docs/plans/active/`
before making product changes. Keep documentation thin and practical; do not block useful
implementation on speculative docs.

## Agent Skills

Repo-local skills live under `skills/`.

- Implementing agents should use `skills/pr-rosey-implementer/SKILL.md`.
- Review agents should use `skills/pr-rosey-reviewer/SKILL.md`.
- If the agent runtime does not auto-discover repo-local skills, read the relevant `SKILL.md`
  directly before starting.
- The review gate must be performed by a separate agent from the implementer. The implementing agent
  can coordinate the review and fix findings, but must not review its own completed chunk.
- Keep skills concise and Karpathy-style: think before coding, simplicity first, surgical changes,
  and goal-driven verification.

## Human In The Loop

This repo is built through approval-gated product increments. Stop after each approved work item,
report the acceptance criteria, and wait for explicit human approval before continuing to future
product work.

Agents must not continue to future product work without explicit human approval.


<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->
