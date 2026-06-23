# AGENTS.md

Guidance for agents working in the CLI package.

## Package Map

- `src/index.tsx` - executable boot file for the `pr-rosey` binary.
- `src/app.tsx` - top-level Ink app composition and command routing.
- `src/commands/parse-command.ts` - argument parsing into typed command objects.
- `src/commands/*-command.tsx` - command orchestration and command-specific Ink state.
- `src/ui/*.tsx` - reusable Ink views.
- `src/github.ts` - wrapper around the `gh` executable and GitHub CLI errors.
- `src/snapshot.ts` - pull request snapshot domain types, normalization, and next-action selection.

## CLI Commands

From the repo root:

- Build the CLI: `npm run build`
- Run the CLI after building: `npm run cli -- snapshot`
- Run a selected PR snapshot: `npm run cli -- snapshot 123`
- Run the full local gate: `npm run check`

From this package:

- Typecheck only: `npm run typecheck`
- Start built CLI: `npm run start -- snapshot`

## Organization Rules

Keep `src/index.tsx` as a thin executable boot file only:

- preserve the shebang;
- collect process arguments;
- render the top-level Ink app;
- wait for exit and set process-level failure handling.

Do not put command parsing, GitHub calls, domain normalization, or substantial UI in `index.tsx`.

When adding a new CLI command, add or update:

- the parser command union and parser tests;
- a command component under `src/commands`;
- usage text in `src/ui/usage-view.tsx`;
- domain or service modules when the command needs external data;
- focused tests for pure parsing, normalization, or decision logic.

## Design Rules

- Keep side effects at the edges. Process I/O, `gh` execution, and Ink lifecycle code should stay
  out of pure domain modules.
- Prefer typed command objects over passing raw argument arrays through the app.
- Keep normalization resilient. External CLI and API output should be parsed through schemas or
  explicit guards before entering domain types.
- Use `readonly` types for exported data structures unless mutation is required.
- Preserve the CLI contract that machine-readable command output goes to stdout and progress or
  errors render through stderr.
- Keep modules small enough that their name describes their responsibility. Split when a file starts
  mixing process boot, parsing, UI, and domain behavior.

## Testing

- Parser changes need parser tests.
- Snapshot normalization or next-action changes need tests in `src/snapshot.test.ts`.
- GitHub CLI wrapper changes should cover error handling where practical; avoid tests that require
  live network or authenticated GitHub state.
- Prefer pure unit tests for logic and keep integration behavior behind explicit commands.
