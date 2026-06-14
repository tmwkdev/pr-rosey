import type { DependencyReadiness } from "@pr-rosey/desktop/shared/dependencies";
import type {
  PiRunnerSessionSnapshot,
  StartPiRepositoryVerificationInput,
} from "@pr-rosey/desktop/shared/piRunner";
import type { PullRequestDiscovery } from "@pr-rosey/desktop/shared/pullRequests";
import type {
  LocalRepositoryInspection,
  RepositoryMapping,
  RepositoryMappingList,
  SaveRepositoryMappingInput,
} from "@pr-rosey/desktop/shared/repositoryMappings";

export const ipcChannels = {
  checkDependencies: "dependencies:check",
  fetchPullRequests: "pull-requests:fetch",
  fetchReviewRequestedPullRequests: "pull-requests:fetch-review-requested",
  chooseLocalRepository: "repository-mappings:choose-local-repository",
  listRepositoryMappings: "repository-mappings:list",
  removeRepositoryMapping: "repository-mappings:remove",
  saveRepositoryMapping: "repository-mappings:save",
  openSettingsPage: "navigation:open-settings-page",
  openPullRequestUrl: "pull-requests:open-url",
  abortPiRunnerSession: "pi-runner:abort-session",
  listPiRunnerSessions: "pi-runner:list-sessions",
  startPiRepositoryVerification: "pi-runner:start-repository-verification",
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
  repositoryMappings: {
    chooseLocalRepository: () => Promise<LocalRepositoryInspection | null>;
    list: () => Promise<RepositoryMappingList>;
    remove: (repositoryNameWithOwner: string) => Promise<RepositoryMappingList>;
    save: (input: SaveRepositoryMappingInput) => Promise<RepositoryMapping>;
  };
  piRunner: {
    abortSession: (sessionId: string) => Promise<PiRunnerSessionSnapshot>;
    listSessions: () => Promise<PiRunnerSessionSnapshot[]>;
    startRepositoryVerification: (
      input: StartPiRepositoryVerificationInput,
    ) => Promise<PiRunnerSessionSnapshot>;
  };
  navigation: {
    onOpenSettingsPage: (listener: () => void) => () => void;
  };
};
