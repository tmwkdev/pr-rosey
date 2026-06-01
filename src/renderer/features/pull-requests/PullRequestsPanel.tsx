import type { PullRequestDiscovery, PullRequestSummary } from "@/shared/pullRequests";
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

  return `${visibleCount} open pull request${visibleCount === 1 ? "" : "s"} authored by @${discovery.viewerLogin}.`;
}

interface PullRequestsPanelProps {
  checkedAt: string;
  discovery: PullRequestDiscovery | null;
  error: string | null;
  isRefreshing: boolean;
  openingPullRequestUrl: string | null;
  readinessSummaryText: string;
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
  onRefreshPullRequests: () => void;
}

export function PullRequestsPanel({
  checkedAt,
  discovery,
  error,
  isRefreshing,
  openingPullRequestUrl,
  readinessSummaryText,
  onOpenPullRequest,
  onRefreshPullRequests,
}: PullRequestsPanelProps) {
  const hasError = Boolean(error);
  const pullRequests = discovery?.pullRequests ?? [];
  const showInitialLoading = isRefreshing && !discovery;

  return (
    <section className="flex min-h-0 flex-col p-5 sm:p-7">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className={tokens.label.eyebrow}>Pull requests</p>
          <h2 className="text-3xl font-semibold">Authored open PRs</h2>
          <p className={`max-w-2xl ${tokens.text.mutedBody}`}>
            {formatPullRequestCount(discovery)}
          </p>
        </div>
        <button
          className={tokens.button.primary}
          disabled={isRefreshing}
          type="button"
          onClick={onRefreshPullRequests}
        >
          {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
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
    <section className={`${tokens.card.section} mb-4 border-rosey/30 bg-rosey/10 p-4`}>
      <p className="text-sm font-medium text-rosey">GitHub pull requests unavailable</p>
      <p className={`mt-1 ${tokens.text.mutedBody}`}>{message}</p>
    </section>
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
    <div className={`${tokens.card.panel} min-h-0 overflow-hidden`}>
      <div className="grid grid-cols-[1fr_auto] border-line border-b px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">
        <span>Pull request</span>
        <span>Status</span>
      </div>

      {isInitialLoading ? (
        <div className="px-4 py-8 text-sm text-muted">
          Fetching authored open pull requests from GitHub.
        </div>
      ) : null}

      {!isInitialLoading && !hasError && pullRequests.length === 0 ? <EmptyPullRequests /> : null}

      {pullRequests.length > 0 ? (
        <div className="max-h-[28rem] divide-y divide-line overflow-auto">
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
      <h3 className="font-medium">No open authored pull requests</h3>
      <p className={`mt-1 ${tokens.text.mutedBody}`}>
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
    <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_auto_auto] lg:items-center">
      <div className={tokens.layout.detailStack}>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          {pullRequest.repository.nameWithOwner}
        </p>
        <h3 className="break-words font-medium leading-6">
          {pullRequest.title}{" "}
          <span className="font-mono text-sm text-muted">#{pullRequest.number}</span>
        </h3>
        <p className="break-all font-mono text-xs text-muted">{pullRequest.url}</p>
      </div>

      <div className={tokens.layout.detailStack}>
        <p className={tokens.text.meta}>Source branch</p>
        <p className="break-all font-mono text-sm text-ink">{pullRequest.headRefName}</p>
        <p className={tokens.text.meta}>Updated {formatTimestamp(pullRequest.updatedAt)}</p>
      </div>

      <PullRequestStatusBadge isDraft={pullRequest.isDraft} />

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
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassName}`}
    >
      {isDraft ? "Draft" : "Open"}
    </span>
  );
}

interface ReadinessFooterProps {
  checkedAt: string;
  summary: string;
}

function ReadinessFooter({ checkedAt, summary }: ReadinessFooterProps) {
  return (
    <div className="mt-auto pt-5">
      <section className={`${tokens.card.section} p-4`}>
        <div
          className={`grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center ${tokens.text.mutedBody}`}
        >
          <p>
            {summary} CI status, polling, prompt generation, and agent handoff remain out of scope.
          </p>
          <span className="font-mono text-xs">Last check: {checkedAt}</span>
        </div>
      </section>
    </div>
  );
}
