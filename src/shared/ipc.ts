import type { DependencyReadiness } from "./dependencies.js";
import type { PullRequestDiscovery } from "./pullRequests.js";

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
