import type { REPORT_SCHEMA, SNAPSHOT_SCHEMA, STATE_SCHEMA } from "./constants.ts";

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

export type GhPrView = {
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

export type GhIssueComment = {
  id?: string;
  author?: { login?: string };
  body?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
};

export type GhReview = {
  id?: string;
  author?: { login?: string };
  body?: string;
  submittedAt?: string;
  state?: string;
  url?: string;
};

export type GhReviewComment = {
  id?: number | string;
  user?: { login?: string };
  body?: string;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
  pull_request_review_id?: number | string | null;
};

export type GhPrCheck = {
  bucket?: string;
  completedAt?: string;
  description?: string;
  link?: string;
  name?: string;
  startedAt?: string;
  state?: string;
  workflow?: string;
};

export type GhRollupCheck = {
  __typename?: string;
  completedAt?: string;
  conclusion?: string;
  detailsUrl?: string;
  name?: string;
  startedAt?: string;
  status?: string;
  workflowName?: string;
};
