<p align="center">
  <img src="pr-rosey-logo-lockup.png" alt="pr-rosey" width="900" />
</p>

# pr-rosey

TypeScript monorepo for the pr-rosey CLI.

## Workspaces

- `apps/cli` - hello-world CLI package published locally as `pr-rosey`

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
npm run cli -- Rosey
```

After `npm run build`, the generated CLI can also be executed directly:

```bash
./apps/cli/dist/index.js Rosey
```

Expected output:

```text
Hello, Rosey!
```
