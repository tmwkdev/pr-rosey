import { DEFAULT_RETRY_LIMIT } from "./constants.ts";
import { createEmptyState } from "./state.ts";
import type {
  CiCheck,
  FailureCause,
  PullRequestSnapshot,
  WatchDecision,
  WatchState,
} from "./types.ts";

export function decideNextAction(
  snapshot: PullRequestSnapshot,
  state: WatchState = createEmptyState(),
  retryLimit = DEFAULT_RETRY_LIMIT,
): WatchDecision {
  const currentSha = snapshot.ci.currentSha;
  const failedChecks = snapshot.ci.checks
    .filter((check) => check.headSha === undefined || check.headSha === currentSha)
    .filter(isFailedOrCancelledCheck);
  const pendingChecks = snapshot.ci.checks
    .filter((check) => check.headSha === undefined || check.headSha === currentSha)
    .filter((check) => check.result === "pending");
  const retryUsed = state.retryCountBySha[currentSha] ?? 0;
  const retryRemaining = Math.max(retryLimit - retryUsed, 0);
  const retry = { used: retryUsed, limit: retryLimit, remaining: retryRemaining };

  if (snapshot.pr.lifecycle !== "open") {
    return {
      action: "stop_terminal",
      summary:
        snapshot.pr.lifecycle === "merged"
          ? "The pull request is merged; stop babysitting."
          : "The pull request is closed; stop babysitting.",
      terminal: true,
      needsUser: false,
      currentSha,
      reasons: [`pr_${snapshot.pr.lifecycle}`],
      feedback: [],
      failedChecks,
      pendingChecks,
      retry,
    };
  }

  const freshFeedback = snapshot.feedback.items.filter(
    (item) => !item.pending && !state.seenFeedbackIds.includes(item.id),
  );
  if (freshFeedback.length > 0) {
    const actionable = freshFeedback.filter((item) => item.actionable !== false);
    if (actionable.length > 0) {
      return {
        action: "report_human_feedback",
        summary: "New submitted review or comment feedback is waiting for the user.",
        terminal: false,
        needsUser: true,
        currentSha,
        reasons: ["new_submitted_feedback"],
        feedback: actionable,
        failedChecks,
        pendingChecks,
        retry,
      };
    }

    return {
      action: "report_human_feedback",
      summary: "New non-actionable human comment was observed; do not reply automatically.",
      terminal: false,
      needsUser: false,
      currentSha,
      reasons: ["new_non_actionable_human_comment"],
      feedback: freshFeedback,
      failedChecks,
      pendingChecks,
      retry,
    };
  }

  if (failedChecks.length > 0) {
    const branchFailures = failedChecks.filter((check) => classifyCheckFailure(check) === "branch");
    const rerunnableFailures = failedChecks.filter((check) => {
      const cause = classifyCheckFailure(check);
      return cause === "flaky" || cause === "infrastructure";
    });

    if (branchFailures.length > 0) {
      return {
        action: pendingChecks.length > 0 ? "surface_failed_job" : "diagnose_branch_failure",
        summary:
          pendingChecks.length > 0
            ? "A current-SHA check has already failed while other checks are still pending."
            : "Current-SHA CI failure appears branch-caused; diagnose and fix the branch.",
        terminal: false,
        needsUser: false,
        currentSha,
        reasons:
          pendingChecks.length > 0
            ? ["failed_job_available_before_ci_finished", "branch_failure"]
            : ["branch_failure"],
        feedback: [],
        failedChecks,
        pendingChecks,
        retry,
      };
    }

    if (rerunnableFailures.length === failedChecks.length && retryRemaining > 0) {
      return {
        action: "recommend_rerun",
        summary: "CI appears flaky or infrastructure-caused and retry budget remains.",
        terminal: false,
        needsUser: false,
        currentSha,
        reasons: ["rerun_allowed_by_policy"],
        feedback: [],
        failedChecks,
        pendingChecks,
        retry,
      };
    }

    return {
      action: "ask_user",
      summary:
        retryRemaining === 0
          ? "Retry budget is exhausted for the current SHA; ask the user before continuing."
          : "CI failure cause is unclear; ask the user before changing code or retrying.",
      terminal: false,
      needsUser: true,
      currentSha,
      reasons: retryRemaining === 0 ? ["retry_budget_exhausted"] : ["unknown_failure_cause"],
      feedback: [],
      failedChecks,
      pendingChecks,
      retry,
    };
  }

  if (pendingChecks.length > 0) {
    return {
      action: "watch_wait",
      summary: "CI is still pending for the current SHA; keep watching.",
      terminal: false,
      needsUser: false,
      currentSha,
      reasons: ["pending_ci"],
      feedback: [],
      failedChecks,
      pendingChecks,
      retry,
    };
  }

  if (isReviewClean(snapshot) && isMergeableEnough(snapshot)) {
    return {
      action: "ready_keep_watching",
      summary: "The pull request looks ready, but it is still open; keep watching.",
      terminal: false,
      needsUser: false,
      currentSha,
      reasons: ["green_mergeable_review_clean_open_pr"],
      feedback: [],
      failedChecks,
      pendingChecks,
      retry,
    };
  }

  return {
    action: "watch_wait",
    summary: "No immediate action is selected; keep watching for CI, review, or lifecycle changes.",
    terminal: false,
    needsUser: false,
    currentSha,
    reasons: ["open_pr_no_action"],
    feedback: [],
    failedChecks,
    pendingChecks,
    retry,
  };
}

export function classifyCheckFailure(check: CiCheck): FailureCause {
  if (check.failureCause) {
    return check.failureCause;
  }

  const text = `${check.name} ${check.workflow ?? ""} ${check.summary ?? ""}`.toLowerCase();
  if (/\b(lint|typecheck|type check|tsc|test|unit|vitest|jest|compile|build)\b/.test(text)) {
    return "branch";
  }
  if (/\b(flaky|flake|intermittent|race)\b/.test(text)) {
    return "flaky";
  }
  if (/\b(timeout|timed out|cancelled|canceled|runner|network|rate limit|capacity)\b/.test(text)) {
    return "infrastructure";
  }
  return "unknown";
}

function isFailedOrCancelledCheck(check: CiCheck): boolean {
  return check.result === "fail" || check.result === "cancelled";
}

function isReviewClean(snapshot: PullRequestSnapshot): boolean {
  const decision = snapshot.pr.reviewDecision.toUpperCase();
  if (decision === "CHANGES_REQUESTED") {
    return false;
  }
  return snapshot.feedback.items.every((item) => item.pending || item.actionable === false);
}

function isMergeableEnough(snapshot: PullRequestSnapshot): boolean {
  const mergeable = snapshot.pr.mergeable.toUpperCase();
  const mergeState = snapshot.pr.mergeState.toUpperCase();
  return (
    (mergeable === "MERGEABLE" || mergeable === "UNKNOWN") &&
    !["BLOCKED", "DIRTY", "BEHIND", "UNKNOWN_REVIEWABLE"].includes(mergeState)
  );
}
