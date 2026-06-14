export const dependencyIds = ["gh", "ghAuth", "git"] as const;

export type DependencyId = (typeof dependencyIds)[number];

export type DependencyStatus = "unknown" | "loading" | "ready" | "missing" | "error";

export type DependencyCheckResult = {
  id: DependencyId;
  label: string;
  status: DependencyStatus;
  message: string;
  checkedAt?: string;
};

export type DependencyReadiness = {
  checkedAt: string;
  dependencies: DependencyCheckResult[];
};

export const dependencyLabels: Record<DependencyId, string> = {
  gh: "GitHub CLI",
  ghAuth: "GitHub CLI authentication",
  git: "Git",
};

export const statusLabels: Record<DependencyStatus, string> = {
  unknown: "Unknown",
  loading: "Loading",
  ready: "Ready",
  missing: "Missing",
  error: "Error",
};

export function createUnknownDependency(id: DependencyId): DependencyCheckResult {
  return {
    id,
    label: dependencyLabels[id],
    status: "unknown",
    message: "Dependency check has not run yet.",
  };
}

export function createLoadingDependencies(): DependencyCheckResult[] {
  return dependencyIds.map((id) => ({
    ...createUnknownDependency(id),
    status: "loading",
    message: "Checking local machine readiness...",
  }));
}
