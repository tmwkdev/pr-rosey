import type { DependencyReadiness } from "@/shared/dependencies";
import type { PullRequestDiscovery } from "@/shared/pullRequests";

export const ipcChannels = {
  checkDependencies: "dependencies:check",
  fetchPullRequests: "pull-requests:fetch",
  openPullRequestUrl: "pull-requests:open-url",
} as const;

export type PrRoseyApi = {
  dependencies: {
    check: () => Promise<DependencyReadiness>;
  };
  pullRequests: {
    fetchAuthoredOpen: () => Promise<PullRequestDiscovery>;
    openUrl: (url: string) => Promise<void>;
  };
};
