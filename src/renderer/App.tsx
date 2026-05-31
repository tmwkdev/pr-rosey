import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLoadingDependencies,
  createUnknownDependency,
  type DependencyCheckResult,
  type DependencyReadiness,
  dependencyIds,
  statusLabels,
} from "../shared/dependencies";
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

function readinessSummary(dependencies: DependencyCheckResult[]): string {
  if (dependencies.some((dependency) => dependency.status === "loading")) {
    return "Checking local tools.";
  }

  if (dependencies.every((dependency) => dependency.status === "ready")) {
    return "Local environment is ready.";
  }

  return "Resolve the blocked checks before continuing.";
}

function App() {
  const [readiness, setReadiness] = useState<DependencyReadiness | null>(null);
  const [dependencies, setDependencies] = useState<DependencyCheckResult[]>(initialDependencies);
  const [isChecking, setIsChecking] = useState(false);

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

  useEffect(() => {
    void runDependencyChecks();
  }, [runDependencyChecks]);

  const summary = useMemo(() => readinessSummary(dependencies), [dependencies]);
  const readyCount = dependencies.filter((dependency) => dependency.status === "ready").length;
  const issueCount = dependencies.filter((dependency) =>
    ["missing", "error"].includes(dependency.status),
  ).length;

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
              disabled={isChecking}
              type="button"
              onClick={runDependencyChecks}
            >
              {isChecking ? "Checking" : "Refresh"}
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
              </div>
            </aside>

            <section className="flex min-h-0 flex-col p-5 sm:p-7">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <p className={tokens.label.eyebrow}>Environment</p>
                  <h2 className="text-3xl font-semibold">{summary}</h2>
                </div>
                <button
                  className={tokens.button.primary}
                  disabled={isChecking}
                  type="button"
                  onClick={runDependencyChecks}
                >
                  {isChecking ? "Running checks" : "Run checks"}
                </button>
              </div>

              <div className={`${tokens.card.panel} overflow-hidden`}>
                <div className="grid grid-cols-[1fr_auto] border-line border-b px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">
                  <span>Dependency</span>
                  <span>Status</span>
                </div>

                <div className="divide-y divide-line">
                  {dependencies.map((dependency) => (
                    <div
                      className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      key={dependency.id}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={`mt-2 size-2 rounded-full ${tokens.statusDot[dependency.status]}`}
                        />
                        <div className="min-w-0 space-y-1">
                          <h3 className="font-medium">{dependency.label}</h3>
                          <p className="text-sm leading-6 text-muted">{dependency.message}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tokens.status[dependency.status]}`}
                      >
                        {statusLabels[dependency.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-5">
                <section className={`${tokens.card.section} p-4`}>
                  <p className="text-sm leading-6 text-muted">
                    Step 1 is limited to app shell and dependency readiness. PR discovery, CI
                    inspection, prompt generation, and agent handoff remain intentionally out of
                    scope.
                  </p>
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
