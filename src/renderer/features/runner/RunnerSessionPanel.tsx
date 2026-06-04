import type { PiRunnerReadiness, RunnerEventSummary, RunnerSessionState } from "@/shared/runner";
import { tokens } from "@/styles/tokens";

interface RunnerSessionPanelProps {
  error: string | null;
  isAborting: boolean;
  isCheckingReadiness: boolean;
  readiness: PiRunnerReadiness | null;
  session: RunnerSessionState | null;
  onAbortSession: () => void;
  onCheckReadiness: () => void;
}

export function RunnerSessionPanel({
  error,
  isAborting,
  isCheckingReadiness,
  readiness,
  session,
  onAbortSession,
  onCheckReadiness,
}: RunnerSessionPanelProps) {
  const canAbort = session ? ["starting", "running", "aborting"].includes(session.status) : false;

  return (
    <section className="border-b border-line bg-panel/30 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={tokens.label.eyebrow}>Pi runner</p>
          <h2 className="mt-1 text-sm font-semibold text-ink">
            {session ? session.pullRequest.title : "No babysit session running"}
          </h2>
          <p className="mt-1 text-xs text-muted">{getReadinessSummary(readiness)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className={tokens.button.secondary}
            disabled={isCheckingReadiness}
            type="button"
            onClick={onCheckReadiness}
          >
            {isCheckingReadiness ? "Checking" : "Check Pi"}
          </button>
          {canAbort ? (
            <button
              className={tokens.button.secondary}
              disabled={isAborting || session?.status === "aborting"}
              type="button"
              onClick={onAbortSession}
            >
              {isAborting || session?.status === "aborting" ? "Aborting" : "Abort"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="mt-3 text-sm text-rust">{error}</div> : null}

      {session ? <SessionDetails session={session} /> : null}
    </section>
  );
}

interface SessionDetailsProps {
  session: RunnerSessionState;
}

function SessionDetails({ session }: SessionDetailsProps) {
  const visibleEvents = session.events.slice(-8);

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Status</dt>
        <dd className="font-mono text-ink">{session.status}</dd>
        <dt className="text-muted">PR</dt>
        <dd className="truncate text-ink">
          {session.pullRequest.repository} #{session.pullRequest.number}
        </dd>
        <dt className="text-muted">Branch</dt>
        <dd className="truncate font-mono text-ink">{session.pullRequest.headRefName}</dd>
        <dt className="text-muted">Worktree</dt>
        <dd className="truncate font-mono text-ink">
          {session.worktree?.worktreePath ?? "Preparing"}
        </dd>
        <dt className="text-muted">Logs</dt>
        <dd className="truncate font-mono text-ink">{session.logDirectory}</dd>
        {session.error ? (
          <>
            <dt className="text-muted">Error</dt>
            <dd className="text-rust">{session.error}</dd>
          </>
        ) : null}
      </dl>

      <div className="min-h-24 min-w-0 rounded-md border border-line bg-paper/70">
        <div className="border-b border-line px-3 py-2 text-xs font-medium text-muted">
          Session events
        </div>
        {visibleEvents.length > 0 ? (
          <div className="max-h-56 divide-y divide-line overflow-auto">
            {visibleEvents.map((event) => (
              <RunnerEventRow event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <p className="px-3 py-4 text-sm text-muted">Waiting for Pi RPC output.</p>
        )}
      </div>
    </div>
  );
}

interface RunnerEventRowProps {
  event: RunnerEventSummary;
}

function RunnerEventRow({ event }: RunnerEventRowProps) {
  return (
    <div className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[7rem_minmax(0,1fr)]">
      <span className="font-medium text-muted">{event.label}</span>
      <span className={event.kind === "error" ? "text-rust" : "truncate text-ink"}>
        {event.message}
      </span>
    </div>
  );
}

function getReadinessSummary(readiness: PiRunnerReadiness | null): string {
  if (!readiness) {
    return "Pi readiness has not been checked yet.";
  }

  return [
    `install ${readiness.installed.status}`,
    `auth ${readiness.auth.status}`,
    `model ${readiness.model.status}`,
  ].join(" | ");
}

export default RunnerSessionPanel;
