import PiSessionConsole from "@pr-rosey/desktop/renderer/features/pi-runner/PiSessionConsole";
import {
  type PiRunnerSessionSnapshot,
  piRunnerSessionKey,
} from "@pr-rosey/desktop/shared/piRunner";
import {
  ciStatusLabels,
  formatCiStatusSummary,
  type PullRequestCiStatus,
  type PullRequestDiscovery,
  type PullRequestSummary,
} from "@pr-rosey/desktop/shared/pullRequests";
import { tokens } from "@pr-rosey/desktop/styles/tokens";

type PullRequestSectionKind = "authored" | "review-requested";

type PullRequestSectionState = {
  discovery: PullRequestDiscovery | null;
  error: string | null;
  isRefreshing: boolean;
  openingUrl: string | null;
  openPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
  refresh: () => Promise<void>;
};

type PiRunnerPanelState = {
  abortingSessionId: string | null;
  error: string | null;
  hasActiveSession: boolean;
  selectedSession: PiRunnerSessionSnapshot | null;
  selectedSessionId: string | null;
  sessions: PiRunnerSessionSnapshot[];
  startingPullRequestUrl: string | null;
  abortSession: (sessionId: string) => Promise<void>;
  selectSession: (sessionId: string | null) => void;
  startBabysit: (pullRequest: PullRequestSummary) => Promise<void>;
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
  piRunner: PiRunnerPanelState;
  reviewRequested: PullRequestSectionState;
}

export function PullRequestsPanel({ authored, piRunner, reviewRequested }: PullRequestsPanelProps) {
  return (
    <section className="grid h-full min-h-0 bg-paper lg:grid-cols-[minmax(360px,0.42fr)_minmax(520px,0.58fr)]">
      <div className="min-h-0 overflow-auto border-r border-line">
        <PullRequestSection kind="authored" piRunner={piRunner} state={authored} />
        <PullRequestSection kind="review-requested" piRunner={piRunner} state={reviewRequested} />
      </div>
      <div className="min-h-0 overflow-hidden border-t border-line lg:border-t-0">
        <PiSessionConsole
          abortingSessionId={piRunner.abortingSessionId}
          session={piRunner.selectedSession}
          onAbortSession={piRunner.abortSession}
        />
      </div>
    </section>
  );
}

interface PullRequestSectionProps {
  kind: PullRequestSectionKind;
  piRunner: PiRunnerPanelState;
  state: PullRequestSectionState;
}

function PullRequestSection({ kind, piRunner, state }: PullRequestSectionProps) {
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
      {piRunner.error ? <PullRequestError message={piRunner.error} /> : null}

      <PullRequestList
        hasError={hasError}
        isInitialLoading={showInitialLoading}
        kind={kind}
        openingPullRequestUrl={state.openingUrl}
        piRunner={piRunner}
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
  piRunner: PiRunnerPanelState;
  pullRequests: PullRequestSummary[];
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
}

function PullRequestList({
  hasError,
  isInitialLoading,
  kind,
  openingPullRequestUrl,
  piRunner,
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
              piRunner={piRunner}
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
  piRunner: PiRunnerPanelState;
  pullRequest: PullRequestSummary;
  onOpenPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
}

function PullRequestRow({
  isOpening,
  kind,
  piRunner,
  pullRequest,
  onOpenPullRequest,
}: PullRequestRowProps) {
  const piSession = findLatestPiSession(piRunner.sessions, pullRequest);
  const isStartingPi = piRunner.startingPullRequestUrl === pullRequest.url;
  const isPiActionDisabled = isStartingPi || piRunner.hasActiveSession;
  const isSelectedPiSession = Boolean(piSession && piRunner.selectedSessionId === piSession.id);

  return (
    <div
      className={`group grid grid-cols-[minmax(0,1fr)] gap-3 px-5 py-4 text-sm transition hover:bg-panel/70 focus-within:bg-panel/70 sm:grid-cols-[minmax(0,1fr)_auto] ${
        isSelectedPiSession ? "bg-moss/[0.055] shadow-[3px_0_0_#6bd19b_inset]" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-3">
          <PullRequestStateMark isDraft={pullRequest.isDraft} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="truncate font-medium text-ink">{pullRequest.title}</p>
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
            {piSession ? (
              <PiRunnerSessionEvidence
                abortingSessionId={piRunner.abortingSessionId}
                isSelected={isSelectedPiSession}
                session={piSession}
                onAbortSession={piRunner.abortSession}
                onSelectSession={piRunner.selectSession}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <PullRequestCiStatusIndicator status={pullRequest.ciStatus} />
        <button
          className={`${tokens.button.quiet} sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100`}
          disabled={isPiActionDisabled}
          type="button"
          onClick={() => {
            void piRunner.startBabysit(pullRequest);
          }}
        >
          {isStartingPi ? "Starting babysit" : "Babysit"}
        </button>
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

interface PiRunnerSessionEvidenceProps {
  abortingSessionId: string | null;
  isSelected: boolean;
  session: PiRunnerSessionSnapshot;
  onAbortSession: (sessionId: string) => Promise<void>;
  onSelectSession: (sessionId: string | null) => void;
}

function PiRunnerSessionEvidence({
  abortingSessionId,
  isSelected,
  session,
  onAbortSession,
  onSelectSession,
}: PiRunnerSessionEvidenceProps) {
  const showStopAction =
    session.status === "starting" || session.status === "running" || session.status === "aborting";
  const lastActivity = session.activityEvents.at(-1);

  return (
    <div className="mt-3 rounded-md border border-line bg-panel/80 p-3 text-xs">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={tokens.status.item}>
            <span
              aria-hidden="true"
              className={`${tokens.status.dot} ${getPiRunnerStatusDotClassName(session.status)}`}
            />
            <span className={tokens.status.label}>{getPiRunnerStatusLabel(session.status)}</span>
            <span className={tokens.status.value}>
              {session.pid ? `pid ${session.pid}` : session.id}
            </span>
          </div>
          <p className="mt-1 truncate text-muted">{session.localPath}</p>
          <p className="mt-1 truncate text-muted">Log: {session.logFilePath}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            className={tokens.button.quiet}
            disabled={isSelected}
            type="button"
            onClick={() => {
              onSelectSession(session.id);
            }}
          >
            {isSelected ? "Open" : "Open session"}
          </button>
          {showStopAction ? (
            <button
              className={tokens.button.quiet}
              disabled={session.status === "aborting" || abortingSessionId === session.id}
              type="button"
              onClick={() => {
                void onAbortSession(session.id);
              }}
            >
              {session.status === "aborting" || abortingSessionId === session.id
                ? "Stopping"
                : "Stop Pi"}
            </button>
          ) : null}
        </div>
      </div>

      {lastActivity ? (
        <p className="mt-2 truncate text-muted">
          Last activity: <span className="text-ink">{lastActivity.title}</span> -{" "}
          {lastActivity.summary}
        </p>
      ) : null}

      {session.error ? <p className="mt-2 text-rosey">{session.error}</p> : null}
    </div>
  );
}

function findLatestPiSession(
  sessions: PiRunnerSessionSnapshot[],
  pullRequest: PullRequestSummary,
): PiRunnerSessionSnapshot | null {
  const sessionKey = piRunnerSessionKey(pullRequest);

  return (
    sessions.find(
      (session) => `${session.repositoryNameWithOwner}#${session.pullRequestNumber}` === sessionKey,
    ) ?? null
  );
}

function getPiRunnerStatusLabel(status: PiRunnerSessionSnapshot["status"]): string {
  switch (status) {
    case "starting":
      return "Pi starting";
    case "running":
      return "Pi running";
    case "aborting":
      return "Pi stopping";
    case "exited":
      return "Pi exited";
    case "failed":
      return "Pi failed";
    case "aborted":
      return "Pi stopped";
  }
}

function getPiRunnerStatusDotClassName(status: PiRunnerSessionSnapshot["status"]): string {
  switch (status) {
    case "starting":
    case "running":
    case "aborting":
      return tokens.statusDot.loading;
    case "exited":
      return tokens.statusDot.ready;
    case "failed":
      return tokens.statusDot.missing;
    case "aborted":
      return tokens.statusDot.unknown;
  }
}
interface PullRequestStateMarkProps {
  isDraft: boolean;
}

function PullRequestStateMark({ isDraft }: PullRequestStateMarkProps) {
  const statusDotClassName = isDraft ? tokens.statusDot.draft : tokens.statusDot.ready;

  return (
    <span
      aria-label={isDraft ? "Draft pull request" : "Open pull request"}
      className={`mt-1 size-2.5 shrink-0 rounded-full ${statusDotClassName}`}
      role="img"
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
