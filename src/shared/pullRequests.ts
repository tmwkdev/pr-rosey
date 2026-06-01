export type PullRequestSummary = {
  repository: {
    owner: string;
    name: string;
    nameWithOwner: string;
  };
  title: string;
  number: number;
  url: string;
  isDraft: boolean;
  headRefName: string;
  updatedAt: string;
};

export type PullRequestDiscovery = {
  fetchedAt: string;
  viewerLogin: string;
  pullRequests: PullRequestSummary[];
  totalCount: number;
  isLimited: boolean;
};
