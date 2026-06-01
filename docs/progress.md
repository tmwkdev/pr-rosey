# Progress

## Current State

- App shell, dependency readiness, and authored open PR display are the current implemented product
  scope.
- The app checks local `gh`, `gh auth status`, and `git` readiness from the Electron main process.
- The app identifies the authenticated `gh` user, fetches authored open PRs through GitHub GraphQL
  search, includes draft PRs, and displays repository, title, number, URL, draft status, source
  branch, and updated timestamp.
- Results flow to the renderer through the typed preload IPC boundary.
- CI inspection, prompt generation, GitHub OAuth, hosted services, team accounts, and direct
  AI-agent execution remain out of scope.

## Latest Handoff

- Step 2 implemented authored open PR discovery using `gh api user` followed by paginated
  `gh api graphql` search for `is:pr is:open author:<login> sort:updated-desc`.
- Manual PR refresh and PR URL browser handoff are exposed through the typed preload IPC API.
- Discovery currently follows GitHub search behavior and returns up to 1,000 matching PRs because
  the service pages 10 GraphQL search pages of 100 nodes.

## Verification

- `gh api user --jq .login` returned the authenticated GitHub login.
- The GraphQL search command returned a valid search response.
- `npm run check` passed.
- `npm run dev` launched the Electron app without terminal runtime errors.
