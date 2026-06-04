import {
  ciStatusLabels,
  formatCiStatusSummary,
  type PullRequestCiStatus,
  type PullRequestDiscovery,
  type PullRequestSummary,
} from "@/shared/pullRequests";
import { tokens } from "@/styles/tokens";

type PullRequestSectionKind = "authored" | "review-requested";

type PullRequestSectionState = {
  discovery: PullRequestDiscovery | null;
  error: string | null;
  isRefreshing: boolean;
  openingUrl: string | null;
  startingBabysitUrl: string | null;
  openPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
  refresh: () => Promise<void>;
  startBabysit: (pullRequest: PullRequestSummary) => Promise<void>;
};

type PullRequestSectionCopy = {
  countLabel: string;
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  loadingText: string;
  title: string;
};

const sectionCopy: Record<PullRequestSectionKind, PullRequestSectionCopy> = {
  authored: {
    countLabel: "authored by",
    emptyDescription: "GitHub did not return any open PRs authored by the authenticated gh user.",
    emptyTitle: "No open authored pull requests",
    eyebrow: "Authored by me",
    loadingText: "Fetching authored open pull requests from GitHub.",
    title: "Open work",
  },
  "review-requested": {
    countLabel: "directly requesting review from",
    emptyDescription:
      "GitHub did not return any open PRs where the authenticated gh user is directly requested as a reviewer.",
    emptyTitle: "No direct review requests",
    eyebrow: "Named reviewer",
    loadingText: "Fetching open pull requests that directly requested your review.",
    title: "Needs your review",
  },
};

const loadingRowIds = ["primary-loading-row", "secondary-loading-row"] as const;

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatPullRequestCount(
  discovery: PullRequestDiscovery | null,
  kind: PullRequestSectionKind,
): string {
  const copy = sectionCopy[kind];

  if (!discovery) {
    return copy.loadingText;
  }

  const visibleCount = discovery.pullRequests.length;
  const totalCount = discovery.totalCount;

  if (discovery.isLimited) {
    return `Showing ${visibleCount} of ${totalCount} open pull requests ${copy.countLabel} @${discovery.viewerLogin}.`;
  }

  return `${visibleCount} open pull request${
    visibleCount === 1 ? "" : "s"
  } ${copy.countLabel} @${discovery.viewerLogin}.`;
}

interface PullRequestsPanelProps {
  authored: PullRequestSectionState;
  checkedAt: string;
  readinessSummaryText: string;
  reviewRequested: PullRequestSectionState;
}

export function PullRequestsPanel({
  authored,
  checkedAt,
  readinessSummaryText,
  reviewRequested,
}: PullRequestsPanelProps) {
  return (
    <section className="min-h-full bg-canvas">
      <div className="border-b border-line bg-panel/40 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={tokens.label.eyebrow}>Pull request inbox</p>
            <h2 className="mt-1 text-base font-semibold text-ink">Open pull requests</h2>
          </div>
          <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted">
            <InboxCountMetadata
              count={authored.discovery?.pullRequests.length}
              label="Authored by me"
            />
            <InboxCountMetadata
              count={reviewRequested.discovery?.pullRequests.length}
              label="Review requested"
            />
          </div>
        </div>
      </div>

      <PullRequestSection kind="authored" state={authored} />
      <PullRequestSection kind="review-requested" state={reviewRequested} />

      <ReadinessFooter checkedAt={checkedAt} summary={readinessSummaryText} />
    </section>
  );
}

interface InboxCountMetadataProps {
  count: number | undefined;
  label: string;
}

function InboxCountMetadata({ count, label }: InboxCountMetadataProps) {
  const countText = typeof count === "number" ? count.toString() : "-";

  return (
    <span className="inline-flex items-baseline gap-2">
      {label}
      <span className={tokens.text.monoMeta}>{countText}</span>
    </span>
  );
}

interface PullRequestSectionProps {
  kind: PullRequestSectionKind;
  state: PullRequestSectionState;
}

function PullRequestSection({ kind, state }: PullRequestSectionProps) {
  const copy = sectionCopy[kind];
  const hasError = Boolean(state.error);
  const pullRequests = state.discovery?.pullRequests ?? [];
  const showInitialLoading = state.isRefreshing && !state.discovery;

  return (
    <section className="border-b border-line">
      <div className="bg-panel/20 px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={tokens.label.eyebrow}>{copy.eyebrow}</p>
            <h3 className="mt-1 text-sm font-semibold text-ink">{copy.title}</h3>
          </div>
          <p className="max-w-2xl text-right text-sm text-muted">
            {formatPullRequestCount(state.discovery, kind)}
          </p>
        </div>
      </div>

      {hasError && state.error ? <PullRequestError message={state.error} /> : null}

      <PullRequestList
        hasError={hasError}
        isInitialLoading={showInitialLoading}
        kind={kind}
        openingPullRequestUrl={state.openingUrl}
        pullRequests={pullRequests}
        startingBabysitUrl={state.startingBabysitUrl}
        onOpenPullRequest={state.openPullRequest}
        onStartBabysit={state.startBabysit}
      />
    </section>
  );
}

interface PullRequestErrorProps {
  message: string;
}

function PullRequestError({ message }: PullRequestErrorProps) {
  return (
    <div className="border-t border-rust/35 bg-rust/10 px-4 py-3 text-sm text-rust">{message}</div>
  );
}

interface PullRequestListProps {
  hasError: boolean;
  isInitialLoading: boolean;
  kind: PullRequestSectionKind;
  openingPullRequestUrl: string | null;
  pullRequests: PullRequestSummary[];
  startingBabysitUrl: string | null;
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
  onStartBabysit: (pullRequest: PullRequestSummary) => Promise<void>;
}

function PullRequestList({
  hasError,
  isInitialLoading,
  kind,
  openingPullRequestUrl,
  pullRequests,
  startingBabysitUrl,
  onOpenPullRequest,
  onStartBabysit,
}: PullRequestListProps) {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3 border-y border-line bg-panel/30 px-4 py-2 text-xs font-medium text-muted sm:grid-cols-[minmax(0,1fr)_6rem_7rem_10rem]">
        <span>Pull request</span>
        <span>Status</span>
        <span className="hidden sm:block">CI</span>
        <span className="text-right">Actions</span>
      </div>

      {isInitialLoading ? <PullRequestLoadingRows label={sectionCopy[kind].loadingText} /> : null}

      {!isInitialLoading && !hasError && pullRequests.length === 0 ? (
        <EmptyPullRequests kind={kind} />
      ) : null}

      {pullRequests.length > 0 ? (
        <div className="divide-y divide-line">
          {pullRequests.map((pullRequest) => (
            <PullRequestRow
              isOpening={openingPullRequestUrl === pullRequest.url}
              isStartingBabysit={startingBabysitUrl === pullRequest.url}
              key={pullRequest.url}
              kind={kind}
              pullRequest={pullRequest}
              onOpenPullRequest={onOpenPullRequest}
              onStartBabysit={onStartBabysit}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface PullRequestLoadingRowsProps {
  label: string;
}

function PullRequestLoadingRows({ label }: PullRequestLoadingRowsProps) {
  return (
    <div aria-live="polite" aria-label={label} className="divide-y divide-line" role="status">
      <p className="sr-only">{label}</p>
      {loadingRowIds.map((rowId) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_10rem]"
          key={rowId}
        >
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-3/4 rounded bg-faint/25" />
            <div className="flex gap-3">
              <div className="h-3 w-24 rounded bg-faint/20" />
              <div className="h-3 w-16 rounded bg-faint/20" />
              <div className="h-3 w-28 rounded bg-faint/20" />
            </div>
          </div>
          <div className="h-4 w-12 rounded bg-faint/20" />
          <div className="hidden min-w-0 space-y-2 sm:block">
            <div className="h-4 w-16 rounded bg-faint/20" />
            <div className="h-3 w-full rounded bg-faint/15" />
          </div>
          <div className="flex justify-end">
            <div className="h-9 w-16 rounded-md bg-faint/15" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmptyPullRequestsProps {
  kind: PullRequestSectionKind;
}

function EmptyPullRequests({ kind }: EmptyPullRequestsProps) {
  const copy = sectionCopy[kind];

  return (
    <div className="px-4 py-8">
      <h4 className="font-medium text-ink">{copy.emptyTitle}</h4>
      <p className="mt-1 text-sm text-muted">{copy.emptyDescription}</p>
    </div>
  );
}

interface PullRequestRowProps {
  isOpening: boolean;
  isStartingBabysit: boolean;
  kind: PullRequestSectionKind;
  pullRequest: PullRequestSummary;
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
  onStartBabysit: (pullRequest: PullRequestSummary) => Promise<void>;
}

function PullRequestRow({
  isOpening,
  isStartingBabysit,
  kind,
  pullRequest,
  onOpenPullRequest,
  onStartBabysit,
}: PullRequestRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3 px-4 py-3 text-sm hover:bg-panel/45 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_10rem]">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="truncate font-medium text-ink">{pullRequest.title}</p>
          <span className="font-mono text-xs text-muted">#{pullRequest.number}</span>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="truncate">{pullRequest.repository.nameWithOwner}</span>
          {kind === "review-requested" ? (
            <span className="truncate">by @{pullRequest.authorLogin}</span>
          ) : null}
          <span className="truncate font-mono">{pullRequest.headRefName}</span>
          <span>Updated {formatTimestamp(pullRequest.updatedAt)}</span>
        </div>
      </div>

      <PullRequestObjectStatus isDraft={pullRequest.isDraft} />
      <div className="hidden min-w-0 sm:block">
        <PullRequestCiStatusIndicator status={pullRequest.ciStatus} />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          className={tokens.button.primary}
          disabled={isStartingBabysit}
          type="button"
          onClick={() => {
            void onStartBabysit(pullRequest);
          }}
        >
          {isStartingBabysit ? "Starting" : "Babysit"}
        </button>
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

interface PullRequestObjectStatusProps {
  isDraft: boolean;
}

function PullRequestObjectStatus({ isDraft }: PullRequestObjectStatusProps) {
  if (isDraft) {
    return (
      <span className={`${tokens.badge.base} border-amber-300/30 bg-amber-300/10 text-amber-200`}>
        Draft
      </span>
    );
  }

  return <span className="text-sm text-muted">Open</span>;
}

interface PullRequestCiStatusProps {
  status: PullRequestCiStatus;
}

function PullRequestCiStatusIndicator({ status }: PullRequestCiStatusProps) {
  const statusDotClassName = getCiStatusDotClassName(status.state);
  const visibleChecks = status.checks
    .filter((check) => check.state === "failing" || check.state === "pending")
    .slice(0, 2);

  return (
    <div className="min-w-0">
      <div className={tokens.status.item}>
        <span aria-hidden="true" className={`${tokens.status.dot} ${statusDotClassName}`} />
        <span className={tokens.status.label}>{ciStatusLabels[status.state]}</span>
      </div>
      <p className="mt-1 truncate text-xs text-muted">{formatCiStatusSummary(status)}</p>

      {visibleChecks.length > 0 ? (
        <p className="truncate text-xs text-muted">
          {visibleChecks.map((check) => check.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function getCiStatusDotClassName(status: PullRequestCiStatus["state"]): string {
  switch (status) {
    case "passing":
      return tokens.statusDot.ready;
    case "failing":
      return tokens.statusDot.missing;
    case "pending":
      return tokens.statusDot.loading;
    case "error":
      return tokens.statusDot.error;
    case "no-checks":
    case "unknown":
      return tokens.statusDot.unknown;
  }
}

interface ReadinessFooterProps {
  checkedAt: string;
  summary: string;
}

function ReadinessFooter({ checkedAt, summary }: ReadinessFooterProps) {
  return (
    <footer className="border-t border-line bg-panel/70 px-4 py-2 text-xs text-muted">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>{summary} Babysit runs only in a managed local worktree.</p>
        <span>Last check: {checkedAt}</span>
      </div>
    </footer>
  );
}

export default PullRequestsPanel;
