import {
  ciStatusLabels,
  formatCiStatusSummary,
  type PullRequestCiStatus,
  type PullRequestDiscovery,
  type PullRequestSummary,
} from "@/shared/pullRequests";
import { tokens } from "@/styles/tokens";

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatPullRequestCount(discovery: PullRequestDiscovery | null): string {
  if (!discovery) {
    return "Fetching authored pull requests with GitHub CLI.";
  }

  const visibleCount = discovery.pullRequests.length;
  const totalCount = discovery.totalCount;

  if (discovery.isLimited) {
    return `Showing ${visibleCount} of ${totalCount} open pull requests authored by @${discovery.viewerLogin}.`;
  }

  return `${visibleCount} open pull request${
    visibleCount === 1 ? "" : "s"
  } authored by @${discovery.viewerLogin}.`;
}

interface PullRequestsPanelProps {
  checkedAt: string;
  discovery: PullRequestDiscovery | null;
  error: string | null;
  isRefreshing: boolean;
  openingPullRequestUrl: string | null;
  readinessSummaryText: string;
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
}

export function PullRequestsPanel({
  checkedAt,
  discovery,
  error,
  isRefreshing,
  openingPullRequestUrl,
  readinessSummaryText,
  onOpenPullRequest,
}: PullRequestsPanelProps) {
  const hasError = Boolean(error);
  const pullRequests = discovery?.pullRequests ?? [];
  const showInitialLoading = isRefreshing && !discovery;

  return (
    <section className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="shrink-0 border-b border-line bg-panel/40 px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={tokens.label.eyebrow}>Authored pull requests</p>
            <h2 className="mt-1 text-base font-semibold text-ink">Open work</h2>
          </div>
          <p className="max-w-2xl text-right text-sm text-muted">
            {formatPullRequestCount(discovery)}
          </p>
        </div>
      </div>

      {hasError && error ? <PullRequestError message={error} /> : null}

      <PullRequestList
        hasError={hasError}
        isInitialLoading={showInitialLoading}
        openingPullRequestUrl={openingPullRequestUrl}
        pullRequests={pullRequests}
        onOpenPullRequest={onOpenPullRequest}
      />

      <ReadinessFooter checkedAt={checkedAt} summary={readinessSummaryText} />
    </section>
  );
}

interface PullRequestErrorProps {
  message: string;
}

function PullRequestError({ message }: PullRequestErrorProps) {
  return (
    <div className="shrink-0 border-b border-rust/35 bg-rust/10 px-4 py-3 text-sm text-rust">
      {message}
    </div>
  );
}

interface PullRequestListProps {
  hasError: boolean;
  isInitialLoading: boolean;
  openingPullRequestUrl: string | null;
  pullRequests: PullRequestSummary[];
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
}

function PullRequestList({
  hasError,
  isInitialLoading,
  openingPullRequestUrl,
  pullRequests,
  onOpenPullRequest,
}: PullRequestListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-3 border-b border-line bg-panel/30 px-4 py-2 text-xs font-medium text-muted sm:grid-cols-[minmax(0,1fr)_6rem_7rem_5.5rem]">
        <span>Pull request</span>
        <span>State</span>
        <span className="hidden sm:block">CI</span>
        <span className="text-right">Action</span>
      </div>

      {isInitialLoading ? (
        <div className="px-4 py-8 text-sm text-muted">
          Fetching authored open pull requests from GitHub.
        </div>
      ) : null}

      {!isInitialLoading && !hasError && pullRequests.length === 0 ? <EmptyPullRequests /> : null}

      {pullRequests.length > 0 ? (
        <div className="min-h-0 flex-1 divide-y divide-line overflow-auto">
          {pullRequests.map((pullRequest) => (
            <PullRequestRow
              isOpening={openingPullRequestUrl === pullRequest.url}
              key={pullRequest.url}
              pullRequest={pullRequest}
              onOpenPullRequest={onOpenPullRequest}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyPullRequests() {
  return (
    <div className="px-4 py-8">
      <h3 className="font-medium text-ink">No open authored pull requests</h3>
      <p className="mt-1 text-sm text-muted">
        GitHub did not return any open PRs authored by the authenticated gh user.
      </p>
    </div>
  );
}

interface PullRequestRowProps {
  isOpening: boolean;
  pullRequest: PullRequestSummary;
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
}

function PullRequestRow({ isOpening, pullRequest, onOpenPullRequest }: PullRequestRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3 px-4 py-3 text-sm hover:bg-panel/45 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_5.5rem]">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="truncate font-medium text-ink">{pullRequest.title}</p>
          <span className="font-mono text-xs text-muted">#{pullRequest.number}</span>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="truncate">{pullRequest.repository.nameWithOwner}</span>
          <span className="truncate font-mono">{pullRequest.headRefName}</span>
          <span>Updated {formatTimestamp(pullRequest.updatedAt)}</span>
        </div>
      </div>

      <PullRequestStatusBadge isDraft={pullRequest.isDraft} />
      <div className="hidden min-w-0 sm:block">
        <PullRequestCiStatusBadge status={pullRequest.ciStatus} />
      </div>

      <div className="flex justify-end">
        <button
          className={tokens.button.secondary}
          disabled={isOpening}
          type="button"
          onClick={() => {
            void onOpenPullRequest(pullRequest);
          }}
        >
          {isOpening ? "Opening" : "Open"}
        </button>
      </div>
    </div>
  );
}

interface PullRequestStatusBadgeProps {
  isDraft: boolean;
}

function PullRequestStatusBadge({ isDraft }: PullRequestStatusBadgeProps) {
  const statusClassName = isDraft
    ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
    : "border-moss/25 bg-moss/10 text-moss";

  return (
    <span
      className={`inline-flex h-fit w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName}`}
    >
      {isDraft ? "Draft" : "Open"}
    </span>
  );
}

interface PullRequestCiStatusProps {
  status: PullRequestCiStatus;
}

function PullRequestCiStatusBadge({ status }: PullRequestCiStatusProps) {
  const statusClassName = getCiStatusClassName(status.state);
  const visibleChecks = status.checks
    .filter((check) => check.state === "failing" || check.state === "pending")
    .slice(0, 2);

  return (
    <div className="min-w-0">
      <span
        className={`inline-flex h-fit w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName}`}
      >
        {ciStatusLabels[status.state]}
      </span>
      <p className="mt-1 truncate text-xs text-muted">{formatCiStatusSummary(status)}</p>

      {visibleChecks.length > 0 ? (
        <p className="truncate text-xs text-muted">
          {visibleChecks.map((check) => check.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function getCiStatusClassName(status: PullRequestCiStatus["state"]): string {
  switch (status) {
    case "passing":
      return tokens.status.ready;
    case "failing":
      return tokens.status.missing;
    case "pending":
      return tokens.status.loading;
    case "error":
      return tokens.status.error;
    case "no-checks":
    case "unknown":
      return tokens.status.unknown;
  }
}

interface ReadinessFooterProps {
  checkedAt: string;
  summary: string;
}

function ReadinessFooter({ checkedAt, summary }: ReadinessFooterProps) {
  return (
    <footer className="shrink-0 border-t border-line bg-panel/70 px-4 py-2 text-xs text-muted">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>{summary} Polling, prompt generation, and agent handoff remain out of scope.</p>
        <span>Last check: {checkedAt}</span>
      </div>
    </footer>
  );
}

export default PullRequestsPanel;
