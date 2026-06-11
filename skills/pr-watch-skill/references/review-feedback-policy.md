# Review Feedback Policy

Human feedback outranks CI retry work. If new submitted feedback appears, surface it before
recommending a rerun or diagnosing CI.

## Feedback Sources

Watch these sources:

- submitted PR reviews
- issue comments on the pull request
- submitted review comments on changed lines

Ignore draft or pending reviews until they are submitted. Pending review text may change, may be
private to the reviewer, and should not be treated as an instruction.

## Allowed Responses

Allowed without extra approval:

- summarize the new feedback to the user
- identify whether it appears actionable
- ask the user how to proceed when feedback is ambiguous

Not allowed without explicit approval:

- post a GitHub reply
- resolve or unresolve a thread
- dismiss a review
- mark the PR ready for review or convert it to draft
- claim that feedback was addressed

## Non-Actionable Comments

Comments such as "FYI", "thanks", or "LGTM" should be reported but do not require stopping the
watch loop. Do not post acknowledgements automatically.

## Ambiguity

Ask the user when feedback conflicts with CI, asks for product direction, requests a change outside
the approved scope, or is too vague to turn into a concrete next step.

