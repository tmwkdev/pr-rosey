# Babysit Skill Success Scorecard

This scorecard defines whether a repo-owned PR babysitting skill is successful. The goal is to
build a distinct, modifiable TypeScript-based skill with similar operating capability to the
OpenAI `babysit-pr` skill, without copying its implementation, prose, comments, data shapes, or
control flow.

This is an engineering scorecard, not legal advice. It reduces implementation and similarity risk,
but it does not replace a legal review if one is needed.

## Pass Rule

The skill passes when both conditions are true:

1. All critical checks pass.
2. At least 16 of 20 standard checks pass.

If any critical check fails, the skill fails regardless of the standard-check count.

## Critical Checks

| Check | Pass Criteria |
| --- | --- |
| Independent implementation | No copied prose, comments, function names, data shapes, or control flow from OpenAI's skill, scripts, or references, except unavoidable GitHub terminology. |
| TypeScript scripts | The watcher and automation scripts are original TS/Node code, not Python and not a line-by-line port. |
| Local-first boundary | The skill uses local `gh` auth and local state only. It does not require a hosted backend, token service, or team-account assumption. |
| No unsafe GitHub actions | The skill never merges, closes, force-pushes, marks ready/draft, posts human replies, or resolves unrelated threads without explicit approval. |
| Fresh state before writes | Any GitHub write, such as rerunning checks or posting status, first reloads current PR state. |
| Explicit stop conditions | The skill stops only when the PR is closed/merged or when user input is required. Passing CI alone is not a stop condition. |
| Testable decision logic | Core action selection can be tested from fixtures without live GitHub access. |
| License-risk review completed | A human checks implementation similarity before adoption. |

## Standard Checks

| Check | Pass Criteria |
| --- | --- |
| Clear skill trigger | `SKILL.md` frontmatter clearly says when to use the skill and when not to use it. |
| Concise main instructions | `SKILL.md` contains the operating loop and safety rules, while detailed rules live in references. |
| Script CLI is usable | The TS script supports PR URL, PR number, and current-branch inference. |
| Structured script output | The script emits stable structured output that the agent can act on deterministically. |
| PR state captured | Output includes open/closed/merged state, branch, SHA, mergeability, and review state. |
| CI state captured | Output includes pending, passing, and failing checks/workflows for the current SHA. |
| Failed jobs surfaced early | Failed job details are shown as soon as available, even before the full workflow finishes. |
| Retry policy exists | The script or references define when rerunning failed checks is allowed and track retry budget per SHA. |
| Review feedback handled | Submitted reviews, issue comments, and review comments are surfaced as actionable input. |
| Draft/pending reviews ignored | Pending review drafts are not treated as submitted feedback. |
| Human-comment safety | Human comments are surfaced to the user; the skill does not auto-reply unless explicitly approved. |
| CI classification reference exists | A reference explains branch-caused failure vs. flaky/infrastructure failure vs. unknown failure. |
| Review policy reference exists | A reference explains comment, review, thread handling, and allowed responses. |
| State model reference exists | A reference explains stored local state, seen comments, seen reviews, retry counters, and active watch sessions. |
| Evaluation scenarios included | Fixtures cover closed PR, pending CI, failing CI, flaky failure, exhausted retry budget, new review feedback, and green open PR. |
| Tests cover fixtures | Automated tests verify the expected action for each fixture. |
| Concurrent watch protection | The design avoids or warns about multiple watchers managing the same PR. |
| Current-SHA discipline | The skill does not act on stale CI results from an older commit. |
| User-help blockers | The skill asks the user when credentials, permissions, ambiguous human feedback, or exhausted retries block progress. |
| Modification-ready | File names, module boundaries, and references are simple enough for this repo to modify without depending on OpenAI's structure. |

## Expected Artifact Shape

```text
packages/pr-watch/
  src/
    cli.ts
    decision.ts
    githubClient.ts
    lock.ts
    state.ts
    types.ts
    watch.ts
    pr-watch.test.ts
  fixtures/
    closed-pr.json
    pending-ci.json
    failed-branch-ci.json
    failed-flaky-ci.json
    exhausted-retry-budget.json
    new-review-feedback.json
    green-open-pr.json
pr-watch-skill/
  SKILL.md
  scripts/
    pr-watch.ts
  references/
    ci-classification.md
    review-feedback-policy.md
    github-state-model.md
    evaluation-scenarios.md
```

The exact file names may change, but the final package and skill should preserve the same
responsibilities: concise instructions, original TypeScript watcher code, fixture-based tests, and
focused references.

## Required Evaluation Scenarios

Each scenario should have a fixture and an automated test asserting the expected next action.

| Scenario | Expected Result |
| --- | --- |
| Closed or merged PR | Return a terminal stop action. |
| Pending CI with no failed job | Keep watching without recommending edits or retries. |
| Failed job on current SHA | Surface the failed job before the full workflow finishes. |
| Terminal flaky or infrastructure failure with retries left | Recommend rerunning allowed checks, not code edits. |
| Retry budget exhausted | Stop and ask the user for help. |
| Branch-caused lint, type, or test failure | Recommend diagnosis and a branch fix. |
| New submitted review feedback | Surface review feedback before retrying CI. |
| Draft or pending review feedback | Ignore it until submitted. |
| Non-actionable human comment | Report it to the user without posting to GitHub. |
| Green, mergeable, review-clean open PR | Report readiness but keep watching while the PR remains open. |

## Distinctness Review

Before adopting the skill, perform a similarity review against the OpenAI skill.

Pass only if all of these are true:

- The wording in `SKILL.md` and `references/` is original.
- Script architecture, module boundaries, names, and data model are original.
- Tests are written from behavior scenarios, not from copied implementation details.
- Any similarity is explainable by shared GitHub concepts or common CLI behavior.
- The implementation can be maintained without consulting the OpenAI source.
