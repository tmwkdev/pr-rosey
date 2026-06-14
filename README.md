<p align="center">
  <img src="apps/desktop/assets/brand/pr-rosey-logo-lockup.png" alt="pr-rosey" width="900" />
</p>

pr-rosey
========

pr-rosey is a local-first Electron desktop app for monitoring the current GitHub user's open pull
requests and, later, helping prepare prompts when CI fails.

Current status: app shell and dependency readiness only. The app launches, renders the setup/readiness screen, and
checks local dependencies. PR fetching is not implemented yet.

Prerequisites:

- Node.js and npm
- Git
- GitHub CLI (`gh`) authenticated with `gh auth login`

Install dependencies:

```sh
npm install
```

Workspace layout:

- `apps/desktop/` - Electron desktop app
- `packages/pr-watch/` - private PR babysitting helper package

Run the app:

```sh
npm run dev
```

Validate the repo:

```sh
npm run lint
npm run check
```
