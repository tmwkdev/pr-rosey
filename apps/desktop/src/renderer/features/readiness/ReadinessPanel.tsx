import type { DependencyCheckResult } from "@pr-rosey/desktop/shared/dependencies";
import { tokens } from "@pr-rosey/desktop/styles/tokens";

interface ReadinessPanelProps {
  checkedAt: string;
  dependencies: DependencyCheckResult[];
  isChecking: boolean;
}

export function ReadinessPanel({ checkedAt, dependencies, isChecking }: ReadinessPanelProps) {
  const readyCount = dependencies.filter((dependency) => dependency.status === "ready").length;
  const issueCount = dependencies.filter((dependency) =>
    ["missing", "error"].includes(dependency.status),
  ).length;

  return (
    <section className="shrink-0 border-b border-line bg-paper px-5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-medium text-muted">Local tools</span>
          <span className={tokens.text.meta}>{readyCount} ready</span>
          <span className={issueCount > 0 ? "text-rosey" : tokens.text.meta}>
            {issueCount} blocked
          </span>
          <span className={tokens.text.meta}>Last check: {checkedAt}</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {dependencies.map((dependency) => (
            <DependencyStatusItem
              dependency={dependency}
              isChecking={isChecking}
              key={dependency.id}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface DependencyStatusItemProps {
  dependency: DependencyCheckResult;
  isChecking: boolean;
}

function DependencyStatusItem({ dependency, isChecking }: DependencyStatusItemProps) {
  return (
    <div
      className={`${tokens.status.item} opacity-75 transition hover:opacity-100`}
      title={dependency.message}
    >
      <span
        aria-hidden="true"
        className={`${tokens.status.dot} ${getDependencyStatusDotClassName(dependency.status)}`}
      />
      <span className={tokens.status.label}>{dependency.label}</span>
      <span className={tokens.status.value}>{isChecking ? "checking" : dependency.status}</span>
    </div>
  );
}

function getDependencyStatusDotClassName(status: DependencyCheckResult["status"]): string {
  switch (status) {
    case "ready":
      return tokens.statusDot.ready;
    case "missing":
      return tokens.statusDot.missing;
    case "loading":
      return tokens.statusDot.loading;
    case "error":
      return tokens.statusDot.error;
    case "unknown":
      return tokens.statusDot.unknown;
  }
}

export default ReadinessPanel;
