import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REPORT_SCHEMA = "pr-watch-report/v1";
const SNAPSHOT_SCHEMA = "pr-watch-snapshot/v1";
const STATE_SCHEMA = "pr-watch-local-state/v1";
const DEFAULT_RETRY_LIMIT = 2;
const DEFAULT_STATE_FILE = ".pr-rosey/pr-watch-state.json";

export type PullRequestLifecycle = "open" | "closed" | "merged";

export type CheckResult = "pass" | "fail" | "pending" | "skipped" | "cancelled" | "unknown";

export type FailureCause = "branch" | "flaky" | "infrastructure" | "unknown";

export type FeedbackKind = "issue_comment" | "review" | "review_comment";

export type FeedbackItem = {
  id: string;
  kind: FeedbackKind;
  author: string;
  body: string;
  submittedAt: string;
  url?: string;
  state?: string;
  pending?: boolean;
  actionable?: boolean;
};

export type CiCheck = {
  name: string;
  result: CheckResult;
  workflow?: string;
  url?: string;
  startedAt?: string;
  completedAt?: string;
  headSha?: string;
  failureCause?: FailureCause;
  summary?: string;
};

export type PullRequestSnapshot = {
  schemaVersion: typeof SNAPSHOT_SCHEMA;
  collectedAt: string;
  repository?: string;
  pr: {
    number: number;
    url: string;
    title: string;
    lifecycle: PullRequestLifecycle;
    headBranch: string;
    baseBranch: string;
    headSha: string;
    mergeable: string;
    mergeState: string;
    reviewDecision: string;
    isDraft?: boolean;
  };
  ci: {
    currentSha: string;
    checks: CiCheck[];
  };
  feedback: {
    items: FeedbackItem[];
  };
};

export type WatchState = {
  schemaVersion: typeof STATE_SCHEMA;
  seenFeedbackIds: string[];
  retryCountBySha: Record<string, number>;
  activeWatches: Record<string, { pid: number; startedAt: string; updatedAt: string }>;
};

export type WatchAction =
  | "stop_terminal"
  | "watch_wait"
  | "surface_failed_job"
  | "recommend_rerun"
  | "diagnose_branch_failure"
  | "ask_user"
  | "report_human_feedback"
  | "ready_keep_watching";

export type WatchDecision = {
  action: WatchAction;
  summary: string;
  terminal: boolean;
  needsUser: boolean;
  currentSha: string;
  reasons: string[];
  feedback: FeedbackItem[];
  failedChecks: CiCheck[];
  pendingChecks: CiCheck[];
  retry: {
    used: number;
    limit: number;
    remaining: number;
  };
};

export type WatchReport = {
  schemaVersion: typeof REPORT_SCHEMA;
  generatedAt: string;
  target: {
    selector: string;
    repository?: string;
    stateFile: string;
  };
  snapshot: PullRequestSnapshot;
  decision: WatchDecision;
};

export type CliOptions = {
  selector?: string;
  repository?: string;
  fixturePath?: string;
  stateFile: string;
  pretty: boolean;
  noLock: boolean;
  retryLimit: number;
  pollSeconds?: number;
  maxIterations: number;
};

type GhPrView = {
  number?: number;
  url?: string;
  title?: string;
  state?: string;
  closed?: boolean;
  mergedAt?: string | null;
  headRefName?: string;
  baseRefName?: string;
  headRefOid?: string;
  mergeable?: string;
  mergeStateStatus?: string;
  reviewDecision?: string;
  isDraft?: boolean;
  comments?: GhIssueComment[];
  reviews?: GhReview[];
  latestReviews?: GhReview[];
  statusCheckRollup?: GhRollupCheck[];
};

type GhIssueComment = {
  id?: string;
  author?: { login?: string };
  body?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
};

type GhReview = {
  id?: string;
  author?: { login?: string };
  body?: string;
  submittedAt?: string;
  state?: string;
  url?: string;
};

type GhReviewComment = {
  id?: number | string;
  user?: { login?: string };
  body?: string;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
  pull_request_review_id?: number | string | null;
};

type GhPrCheck = {
  bucket?: string;
  completedAt?: string;
  description?: string;
  link?: string;
  name?: string;
  startedAt?: string;
  state?: string;
  workflow?: string;
};

type GhRollupCheck = {
  __typename?: string;
  completedAt?: string;
  conclusion?: string;
  detailsUrl?: string;
  name?: string;
  startedAt?: string;
  status?: string;
  workflowName?: string;
};

export function createEmptyState(): WatchState {
  return {
    schemaVersion: STATE_SCHEMA,
    seenFeedbackIds: [],
    retryCountBySha: {},
    activeWatches: {},
  };
}

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

export function advanceStateAfterDecision(
  state: WatchState,
  snapshot: PullRequestSnapshot,
  decision: WatchDecision,
): WatchState {
  const seenFeedbackIds = new Set(state.seenFeedbackIds);
  for (const item of decision.feedback) {
    if (!item.pending) {
      seenFeedbackIds.add(item.id);
    }
  }

  const retryCountBySha = { ...state.retryCountBySha };
  if (decision.action === "recommend_rerun") {
    retryCountBySha[snapshot.ci.currentSha] = (retryCountBySha[snapshot.ci.currentSha] ?? 0) + 1;
  }

  return {
    schemaVersion: STATE_SCHEMA,
    seenFeedbackIds: [...seenFeedbackIds].sort(),
    retryCountBySha,
    activeWatches: { ...state.activeWatches },
  };
}

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

export async function readState(path = DEFAULT_STATE_FILE): Promise<WatchState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<WatchState>;
    return {
      schemaVersion: STATE_SCHEMA,
      seenFeedbackIds: Array.isArray(parsed.seenFeedbackIds) ? parsed.seenFeedbackIds : [],
      retryCountBySha:
        parsed.retryCountBySha && typeof parsed.retryCountBySha === "object"
          ? parsed.retryCountBySha
          : {},
      activeWatches:
        parsed.activeWatches && typeof parsed.activeWatches === "object"
          ? parsed.activeWatches
          : {},
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return createEmptyState();
    }
    throw error;
  }
}

export async function writeState(path: string, state: WatchState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function evaluateOnce(options: CliOptions): Promise<WatchReport> {
  const state = await readState(options.stateFile);
  const snapshot = options.fixturePath
    ? await readFixture(options.fixturePath)
    : await collectFromGitHub({ selector: options.selector, repository: options.repository });
  const decision = decideNextAction(snapshot, state, options.retryLimit);
  const nextState = advanceStateAfterDecision(state, snapshot, decision);
  if (JSON.stringify(nextState) !== JSON.stringify(state)) {
    await writeState(options.stateFile, nextState);
  }

  return {
    schemaVersion: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    target: {
      selector: options.selector ?? "current-branch",
      repository: options.repository ?? snapshot.repository,
      stateFile: options.stateFile,
    },
    snapshot,
    decision,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const releaseLock = options.noLock ? async () => undefined : await acquireLock(options);

  try {
    let lastReport: WatchReport | undefined;
    for (let index = 0; index < options.maxIterations; index += 1) {
      lastReport = await evaluateOnce(options);
      process.stdout.write(`${formatReport(lastReport, options.pretty)}\n`);

      if (lastReport.decision.terminal || lastReport.decision.needsUser || !options.pollSeconds) {
        break;
      }

      await sleep(options.pollSeconds * 1000);
    }

    if (!lastReport) {
      throw new Error("No watch report was produced.");
    }
  } finally {
    await releaseLock();
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    stateFile: DEFAULT_STATE_FILE,
    pretty: false,
    noLock: false,
    retryLimit: DEFAULT_RETRY_LIMIT,
    maxIterations: 1,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--pr") {
      index += 1;
      options.selector = requireValue(args, index, arg);
    } else if (arg === "--repo") {
      index += 1;
      options.repository = requireValue(args, index, arg);
    } else if (arg === "--fixture") {
      index += 1;
      options.fixturePath = requireValue(args, index, arg);
    } else if (arg === "--state-file") {
      index += 1;
      options.stateFile = requireValue(args, index, arg);
    } else if (arg === "--retry-limit") {
      index += 1;
      options.retryLimit = Number.parseInt(requireValue(args, index, arg), 10);
    } else if (arg === "--poll-seconds") {
      index += 1;
      options.pollSeconds = Number.parseInt(requireValue(args, index, arg), 10);
    } else if (arg === "--max-iterations") {
      index += 1;
      options.maxIterations = Number.parseInt(requireValue(args, index, arg), 10);
    } else if (arg === "--pretty") {
      options.pretty = true;
    } else if (arg === "--no-lock") {
      options.noLock = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(helpText());
      process.exit(0);
    } else if (!arg.startsWith("-") && !options.selector) {
      options.selector = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.retryLimit) || options.retryLimit < 0) {
    throw new Error("--retry-limit must be a non-negative integer.");
  }
  if (
    options.pollSeconds !== undefined &&
    (!Number.isInteger(options.pollSeconds) || options.pollSeconds < 5)
  ) {
    throw new Error("--poll-seconds must be an integer of at least 5.");
  }
  if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1) {
    throw new Error("--max-iterations must be a positive integer.");
  }

  return options;
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

async function readFixture(path: string): Promise<PullRequestSnapshot> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as PullRequestSnapshot;
  if (parsed.schemaVersion !== SNAPSHOT_SCHEMA) {
    throw new Error(`Fixture ${path} is not a ${SNAPSHOT_SCHEMA} snapshot.`);
  }
  return parsed;
}

export async function acquireLock(options: CliOptions): Promise<() => Promise<void>> {
  if (options.fixturePath) {
    return async () => undefined;
  }

  const key = lockKey(options.repository ?? "current-repo", options.selector ?? "current-branch");
  const lockRoot = resolve(dirname(options.stateFile), "locks");
  const lockPath = resolve(lockRoot, key);
  await mkdir(lockRoot, { recursive: true });
  try {
    await mkdir(lockPath, { recursive: false });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error(
        `Another pr-watch session appears active for ${key}. Remove ${lockPath} if it is stale.`,
      );
    }
    throw error;
  }

  await writeFile(
    resolve(lockPath, "owner.json"),
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  return async () => {
    await rm(lockPath, { recursive: true, force: true });
  };
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

function isFailedOrCancelledCheck(check: CiCheck): boolean {
  return check.result === "fail" || check.result === "cancelled";
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

function repositoryFromUrl(url: string): string | undefined {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(url);
  return match?.[1];
}

function requiredString(value: string | undefined | null, field: string): string {
  if (!value) {
    throw new Error(`GitHub response is missing ${field}.`);
  }
  return value;
}

function requiredNumber(value: number | undefined | null, field: string): number {
  if (typeof value !== "number") {
    throw new Error(`GitHub response is missing ${field}.`);
  }
  return value;
}

function lockKey(repository: string, selector: string): string {
  return `${repository}--${selector}`.replace(/[^a-zA-Z0-9_.-]+/g, "_");
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function formatReport(report: WatchReport, pretty: boolean): string {
  return JSON.stringify(report, null, pretty ? 2 : 0);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, milliseconds);
  });
}

function helpText(): string {
  return `Usage: node skills/pr-watch-skill/scripts/pr-watch.ts [<pr-url|number|branch>] [options]

Options:
  --pr <target>             Pull request URL, number, or branch. Defaults to current branch.
  --repo <owner/repo>       Repository for a numeric PR selector or current-branch lookup.
  --fixture <path>          Read a snapshot fixture instead of calling gh.
  --state-file <path>       Local state JSON path. Default: ${DEFAULT_STATE_FILE}
  --retry-limit <count>     Retry budget per head SHA. Default: ${DEFAULT_RETRY_LIMIT}
  --poll-seconds <seconds>  Re-run until terminal/user-blocked, waiting at least 5 seconds.
  --max-iterations <count>  Limit polling iterations. Default: 1
  --pretty                 Pretty-print JSON.
  --no-lock                Skip local concurrent-watch lock protection.
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
