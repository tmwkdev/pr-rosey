import { z } from "zod";
import { runGhJson } from "./github.js";

const PR_FIELDS = [
  "number",
  "title",
  "url",
  "state",
  "headRefName",
  "headRefOid",
  "baseRefName",
  "isDraft",
  "mergeable",
  "mergeStateStatus",
  "reviewDecision",
].join(",");

const CHECK_FIELDS = [
  "name",
  "workflow",
  "state",
  "bucket",
  "link",
  "description",
  "startedAt",
  "completedAt",
].join(",");

const REVIEW_FIELDS = ["comments", "reviews", "latestReviews", "reviewDecision"].join(",");

export type PullRequestState = "OPEN" | "CLOSED" | "MERGED" | "UNKNOWN";

export type CheckBucket = "pass" | "fail" | "pending" | "skipping" | "cancel" | "unknown";

export type NextAction =
  | "done"
  | "inspect_review_feedback"
  | "inspect_failed_checks"
  | "wait_for_checks"
  | "resolve_merge_conflict"
  | "ready"
  | "investigate_pr_state";

export interface PullRequestSnapshot {
  readonly generatedAt: string;
  readonly source: SnapshotSource;
  readonly pr: PullRequestSummary;
  readonly checks: CheckSummary;
  readonly reviews: ReviewSummary;
  readonly nextAction: NextActionSummary;
}

export interface SnapshotSource {
  readonly selector: string | null;
}

export interface PullRequestSummary {
  readonly number: number | null;
  readonly title: string | null;
  readonly url: string | null;
  readonly state: PullRequestState;
  readonly headRefName: string | null;
  readonly headRefOid: string | null;
  readonly baseRefName: string | null;
  readonly isDraft: boolean;
  readonly mergeable: string | null;
  readonly mergeStateStatus: string | null;
  readonly reviewDecision: string | null;
}

export interface CheckSummary {
  readonly total: number;
  readonly passing: readonly CheckRunSummary[];
  readonly pending: readonly CheckRunSummary[];
  readonly failing: readonly CheckRunSummary[];
  readonly skipped: readonly CheckRunSummary[];
  readonly cancelled: readonly CheckRunSummary[];
  readonly unknown: readonly CheckRunSummary[];
}

export interface CheckRunSummary {
  readonly name: string | null;
  readonly workflow: string | null;
  readonly state: string | null;
  readonly bucket: CheckBucket;
  readonly link: string | null;
  readonly runId: string | null;
  readonly description: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface ReviewSummary {
  readonly reviewDecision: string | null;
  readonly comments: number;
  readonly reviews: number;
  readonly latestReviews: number;
  readonly hasActionableFeedback: boolean;
}

export interface NextActionSummary {
  readonly kind: NextAction;
  readonly reason: string;
}

const nullableStringSchema = z
  .string()
  .min(1)
  .nullable()
  .catch(() => null);
const nullableNumberSchema = z
  .number()
  .finite()
  .nullable()
  .catch(() => null);

const pullRequestStateSchema = z
  .enum(["OPEN", "CLOSED", "MERGED", "UNKNOWN"])
  .catch(() => "UNKNOWN" as const);
const checkBucketSchema = z
  .enum(["pass", "fail", "pending", "skipping", "cancel", "unknown"])
  .catch(() => "unknown" as const);

const pullRequestSchema = z
  .object({
    number: nullableNumberSchema,
    title: nullableStringSchema,
    url: nullableStringSchema,
    state: pullRequestStateSchema,
    headRefName: nullableStringSchema,
    headRefOid: nullableStringSchema,
    baseRefName: nullableStringSchema,
    isDraft: z.boolean().catch(() => false),
    mergeable: nullableStringSchema,
    mergeStateStatus: nullableStringSchema,
    reviewDecision: nullableStringSchema,
  })
  .catch(
    (): PullRequestSummary => ({
      number: null,
      title: null,
      url: null,
      state: "UNKNOWN",
      headRefName: null,
      headRefOid: null,
      baseRefName: null,
      isDraft: false,
      mergeable: null,
      mergeStateStatus: null,
      reviewDecision: null,
    }),
  );

const checkRunSchema = z
  .object({
    name: nullableStringSchema,
    workflow: nullableStringSchema,
    state: nullableStringSchema,
    bucket: checkBucketSchema,
    link: nullableStringSchema,
    description: nullableStringSchema,
    startedAt: nullableStringSchema,
    completedAt: nullableStringSchema,
  })
  .transform(
    (run): CheckRunSummary => ({
      ...run,
      runId: extractRunId(run.link),
    }),
  );

const checkRunsSchema = z.array(checkRunSchema).catch(() => []);

const reviewsSchema = z
  .object({
    comments: z.array(z.unknown()).catch(() => []),
    reviews: z.array(z.unknown()).catch(() => []),
    latestReviews: z.array(z.unknown()).catch(() => []),
    reviewDecision: nullableStringSchema,
  })
  .catch(() => ({
    comments: [],
    reviews: [],
    latestReviews: [],
    reviewDecision: null,
  }));

export async function createSnapshot(selector: string | null): Promise<PullRequestSnapshot> {
  const selectorArgs = selector === null ? [] : [selector];
  const [rawPr, rawChecks, rawReviews] = await Promise.all([
    runGhJson(["pr", "view", ...selectorArgs, "--json", PR_FIELDS]),
    runGhJson(["pr", "checks", ...selectorArgs, "--json", CHECK_FIELDS], {
      successExitCodes: [8],
    }),
    runGhJson(["pr", "view", ...selectorArgs, "--comments", "--json", REVIEW_FIELDS]),
  ]);

  return normalizeSnapshot({
    generatedAt: new Date().toISOString(),
    selector,
    rawPr,
    rawChecks,
    rawReviews,
  });
}

export function normalizeSnapshot(input: {
  readonly generatedAt: string;
  readonly selector: string | null;
  readonly rawPr: unknown;
  readonly rawChecks: unknown;
  readonly rawReviews: unknown;
}): PullRequestSnapshot {
  const pr = normalizePullRequest(input.rawPr);
  const checks = normalizeChecks(input.rawChecks);
  const reviews = normalizeReviews(input.rawReviews, pr.reviewDecision);

  return {
    generatedAt: input.generatedAt,
    source: {
      selector: input.selector,
    },
    pr,
    checks,
    reviews,
    nextAction: chooseNextAction(pr, checks, reviews),
  };
}

export function chooseNextAction(
  pr: PullRequestSummary,
  checks: CheckSummary,
  reviews: ReviewSummary,
): NextActionSummary {
  if (pr.state === "MERGED" || pr.state === "CLOSED") {
    return {
      kind: "done",
      reason: `Pull request is ${pr.state.toLowerCase()}.`,
    };
  }

  if (reviews.hasActionableFeedback) {
    return {
      kind: "inspect_review_feedback",
      reason: "Latest review state indicates requested changes.",
    };
  }

  if (checks.failing.length > 0) {
    return {
      kind: "inspect_failed_checks",
      reason: `${checks.failing.length} check(s) are failing.`,
    };
  }

  if (checks.pending.length > 0) {
    return {
      kind: "wait_for_checks",
      reason: `${checks.pending.length} check(s) are still pending.`,
    };
  }

  if (isMergeConflict(pr)) {
    return {
      kind: "resolve_merge_conflict",
      reason: "GitHub reports that the pull request is not mergeable.",
    };
  }

  if (checks.unknown.length > 0) {
    return {
      kind: "investigate_pr_state",
      reason: `${checks.unknown.length} check(s) have an unrecognized state.`,
    };
  }

  return {
    kind: "ready",
    reason: "No failing checks, pending checks, or requested changes were found.",
  };
}

function normalizePullRequest(raw: unknown): PullRequestSummary {
  return pullRequestSchema.parse(raw);
}

function normalizeChecks(raw: unknown): CheckSummary {
  const runs = checkRunsSchema.parse(raw);

  return {
    total: runs.length,
    passing: runs.filter((run) => run.bucket === "pass"),
    pending: runs.filter((run) => run.bucket === "pending"),
    failing: runs.filter((run) => run.bucket === "fail"),
    skipped: runs.filter((run) => run.bucket === "skipping"),
    cancelled: runs.filter((run) => run.bucket === "cancel"),
    unknown: runs.filter((run) => run.bucket === "unknown"),
  };
}

function normalizeReviews(raw: unknown, fallbackDecision: string | null): ReviewSummary {
  const value = reviewsSchema.parse(raw);
  const reviewDecision = value.reviewDecision ?? fallbackDecision;
  return {
    reviewDecision,
    comments: value.comments.length,
    reviews: value.reviews.length,
    latestReviews: value.latestReviews.length,
    hasActionableFeedback: reviewDecision === "CHANGES_REQUESTED",
  };
}

function extractRunId(link: string | null): string | null {
  if (link === null) {
    return null;
  }

  const match = /\/actions\/runs\/(\d+)/.exec(link);
  return match?.[1] ?? null;
}

function isMergeConflict(pr: PullRequestSummary): boolean {
  return pr.mergeable === "CONFLICTING" || pr.mergeStateStatus === "DIRTY";
}
