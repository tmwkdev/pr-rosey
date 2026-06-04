import type { DependencyReadiness } from "@/shared/dependencies";
import type { PullRequestDiscovery } from "@/shared/pullRequests";
import type {
  BabysitStartRequest,
  PiRunnerReadiness,
  RunnerSessionReadResult,
  RunnerSessionStartResult,
  RunnerSessionState,
} from "@/shared/runner";

export const ipcChannels = {
  checkDependencies: "dependencies:check",
  fetchPullRequests: "pull-requests:fetch",
  fetchReviewRequestedPullRequests: "pull-requests:fetch-review-requested",
  openPullRequestUrl: "pull-requests:open-url",
  checkPiRunnerReadiness: "runner:check-pi-readiness",
  startBabysitSession: "runner:start-babysit",
  abortBabysitSession: "runner:abort",
  getBabysitSession: "runner:get-session",
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
  runner: {
    checkPiReadiness: () => Promise<PiRunnerReadiness>;
    startBabysit: (request: BabysitStartRequest) => Promise<RunnerSessionStartResult>;
    abort: () => Promise<RunnerSessionState | null>;
    getCurrentSession: () => Promise<RunnerSessionReadResult>;
  };
};
