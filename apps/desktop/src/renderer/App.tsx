import { useEffect, useState } from "react";
import { usePiRunnerSessions } from "@/renderer/features/pi-runner/usePiRunnerSessions";
import PullRequestsPanel from "@/renderer/features/pull-requests/PullRequestsPanel";
import {
  useAuthoredPullRequests,
  useReviewRequestedPullRequests,
} from "@/renderer/features/pull-requests/useAuthoredPullRequests";
import ReadinessPanel from "@/renderer/features/readiness/ReadinessPanel";
import { useDependencyReadiness } from "@/renderer/features/readiness/useDependencyReadiness";
import SettingsPage from "@/renderer/features/settings/SettingsPage";
import { tokens } from "@/styles/tokens";

type AppRoute = "pull-requests" | "settings";

function getRouteFromHash(): AppRoute {
  return window.location.hash === "#settings" ? "settings" : "pull-requests";
}

interface AppToolbarProps {
  authoredCount: number | undefined;
  isCheckingReadiness: boolean;
  isRefreshingPullRequests: boolean;
  reviewRequestCount: number | undefined;
  readinessSummaryText: string;
  onRefreshPullRequests: () => void;
  onRunReadinessChecks: () => void;
}

function AppToolbar({
  authoredCount,
  isCheckingReadiness,
  isRefreshingPullRequests,
  reviewRequestCount,
  readinessSummaryText,
  onRefreshPullRequests,
  onRunReadinessChecks,
}: AppToolbarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1">
        <h1 className="truncate text-sm font-semibold text-ink">pr-rosey</h1>
        <ToolbarCount count={authoredCount} label="Open work" />
        <ToolbarCount count={reviewRequestCount} label="Needs review" />
        <p className="min-w-0 truncate text-xs text-muted">{readinessSummaryText}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          className={tokens.button.quiet}
          disabled={isCheckingReadiness}
          type="button"
          onClick={onRunReadinessChecks}
        >
          {isCheckingReadiness ? "Checking" : "Check tools"}
        </button>
        <button
          className={tokens.button.quiet}
          disabled={isRefreshingPullRequests}
          type="button"
          onClick={onRefreshPullRequests}
        >
          {isRefreshingPullRequests ? "Refreshing" : "Refresh"}
        </button>
      </div>
    </header>
  );
}

interface ToolbarCountProps {
  count: number | undefined;
  label: string;
}

function ToolbarCount({ count, label }: ToolbarCountProps) {
  return (
    <span className="inline-flex items-baseline gap-2 text-sm text-muted">
      <span className="font-medium text-ink">{typeof count === "number" ? count : "-"}</span>
      {label}
    </span>
  );
}

export function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => getRouteFromHash());
  const readiness = useDependencyReadiness();
  const authoredPullRequests = useAuthoredPullRequests();
  const reviewRequestedPullRequests = useReviewRequestedPullRequests();
  const piRunner = usePiRunnerSessions();
  const isRefreshingPullRequests =
    authoredPullRequests.isRefreshing || reviewRequestedPullRequests.isRefreshing;

  const refreshPullRequests = () => {
    void authoredPullRequests.refresh();
    void reviewRequestedPullRequests.refresh();
  };

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(getRouteFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    return window.prRosey.navigation.onOpenSettingsPage(() => {
      setCurrentRoute("settings");
      window.location.hash = "settings";
    });
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas text-ink">
      <div className="flex h-full min-h-0 flex-col">
        <AppToolbar
          authoredCount={authoredPullRequests.discovery?.pullRequests.length}
          isCheckingReadiness={readiness.isChecking}
          isRefreshingPullRequests={isRefreshingPullRequests}
          reviewRequestCount={reviewRequestedPullRequests.discovery?.pullRequests.length}
          readinessSummaryText={readiness.summary}
          onRefreshPullRequests={refreshPullRequests}
          onRunReadinessChecks={readiness.runChecks}
        />

        {currentRoute === "settings" ? (
          <main className="min-h-0 flex-1 overflow-auto">
            <SettingsPage />
          </main>
        ) : (
          <>
            <ReadinessPanel
              checkedAt={readiness.checkedAt}
              dependencies={readiness.dependencies}
              isChecking={readiness.isChecking}
            />

            <main className="min-h-0 flex-1 overflow-hidden">
              <PullRequestsPanel
                authored={authoredPullRequests}
                piRunner={piRunner}
                reviewRequested={reviewRequestedPullRequests}
              />
            </main>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
