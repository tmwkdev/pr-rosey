import PullRequestsPanel from "@/renderer/features/pull-requests/PullRequestsPanel";
import {
  useAuthoredPullRequests,
  useReviewRequestedPullRequests,
} from "@/renderer/features/pull-requests/useAuthoredPullRequests";
import ReadinessPanel from "@/renderer/features/readiness/ReadinessPanel";
import { useDependencyReadiness } from "@/renderer/features/readiness/useDependencyReadiness";
import { tokens } from "@/styles/tokens";

interface AppToolbarProps {
  isCheckingReadiness: boolean;
  isRefreshingPullRequests: boolean;
  readinessSummaryText: string;
  onRefreshPullRequests: () => void;
  onRunReadinessChecks: () => void;
}

function AppToolbar({
  isCheckingReadiness,
  isRefreshingPullRequests,
  readinessSummaryText,
  onRefreshPullRequests,
  onRunReadinessChecks,
}: AppToolbarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-ink">pr-rosey</h1>
        <p className={tokens.text.meta}>{readinessSummaryText}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          className={tokens.button.secondary}
          disabled={isCheckingReadiness}
          type="button"
          onClick={onRunReadinessChecks}
        >
          {isCheckingReadiness ? "Checking" : "Check tools"}
        </button>
        <button
          className={tokens.button.primary}
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

export function App() {
  const readiness = useDependencyReadiness();
  const authoredPullRequests = useAuthoredPullRequests();
  const reviewRequestedPullRequests = useReviewRequestedPullRequests();
  const isRefreshingPullRequests =
    authoredPullRequests.isRefreshing || reviewRequestedPullRequests.isRefreshing;

  const refreshPullRequests = () => {
    void authoredPullRequests.refresh();
    void reviewRequestedPullRequests.refresh();
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas text-ink">
      <div className="flex h-full min-h-0 flex-col">
        <AppToolbar
          isCheckingReadiness={readiness.isChecking}
          isRefreshingPullRequests={isRefreshingPullRequests}
          readinessSummaryText={readiness.summary}
          onRefreshPullRequests={refreshPullRequests}
          onRunReadinessChecks={readiness.runChecks}
        />

        <ReadinessPanel
          checkedAt={readiness.checkedAt}
          dependencies={readiness.dependencies}
          isChecking={readiness.isChecking}
        />

        <main className="min-h-0 flex-1 overflow-auto">
          <PullRequestsPanel
            authored={authoredPullRequests}
            checkedAt={readiness.checkedAt}
            readinessSummaryText={readiness.summary}
            reviewRequested={reviewRequestedPullRequests}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
