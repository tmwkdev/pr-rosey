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
    return "Checking local tools...";
  }

  if (dependencies.every((dependency) => dependency.status === "ready")) {
    return "Your machine is ready for the next pr-rosey step.";
  }

  return "Resolve the items below before using future PR features.";
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

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-10">
        <div className="max-w-3xl space-y-4">
          <p className={tokens.label.eyebrow}>Setup readiness</p>
          <h1 className="text-5xl font-bold">pr-rosey</h1>
          <p className="max-w-2xl text-lg leading-8 text-ink/75">
            A local-first desktop app for watching your GitHub pull requests and preparing useful
            prompts when CI needs attention.
          </p>
        </div>

        <section className={`${tokens.card.panel} overflow-hidden`}>
          <div className="flex flex-col gap-4 border-ink/10 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Dependency readiness</h2>
              <p className="text-sm text-ink/70">{summary}</p>
            </div>
            <button
              className={tokens.button.primary}
              disabled={isChecking}
              type="button"
              onClick={runDependencyChecks}
            >
              {isChecking ? "Checking..." : "Rerun checks"}
            </button>
          </div>

          <div className="divide-y divide-ink/10">
            {dependencies.map((dependency) => (
              <div
                className="grid gap-3 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                key={dependency.id}
              >
                <div className="space-y-1">
                  <h3 className="font-semibold">{dependency.label}</h3>
                  <p className="text-sm leading-6 text-ink/70">{dependency.message}</p>
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${tokens.status[dependency.status]}`}
                >
                  {statusLabels[dependency.status]}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-ink/[0.03] px-6 py-4 text-sm text-ink/60">
            Last checked: {formatCheckedAt(readiness)}
          </div>
        </section>

        <section className={`${tokens.card.section} p-5`}>
          <p className="text-sm leading-6 text-ink/70">
            Step 1 only verifies local readiness. PR discovery, CI inspection, prompt generation,
            and agent handoff are intentionally not implemented yet.
          </p>
        </section>
      </section>
    </main>
  );
}

export default App;
