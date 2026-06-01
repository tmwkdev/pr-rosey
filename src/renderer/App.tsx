import { tokens } from "../styles/tokens";
import { PullRequestsPanel } from "./features/pull-requests/PullRequestsPanel";
import { useAuthoredPullRequests } from "./features/pull-requests/useAuthoredPullRequests";
import { ReadinessSidebar } from "./features/readiness/ReadinessSidebar";
import { useDependencyReadiness } from "./features/readiness/useDependencyReadiness";

interface AppHeaderProps {
  isRefreshingPullRequests: boolean;
  onRefreshPullRequests: () => void;
}

function AppHeader({ isRefreshingPullRequests, onRefreshPullRequests }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-line border-b px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="grid size-8 place-items-center rounded-md border border-line bg-white/[0.04] text-sm font-semibold">
          pr
        </div>
        <div>
          <h1 className="font-semibold leading-5">pr-rosey</h1>
          <p className={tokens.text.meta}>Local pull request command center</p>
        </div>
      </div>
      <button
        className={tokens.button.secondary}
        disabled={isRefreshingPullRequests}
        type="button"
        onClick={onRefreshPullRequests}
      >
        {isRefreshingPullRequests ? "Refreshing" : "Refresh PRs"}
      </button>
    </header>
  );
}

function App() {
  const readiness = useDependencyReadiness();
  const pullRequests = useAuthoredPullRequests();

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-[#10120f] shadow-panel">
          <AppHeader
            isRefreshingPullRequests={pullRequests.isRefreshing}
            onRefreshPullRequests={pullRequests.refresh}
          />

          <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <ReadinessSidebar
              checkedAt={readiness.checkedAt}
              dependencies={readiness.dependencies}
              isChecking={readiness.isChecking}
              onRunChecks={readiness.runChecks}
            />

            <PullRequestsPanel
              checkedAt={readiness.checkedAt}
              discovery={pullRequests.discovery}
              error={pullRequests.error}
              isRefreshing={pullRequests.isRefreshing}
              openingPullRequestUrl={pullRequests.openingUrl}
              readinessSummaryText={readiness.summary}
              onOpenPullRequest={pullRequests.openPullRequest}
              onRefreshPullRequests={pullRequests.refresh}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
