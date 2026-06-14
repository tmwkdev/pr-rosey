import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SNAPSHOT_SCHEMA } from "./constants.ts";
import { requiredNumber, requiredString } from "./errors.ts";
import type {
  CheckResult,
  CiCheck,
  FeedbackItem,
  GhIssueComment,
  GhPrCheck,
  GhPrView,
  GhReview,
  GhReviewComment,
  GhRollupCheck,
  PullRequestLifecycle,
  PullRequestSnapshot,
} from "./types.ts";

const execFileAsync = promisify(execFile);

export async function collectFromGitHub(options: {
  selector?: string;
  repository?: string;
}): Promise<PullRequestSnapshot> {
  const selectorArgs = options.selector ? [options.selector] : [];
  const repoArgs = options.repository ? ["--repo", options.repository] : [];
  const fields = [
    "number",
    "url",
    "title",
    "state",
    "closed",
    "mergedAt",
    "headRefName",
    "baseRefName",
    "headRefOid",
    "mergeable",
    "mergeStateStatus",
    "reviewDecision",
    "isDraft",
    "comments",
    "reviews",
    "latestReviews",
    "statusCheckRollup",
  ].join(",");
  const prView = await runGhJson<GhPrView>([
    "pr",
    "view",
    ...selectorArgs,
    ...repoArgs,
    "--comments",
    "--json",
    fields,
  ]);
  const repository = options.repository ?? repositoryFromUrl(requiredString(prView.url, "url"));
  const checks = await collectChecks(selectorArgs, repoArgs, prView.statusCheckRollup ?? []);
  const reviewComments = repository
    ? await collectReviewComments(repository, requiredNumber(prView.number, "number"))
    : [];

  return normalizeSnapshot(prView, checks, reviewComments, repository);
}

export function normalizeSnapshot(
  prView: GhPrView,
  prChecks: GhPrCheck[],
  reviewComments: GhReviewComment[] = [],
  repository?: string,
): PullRequestSnapshot {
  const headSha = requiredString(prView.headRefOid, "headRefOid");
  const statusRollup = prView.statusCheckRollup ?? [];
  const normalizedChecks =
    prChecks.length > 0
      ? prChecks.map((check) => normalizeGhCheck(check, headSha))
      : statusRollup.map((check) => normalizeRollupCheck(check, headSha));

  return {
    schemaVersion: SNAPSHOT_SCHEMA,
    collectedAt: new Date().toISOString(),
    repository,
    pr: {
      number: requiredNumber(prView.number, "number"),
      url: requiredString(prView.url, "url"),
      title: requiredString(prView.title, "title"),
      lifecycle: normalizeLifecycle(prView),
      headBranch: requiredString(prView.headRefName, "headRefName"),
      baseBranch: requiredString(prView.baseRefName, "baseRefName"),
      headSha,
      mergeable: prView.mergeable ?? "UNKNOWN",
      mergeState: prView.mergeStateStatus ?? "UNKNOWN",
      reviewDecision: prView.reviewDecision ?? "",
      isDraft: prView.isDraft ?? false,
    },
    ci: {
      currentSha: headSha,
      checks: normalizedChecks,
    },
    feedback: {
      items: [
        ...(prView.comments ?? []).map(normalizeIssueComment),
        ...(prView.reviews ?? []).map(normalizeReview),
        ...reviewComments.map(normalizeReviewComment),
      ].sort((left, right) => left.submittedAt.localeCompare(right.submittedAt)),
    },
  };
}

async function collectChecks(
  selectorArgs: string[],
  repoArgs: string[],
  fallback: GhRollupCheck[],
): Promise<GhPrCheck[]> {
  try {
    return await runGhJson<GhPrCheck[]>([
      "pr",
      "checks",
      ...selectorArgs,
      ...repoArgs,
      "--json",
      "bucket,completedAt,description,event,link,name,startedAt,state,workflow",
    ]);
  } catch (error) {
    if (fallback.length > 0) {
      return [];
    }
    throw error;
  }
}

async function collectReviewComments(
  repository: string,
  number: number,
): Promise<GhReviewComment[]> {
  try {
    return await runGhJson<GhReviewComment[]>([
      "api",
      `repos/${repository}/pulls/${number}/comments`,
      "--paginate",
    ]);
  } catch {
    return [];
  }
}

async function runGhJson<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync("gh", args, {
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout) as T;
}

function normalizeLifecycle(prView: GhPrView): PullRequestLifecycle {
  if (prView.mergedAt) {
    return "merged";
  }
  if (prView.closed || prView.state === "CLOSED" || prView.state === "MERGED") {
    return "closed";
  }
  return "open";
}

function normalizeGhCheck(check: GhPrCheck, headSha: string): CiCheck {
  return {
    name: check.name ?? "Unnamed check",
    workflow: check.workflow,
    result: normalizeCheckResult(check.bucket ?? check.state),
    url: check.link,
    startedAt: check.startedAt,
    completedAt: check.completedAt,
    headSha,
    summary: check.description,
  };
}

function normalizeRollupCheck(check: GhRollupCheck, headSha: string): CiCheck {
  return {
    name: check.name ?? "Unnamed check",
    workflow: check.workflowName,
    result: normalizeCheckResult(check.conclusion ?? check.status),
    url: check.detailsUrl,
    startedAt: check.startedAt,
    completedAt: check.completedAt,
    headSha,
  };
}

function normalizeCheckResult(value: string | undefined): CheckResult {
  switch ((value ?? "").toLowerCase()) {
    case "pass":
    case "success":
    case "completed_successfully":
      return "pass";
    case "fail":
    case "failure":
    case "failed":
    case "action_required":
      return "fail";
    case "pending":
    case "queued":
    case "in_progress":
    case "waiting":
    case "requested":
      return "pending";
    case "skipping":
    case "skipped":
    case "neutral":
      return "skipped";
    case "cancel":
    case "cancelled":
    case "canceled":
    case "timed_out":
      return "cancelled";
    default:
      return "unknown";
  }
}

function normalizeIssueComment(comment: GhIssueComment): FeedbackItem {
  return {
    id: `issue:${comment.id ?? comment.url ?? comment.createdAt ?? "unknown"}`,
    kind: "issue_comment",
    author: comment.author?.login ?? "unknown",
    body: comment.body ?? "",
    submittedAt: comment.updatedAt ?? comment.createdAt ?? "",
    url: comment.url,
    actionable: inferCommentActionability(comment.body ?? ""),
  };
}

function normalizeReview(review: GhReview): FeedbackItem {
  const state = review.state ?? "UNKNOWN";
  return {
    id: `review:${review.id ?? review.submittedAt ?? state}`,
    kind: "review",
    author: review.author?.login ?? "unknown",
    body: review.body ?? "",
    submittedAt: review.submittedAt ?? "",
    url: review.url,
    state,
    pending: state.toUpperCase() === "PENDING",
    actionable:
      state.toUpperCase() === "CHANGES_REQUESTED" || inferCommentActionability(review.body ?? ""),
  };
}

function normalizeReviewComment(comment: GhReviewComment): FeedbackItem {
  return {
    id: `review-comment:${comment.id ?? comment.html_url ?? comment.updated_at ?? "unknown"}`,
    kind: "review_comment",
    author: comment.user?.login ?? "unknown",
    body: comment.body ?? "",
    submittedAt: comment.updated_at ?? comment.created_at ?? "",
    url: comment.html_url,
    actionable: inferCommentActionability(comment.body ?? ""),
  };
}

function inferCommentActionability(body: string): boolean {
  const text = body.trim().toLowerCase();
  if (text.length === 0) {
    return false;
  }
  if (/\b(fyi|nit:?\s*$|thanks|looks good|lgtm|nice)\b/.test(text)) {
    return false;
  }
  return true;
}

function repositoryFromUrl(url: string): string | undefined {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(url);
  return match?.[1];
}
