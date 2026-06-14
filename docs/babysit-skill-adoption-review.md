# Babysit Skill Adoption Review

Use this checklist before adopting `skills/pr-watch-skill/` as the repo's PR babysitting skill.
It is an engineering and provenance review aid, not legal advice.

## Required Human Similarity Review

The scorecard in `docs/babysit-skill-goal.md` requires a human to compare this implementation with
the OpenAI `babysit-pr` skill before adoption.

Human reviewer steps:

1. Open the OpenAI reference skill from the user-provided source.
2. Open this repo's implementation:
   - `skills/pr-watch-skill/SKILL.md`
   - `skills/pr-watch-skill/scripts/pr-watch.ts`
   - `packages/pr-watch/src/*.ts`
   - `packages/pr-watch/src/pr-watch.test.ts`
   - `skills/pr-watch-skill/references/*.md`
   - `packages/pr-watch/fixtures/*.json`
3. Confirm that similarities are limited to ordinary GitHub, CI, pull-request, and CLI concepts.
4. Confirm the local implementation does not copy prose, comments, function names, data shapes,
   module boundaries, fixtures, test structure, or control flow from the reference.
5. Record the result in `docs/progress.md` before considering the scorecard passed.

Pass only if all statements are true:

- `SKILL.md` wording is original.
- Reference-doc wording is original.
- Script architecture and module boundaries are original.
- Type and field names are either repo-specific or ordinary GitHub/CI terminology.
- Fixture content was written from this repo's behavior scenarios, not copied examples.
- Tests assert the local scorecard outcomes rather than copied implementation details.
- The skill can be maintained from the local docs without consulting the OpenAI source.

## Engineering Evidence Already Collected

- `npm test -- --run packages/pr-watch/src/pr-watch.test.ts` passed with 16 tests.
- `npm run check` passed with 42 tests.
- Live dogfood `npm run pr-watch -- 6 --repo tmwkdev/pr-rosey --pretty` successfully inspected PR
  #6 and selected `diagnose_branch_failure` without mutating GitHub.
- Separate engineering review found and confirmed fixes for cancelled/time-out CI handling and
  local state persistence.

## Adoption Decision

Do not mark the babysit scorecard complete until the human similarity review is recorded.
