import type { DependencyCheckResult } from "../../../shared/dependencies";
import { tokens } from "../../../styles/tokens";

interface ReadinessSidebarProps {
  checkedAt: string;
  dependencies: DependencyCheckResult[];
  isChecking: boolean;
  onRunChecks: () => void;
}

export function ReadinessSidebar({
  checkedAt,
  dependencies,
  isChecking,
  onRunChecks,
}: ReadinessSidebarProps) {
  const readyCount = dependencies.filter((dependency) => dependency.status === "ready").length;
  const issueCount = dependencies.filter((dependency) =>
    ["missing", "error"].includes(dependency.status),
  ).length;

  return (
    <aside className="border-line border-b bg-white/[0.02] p-5 lg:border-r lg:border-b-0">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className={tokens.label.eyebrow}>Setup readiness</p>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Dependency checks</h2>
            <p className={tokens.text.mutedBody}>
              pr-rosey keeps system access in Electron and verifies the local tools it will depend
              on next.
            </p>
          </div>
        </div>

        <DependencyStats
          checkedAt={checkedAt}
          issueCount={issueCount}
          readyCount={readyCount}
          totalCount={dependencies.length}
        />

        <button
          className={tokens.button.secondary}
          disabled={isChecking}
          type="button"
          onClick={onRunChecks}
        >
          {isChecking ? "Running checks" : "Run checks"}
        </button>
      </div>
    </aside>
  );
}

interface DependencyStatsProps {
  checkedAt: string;
  issueCount: number;
  readyCount: number;
  totalCount: number;
}

function DependencyStats({ checkedAt, issueCount, readyCount, totalCount }: DependencyStatsProps) {
  return (
    <div className={`${tokens.card.section} divide-y divide-line`}>
      <div className={tokens.stat.row}>
        <span className={tokens.stat.label}>Ready</span>
        <span className={tokens.stat.value}>
          {readyCount}/{totalCount}
        </span>
      </div>
      <div className={tokens.stat.row}>
        <span className={tokens.stat.label}>Blocked</span>
        <span className={tokens.stat.value}>{issueCount}</span>
      </div>
      <div className={tokens.stat.row}>
        <span className={tokens.stat.label}>Last run</span>
        <span className="font-mono text-xs text-ink">{checkedAt}</span>
      </div>
    </div>
  );
}
