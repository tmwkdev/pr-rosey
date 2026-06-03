import type { DependencyReadiness } from "@/shared/dependencies";
import type { PullRequestDiscovery } from "@/shared/pullRequests";

export const ipcChannels = {
  checkDependencies: "dependencies:check",
  fetchPullRequests: "pull-requests:fetch",
  fetchReviewRequestedPullRequests: "pull-requests:fetch-review-requested",
  openPullRequestUrl: "pull-requests:open-url",
} as const;

export type PrRoseyApi = {
  dependencies: {
    check: () => Promise<DependencyReadiness>;
  };
  pullRequests: {
    fetchAuthoredOpen: () => Promise<PullRequestDiscovery>;
    fetchReviewRequestedOpen: () => Promise<PullRequestDiscovery>;
    openUrl: (url: string) => Promise<void>;
  };
};
