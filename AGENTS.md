# Agent Guide

## Project Purpose

pr-rosey is a local-first Electron desktop app for monitoring the current GitHub user's open pull
requests. Future steps may inspect CI state and generate useful prompts for external AI coding
agents, but the app must not directly execute coding agents, edit code, commit, push, merge, or use a
hosted backend.

## Current Product Boundaries

- Step 1 app shell and dependency readiness only.
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

Only extract a new component if both are true:

1. It is used in more than one place.
2. It encapsulates behavior, not just styling.

If something is only styled, use a token. If something is only used once, keep it inline. Do not
create wrapper components that only apply CSS.

### When To Add A New Token

If the same Tailwind class string appears more than once for the same element type, add it to
`tokens.ts` instead. Do not create a component for this.

### Never Do These Things

- Do not add new dependencies to add UI components.
- Do not create a token for a one-off style.
- Do not create a component file for something used in one place.
- Do not restyle an existing primitive element in a way that diverges from its token without
  flagging it as a deliberate deviation.

### When In Doubt

Default to the simplest thing. A flat JSX file with token imports is better than a component
hierarchy that does not need to exist yet.

## Testing And Check Expectations

Before reporting a step complete, run `npm run check`. If Electron behavior changed, also launch the
app with `npm run dev` and verify the relevant screen manually.

## Harness

Use `docs/harness.md` as the current product-development harness. Product work should follow:

1. Working code.
2. Iteration and verification.
3. Minimal documentation of what changed and what remains.

Read the current approved step under `docs/steps/` before making product changes. Keep documentation
thin and practical; do not block useful implementation on speculative docs.

## Human In The Loop

This repo is built through approval-gated product increments. Stop after each approved step, report
the acceptance criteria, and wait for explicit human approval before continuing to future steps.

Agents must not continue to future steps without explicit human approval.
