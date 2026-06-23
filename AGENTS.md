# AGENTS.md

Repository-level guidance for coding agents. Keep this file focused on navigation and critical
repo-wide commands; package-specific instructions belong in nested `AGENTS.md` files.

## Repo Map

- `apps/cli` - TypeScript Ink CLI package that exposes the `pr-rosey` binary. See
  `apps/cli/AGENTS.md` before changing CLI code.
- `skills` - Codex skill assets. This directory is intentionally excluded from Biome checks.
- `package.json` - npm workspace scripts and root dependency versions.
- `tsconfig.json` and `tsconfig.base.json` - TypeScript project references and shared compiler
  settings.
- `biome.json` and `prettier.config.cjs` - formatting and linting configuration.
- `vitest.config.ts` - test runner configuration.

## Critical Commands

- Install dependencies: `npm install`
- Build everything: `npm run build`
- Run the full local gate: `npm run check`
- Run tests only: `npm test`
- Format code: `npm run format`

Before handing off code changes, run `npm run check` unless the change is documentation-only or
local tooling is unavailable. If the full gate cannot run, state exactly what was skipped and why.

## Repo-Wide Rules

- This is an npm workspace TypeScript monorepo.
- Keep generated output in ignored directories such as `dist` and `coverage`.
- Let Biome and Prettier own formatting.
- Use ESM imports with `.js` extensions for local TypeScript imports.
- Respect existing uncommitted work. Do not revert or overwrite unrelated changes.
