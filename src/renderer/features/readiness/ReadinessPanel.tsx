import type { DependencyCheckResult } from "@/shared/dependencies";
import { tokens } from "@/styles/tokens";

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
    <section className="shrink-0 border-b border-line bg-canvas px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-medium text-ink">Local tools</span>
          <span className={tokens.text.meta}>{readyCount} ready</span>
          <span className={issueCount > 0 ? "text-rust" : tokens.text.meta}>
            {issueCount} blocked
          </span>
          <span className={tokens.text.meta}>Last check: {checkedAt}</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {dependencies.map((dependency) => (
            <DependencyStatusPill
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

interface DependencyStatusPillProps {
  dependency: DependencyCheckResult;
  isChecking: boolean;
}

function DependencyStatusPill({ dependency, isChecking }: DependencyStatusPillProps) {
  return (
    <div
      className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${getDependencyStatusClassName(
        dependency.status,
      )}`}
      title={dependency.message}
    >
      <span className="truncate font-medium">{dependency.label}</span>
      <span className="font-mono">{isChecking ? "checking" : dependency.status}</span>
    </div>
  );
}

function getDependencyStatusClassName(status: DependencyCheckResult["status"]): string {
  switch (status) {
    case "ready":
      return tokens.status.ready;
    case "missing":
      return tokens.status.missing;
    case "loading":
      return tokens.status.loading;
    case "error":
      return tokens.status.error;
    case "unknown":
      return tokens.status.unknown;
  }
}

export default ReadinessPanel;
