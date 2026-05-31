# Product

pr-rosey is a local-first Electron desktop app for monitoring the current GitHub user's open pull
requests.

Future product work may inspect CI state and help prepare useful prompts for external AI coding
agents. The app must not directly execute coding agents, edit code, commit, push, merge, or use a
hosted backend.

## Current Product Surface

- Electron desktop app shell.
- Setup/readiness screen.
- Local dependency checks for `gh`, `gh auth status`, and `git`.
- Manual rerun of dependency checks.

## Not Yet Product Scope

- PR discovery.
- CI inspection.
- Prompt generation.
- GitHub OAuth or hosted auth.
- Hosted backend or team accounts.
- Direct AI-agent execution.
- Automatic code editing, committing, pushing, or merging.
