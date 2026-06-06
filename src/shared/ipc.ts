import type { DependencyReadiness } from "@/shared/dependencies";
import type { PullRequestDiscovery } from "@/shared/pullRequests";
import type {
  LocalRepositoryInspection,
  RepositoryMapping,
  RepositoryMappingList,
  SaveRepositoryMappingInput,
} from "@/shared/repositoryMappings";

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
  navigation: {
    onOpenSettingsPage: (listener: () => void) => () => void;
  };
};
