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
  openPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
  refresh: () => Promise<void>;
};

type PullRequestSectionCopy = {
  countLabel: string;
  emptyAction: string;
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  loadingText: string;
  title: string;
};

const sectionCopy: Record<PullRequestSectionKind, PullRequestSectionCopy> = {
  authored: {
    countLabel: "authored by",
    emptyAction: "Refresh when a new branch is ready for review.",
    emptyDescription: "GitHub did not return any open PRs authored by the authenticated gh user.",
    emptyTitle: "No open authored pull requests",
    eyebrow: "Authored by me",
    loadingText: "Fetching authored open pull requests from GitHub.",
    title: "Open work",
  },
  "review-requested": {
    countLabel: "directly requesting review from",
    emptyAction: "Direct named review requests will appear here.",
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
  reviewRequested: PullRequestSectionState;
}

export function PullRequestsPanel({ authored, reviewRequested }: PullRequestsPanelProps) {
  return (
    <section className="min-h-full bg-paper">
      <PullRequestSection kind="authored" state={authored} />
      <PullRequestSection kind="review-requested" state={reviewRequested} />
    </section>
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
    <section className="border-b border-line" id={`${kind}-pull-requests`}>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{copy.title}</h2>
            <p className="mt-1 text-xs text-muted">{copy.eyebrow}</p>
          </div>
          <p className="max-w-xl text-right text-xs text-muted">
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
        onOpenPullRequest={state.openPullRequest}
      />
    </section>
  );
}

interface PullRequestErrorProps {
  message: string;
}

function PullRequestError({ message }: PullRequestErrorProps) {
  return (
    <div className="border-t border-rosey/35 bg-rosey/10 px-5 py-3 text-sm text-rosey">
      {message}
    </div>
  );
}

interface PullRequestListProps {
  hasError: boolean;
  isInitialLoading: boolean;
  kind: PullRequestSectionKind;
  openingPullRequestUrl: string | null;
  pullRequests: PullRequestSummary[];
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
}

function PullRequestList({
  hasError,
  isInitialLoading,
  kind,
  openingPullRequestUrl,
  pullRequests,
  onOpenPullRequest,
}: PullRequestListProps) {
  return (
    <div>
      {isInitialLoading ? <PullRequestLoadingRows label={sectionCopy[kind].loadingText} /> : null}

      {!isInitialLoading && !hasError && pullRequests.length === 0 ? (
        <EmptyPullRequests kind={kind} />
      ) : null}

      {pullRequests.length > 0 ? (
        <div className="divide-y divide-line border-t border-line">
          {pullRequests.map((pullRequest) => (
            <PullRequestRow
              isOpening={openingPullRequestUrl === pullRequest.url}
              key={pullRequest.url}
              kind={kind}
              pullRequest={pullRequest}
              onOpenPullRequest={onOpenPullRequest}
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
        <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-4 px-5 py-4" key={rowId}>
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-3/4 rounded bg-faint/25" />
            <div className="flex gap-3">
              <div className="h-3 w-24 rounded bg-faint/20" />
              <div className="h-3 w-16 rounded bg-faint/20" />
              <div className="h-3 w-28 rounded bg-faint/20" />
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            <div className="ml-auto h-4 w-20 rounded bg-faint/20" />
            <div className="ml-auto h-3 w-28 rounded bg-faint/15" />
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
    <div className="border-t border-line px-5 py-8">
      <h4 className="font-medium text-ink">{copy.emptyTitle}</h4>
      <p className="mt-1 text-sm text-muted">{copy.emptyDescription}</p>
      <p className="mt-2 text-xs text-muted">{copy.emptyAction}</p>
    </div>
  );
}

interface PullRequestRowProps {
  isOpening: boolean;
  kind: PullRequestSectionKind;
  pullRequest: PullRequestSummary;
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
}

function PullRequestRow({ isOpening, kind, pullRequest, onOpenPullRequest }: PullRequestRowProps) {
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)] gap-3 px-5 py-4 text-sm transition hover:bg-panel/70 focus-within:bg-panel/70 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-3">
          <PullRequestStateMark isDraft={pullRequest.isDraft} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="truncate font-medium text-ink">{pullRequest.title}</p>
              {pullRequest.isDraft ? (
                <span className="text-xs font-medium text-amber-200">Draft</span>
              ) : null}
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="truncate">{pullRequest.repository.nameWithOwner}</span>
              <span aria-hidden="true">/</span>
              <span className="font-mono">#{pullRequest.number}</span>
              {kind === "review-requested" ? (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="truncate">@{pullRequest.authorLogin}</span>
                </>
              ) : null}
              <span aria-hidden="true">/</span>
              <span>{formatTimestamp(pullRequest.updatedAt)}</span>
              <span className="hidden group-hover:inline group-focus-within:inline">/</span>
              <span className="hidden truncate font-mono group-hover:inline group-focus-within:inline">
                {pullRequest.headRefName}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <PullRequestCiStatusIndicator status={pullRequest.ciStatus} />
        <button
          className={`${tokens.button.quiet} sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100`}
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

interface PullRequestStateMarkProps {
  isDraft: boolean;
}

function PullRequestStateMark({ isDraft }: PullRequestStateMarkProps) {
  const statusDotClassName = isDraft
    ? "bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.28)]"
    : tokens.statusDot.ready;

  return (
    <span
      aria-hidden="true"
      className={`mt-1 size-2.5 shrink-0 rounded-full ${statusDotClassName}`}
    />
  );
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
    <div className="min-w-0 text-right">
      <div className={`${tokens.status.item} justify-end`}>
        <span aria-hidden="true" className={`${tokens.status.dot} ${statusDotClassName}`} />
        <span className={tokens.status.label}>{ciStatusLabels[status.state]}</span>
      </div>
      <p className="mt-1 hidden max-w-44 truncate text-xs text-muted group-hover:block group-focus-within:block">
        {formatCiStatusSummary(status)}
      </p>

      {visibleChecks.length > 0 ? (
        <p className="hidden max-w-44 truncate text-xs text-muted group-hover:block group-focus-within:block">
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

export default PullRequestsPanel;
