import {
  createLoadingDependencies,
  createUnknownDependency,
  type DependencyCheckResult,
  type DependencyReadiness,
  dependencyIds,
} from "@pr-rosey/desktop/shared/dependencies";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function summarizeReadiness(dependencies: DependencyCheckResult[]): string {
  if (dependencies.some((dependency) => dependency.status === "loading")) {
    return "Checking local tools.";
  }

  if (dependencies.every((dependency) => dependency.status === "ready")) {
    return "Local environment is ready.";
  }

  return "Resolve the blocked checks before continuing.";
}

export function useDependencyReadiness() {
  const [readiness, setReadiness] = useState<DependencyReadiness | null>(null);
  const [dependencies, setDependencies] = useState<DependencyCheckResult[]>(initialDependencies);
  const [isChecking, setIsChecking] = useState(false);

  const runChecks = useCallback(async () => {
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
    void runChecks();
  }, [runChecks]);

  const checkedAt = useMemo(() => formatCheckedAt(readiness), [readiness]);
  const summary = useMemo(() => summarizeReadiness(dependencies), [dependencies]);

  return {
    checkedAt,
    dependencies,
    isChecking,
    readiness,
    runChecks,
    summary,
  };
}
