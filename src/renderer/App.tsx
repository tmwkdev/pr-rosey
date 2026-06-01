import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLoadingDependencies,
  createUnknownDependency,
  type DependencyCheckResult,
  type DependencyReadiness,
  dependencyIds,
} from "../shared/dependencies";
import type { PullRequestDiscovery, PullRequestSummary } from "../shared/pullRequests";
import { tokens } from "../styles/tokens";

const initialDependencies = dependencyIds.map((id) => createUnknownDependency(id));

function formatCheckedAt(readiness: DependencyReadiness | null): string {
  if (!readiness) {
    return "Not checked yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(readiness.checkedAt));
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function readinessSummary(dependencies: DependencyCheckResult[]): string {
  if (dependencies.some((dependency) => dependency.status === "loading")) {
    return "Checking local tools.";
  }

  if (dependencies.every((dependency) => dependency.status === "ready")) {
    return "Local environment is ready.";
  }

  return "Resolve the blocked checks before continuing.";
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

function App() {
  const [readiness, setReadiness] = useState<DependencyReadiness | null>(null);
  const [dependencies, setDependencies] = useState<DependencyCheckResult[]>(initialDependencies);
  const [isChecking, setIsChecking] = useState(false);
  const [pullRequestDiscovery, setPullRequestDiscovery] = useState<PullRequestDiscovery | null>(
    null,
  );
  const [pullRequestError, setPullRequestError] = useState<string | null>(null);
  const [isRefreshingPullRequests, setIsRefreshingPullRequests] = useState(false);
  const [openingPullRequestUrl, setOpeningPullRequestUrl] = useState<string | null>(null);

  const runDependencyChecks = useCallback(async () => {
    setIsChecking(true);
    setDependencies(createLoadingDependencies());

    try {
      const result = await window.prRosey.dependencies.check();
      setReadiness(result);
      setDependencies(result.dependencies);
    } catch {
      const checkedAt = new Date().toISOString();
      setReadiness({ checkedAt, dependencies: [] });
      setDependencies(
        dependencyIds.map((id) => ({
          ...createUnknownDependency(id),
          status: "error",
          message: "The readiness check could not complete. Restart pr-rosey and try again.",
          checkedAt,
        })),
      );
    } finally {
      setIsChecking(false);
    }
  }, []);

  const refreshPullRequests = useCallback(async () => {
    setIsRefreshingPullRequests(true);
    setPullRequestError(null);

    try {
      const result = await window.prRosey.pullRequests.fetchAuthoredOpen();
      setPullRequestDiscovery(result);
    } catch (error) {
      setPullRequestError(
        error instanceof Error
          ? error.message
          : "Could not fetch authored pull requests from GitHub.",
      );
    } finally {
      setIsRefreshingPullRequests(false);
    }
  }, []);

  const openPullRequest = useCallback(async (pullRequest: PullRequestSummary) => {
    setOpeningPullRequestUrl(pullRequest.url);
    setPullRequestError(null);

    try {
      await window.prRosey.pullRequests.openUrl(pullRequest.url);
    } catch (error) {
      setPullRequestError(
        error instanceof Error ? error.message : "Could not open the pull request URL.",
      );
    } finally {
      setOpeningPullRequestUrl(null);
    }
  }, []);

  useEffect(() => {
    void runDependencyChecks();
    void refreshPullRequests();
  }, [runDependencyChecks, refreshPullRequests]);

  const summary = useMemo(() => readinessSummary(dependencies), [dependencies]);
  const readyCount = dependencies.filter((dependency) => dependency.status === "ready").length;
  const issueCount = dependencies.filter((dependency) =>
    ["missing", "error"].includes(dependency.status),
  ).length;
  const pullRequests = pullRequestDiscovery?.pullRequests ?? [];
  const hasPullRequestError = Boolean(pullRequestError);
  const showInitialPullRequestLoading = isRefreshingPullRequests && !pullRequestDiscovery;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-[#10120f] shadow-panel">
          <header className="flex items-center justify-between border-line border-b px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="grid size-8 place-items-center rounded-md border border-line bg-white/[0.04] text-sm font-semibold">
                pr
              </div>
              <div>
                <h1 className="font-semibold leading-5">pr-rosey</h1>
                <p className="text-xs text-muted">Local pull request command center</p>
              </div>
            </div>
            <button
              className={tokens.button.secondary}
              disabled={isRefreshingPullRequests}
              type="button"
              onClick={refreshPullRequests}
            >
              {isRefreshingPullRequests ? "Refreshing" : "Refresh PRs"}
            </button>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="border-line border-b bg-white/[0.02] p-5 lg:border-r lg:border-b-0">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className={tokens.label.eyebrow}>Setup readiness</p>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">Dependency checks</h2>
                    <p className="text-sm leading-6 text-muted">
                      pr-rosey keeps system access in Electron and verifies the local tools it will
                      depend on next.
                    </p>
                  </div>
                </div>

                <div className={`${tokens.card.section} divide-y divide-line`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted">Ready</span>
                    <span className="font-mono text-sm text-ink">
                      {readyCount}/{dependencies.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted">Blocked</span>
                    <span className="font-mono text-sm text-ink">{issueCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted">Last run</span>
                    <span className="font-mono text-xs text-ink">{formatCheckedAt(readiness)}</span>
                  </div>
                </div>

                <button
                  className={tokens.button.secondary}
                  disabled={isChecking}
                  type="button"
                  onClick={runDependencyChecks}
                >
                  {isChecking ? "Running checks" : "Run checks"}
                </button>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col p-5 sm:p-7">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <p className={tokens.label.eyebrow}>Pull requests</p>
                  <h2 className="text-3xl font-semibold">Authored open PRs</h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted">
                    {formatPullRequestCount(pullRequestDiscovery)}
                  </p>
                </div>
                <button
                  className={tokens.button.primary}
                  disabled={isRefreshingPullRequests}
                  type="button"
                  onClick={refreshPullRequests}
                >
                  {isRefreshingPullRequests ? "Refreshing" : "Refresh"}
                </button>
              </div>

              {hasPullRequestError ? (
                <section className={`${tokens.card.section} mb-4 border-rosey/30 bg-rosey/10 p-4`}>
                  <p className="text-sm font-medium text-rosey">GitHub pull requests unavailable</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{pullRequestError}</p>
                </section>
              ) : null}

              <div className={`${tokens.card.panel} min-h-0 overflow-hidden`}>
                <div className="grid grid-cols-[1fr_auto] border-line border-b px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">
                  <span>Pull request</span>
                  <span>Status</span>
                </div>

                {showInitialPullRequestLoading ? (
                  <div className="px-4 py-8 text-sm text-muted">
                    Fetching authored open pull requests from GitHub.
                  </div>
                ) : null}

                {!showInitialPullRequestLoading &&
                !hasPullRequestError &&
                pullRequests.length === 0 ? (
                  <div className="px-4 py-8">
                    <h3 className="font-medium">No open authored pull requests</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      GitHub did not return any open PRs authored by the authenticated gh user.
                    </p>
                  </div>
                ) : null}

                {pullRequests.length > 0 ? (
                  <div className="max-h-[28rem] divide-y divide-line overflow-auto">
                    {pullRequests.map((pullRequest) => (
                      <div
                        className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_auto_auto] lg:items-center"
                        key={pullRequest.url}
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                            {pullRequest.repository.nameWithOwner}
                          </p>
                          <h3 className="break-words font-medium leading-6">
                            {pullRequest.title}{" "}
                            <span className="font-mono text-sm text-muted">
                              #{pullRequest.number}
                            </span>
                          </h3>
                          <p className="break-all font-mono text-xs text-muted">
                            {pullRequest.url}
                          </p>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <p className="text-xs text-muted">Source branch</p>
                          <p className="break-all font-mono text-sm text-ink">
                            {pullRequest.headRefName}
                          </p>
                          <p className="text-xs text-muted">
                            Updated {formatTimestamp(pullRequest.updatedAt)}
                          </p>
                        </div>

                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                            pullRequest.isDraft
                              ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                              : "border-moss/25 bg-moss/10 text-moss"
                          }`}
                        >
                          {pullRequest.isDraft ? "Draft" : "Open"}
                        </span>

                        <button
                          className={tokens.button.secondary}
                          disabled={openingPullRequestUrl === pullRequest.url}
                          type="button"
                          onClick={() => {
                            void openPullRequest(pullRequest);
                          }}
                        >
                          {openingPullRequestUrl === pullRequest.url ? "Opening" : "Open"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-auto pt-5">
                <section className={`${tokens.card.section} p-4`}>
                  <div className="grid gap-3 text-sm leading-6 text-muted sm:grid-cols-[1fr_auto] sm:items-center">
                    <p>
                      {summary} CI status, polling, prompt generation, and agent handoff remain out
                      of scope.
                    </p>
                    <span className="font-mono text-xs">
                      Last check: {formatCheckedAt(readiness)}
                    </span>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
