<p align="center">
  <img src="pr-rosey-logo-lockup.png" alt="pr-rosey" width="900" />
</p>

# pr-rosey

TypeScript monorepo for the pr-rosey CLI.

## Workspaces

- `apps/cli` - CLI package published locally as `pr-rosey`

## Tooling

- npm workspaces
- `tsgo` via `@typescript/native-preview` 7.x
- Biome for linting and fast formatting
- Prettier for Markdown and general formatting compatibility
- Vitest for tests

## Commands

```bash
npm install
npm run build
npm run check
npm run cli -- snapshot
```

After `npm run build`, the generated CLI can also be executed directly:

```bash
./apps/cli/dist/index.js snapshot
```

To snapshot a specific pull request, pass a PR number, branch, or URL:

```bash
npm run cli -- snapshot 123
```

Expected output is normalized JSON with PR metadata, check buckets, review counts, and a recommended
next read-only action:

```json
{
  "pr": {
    "number": 123,
    "state": "OPEN"
  },
  "checks": {
    "total": 1,
    "failing": []
  },
  "nextAction": {
    "kind": "ready"
  }
}
```
