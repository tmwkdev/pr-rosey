export type PullRequestCiStatusState =
  | "passing"
  | "failing"
  | "pending"
  | "error"
  | "no-checks"
  | "unknown";

export type PullRequestCiCheckState = "passing" | "failing" | "pending" | "skipped" | "unknown";

export type PullRequestCiCheck = {
  name: string;
  state: PullRequestCiCheckState;
  url: string | null;
};

export type PullRequestCiStatus = {
  state: PullRequestCiStatusState;
  commitOid: string | null;
  totalCount: number;
  passingCount: number;
  failingCount: number;
  pendingCount: number;
  skippedCount: number;
  unknownCount: number;
  checks: PullRequestCiCheck[];
  isIncomplete: boolean;
};

export type PullRequestSummary = {
  repository: {
    owner: string;
    name: string;
    nameWithOwner: string;
  };
  authorLogin: string;
  title: string;
  number: number;
  url: string;
  isDraft: boolean;
  headRefName: string;
  updatedAt: string;
  ciStatus: PullRequestCiStatus;
};

export type PullRequestDiscovery = {
  fetchedAt: string;
  viewerLogin: string;
  pullRequests: PullRequestSummary[];
  totalCount: number;
  isLimited: boolean;
};

export const ciStatusLabels: Record<PullRequestCiStatusState, string> = {
  passing: "Passing",
  failing: "Failing",
  pending: "Pending",
  error: "Error",
  "no-checks": "No checks",
  unknown: "Unknown",
};

export function formatCiStatusSummary(status: PullRequestCiStatus): string {
  if (status.state === "no-checks") {
    return "No CI checks found";
  }

  if (status.state === "unknown") {
    return "CI status unavailable";
  }

  const parts = [
    status.failingCount > 0 ? `${status.failingCount} failing` : null,
    status.pendingCount > 0 ? `${status.pendingCount} pending` : null,
    status.passingCount > 0 ? `${status.passingCount} passing` : null,
    status.skippedCount > 0 ? `${status.skippedCount} skipped` : null,
    status.unknownCount > 0 ? `${status.unknownCount} unknown` : null,
  ].filter((part): part is string => Boolean(part));

  const summary = parts.length > 0 ? parts.join(", ") : `${status.totalCount} checks`;

  return status.isIncomplete ? `${summary}, more checks on GitHub` : summary;
}
