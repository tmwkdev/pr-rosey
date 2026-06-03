import { runShellCommand, type ShellCommandError } from "@/main/shellCommand";
import type {
  PullRequestCiCheck,
  PullRequestCiCheckState,
  PullRequestCiStatus,
  PullRequestCiStatusState,
  PullRequestDiscovery,
  PullRequestSummary,
} from "@/shared/pullRequests";

const pageSize = 100;
const maxPages = 10;

const pullRequestsSearchQuery = `
query($searchQuery: String!, $first: Int!, $cursor: String) {
  search(query: $searchQuery, type: ISSUE, first: $first, after: $cursor) {
    issueCount
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on PullRequest {
        repository {
          name
          nameWithOwner
          owner {
            login
          }
        }
        title
        number
        url
        author {
          login
        }
        isDraft
        headRefName
        updatedAt
        commits(last: 1) {
          nodes {
            commit {
              oid
              statusCheckRollup {
                state
                contexts(first: 100) {
                  totalCount
                  nodes {
                    __typename
                    ... on CheckRun {
                      name
                      status
                      conclusion
                      detailsUrl
                    }
                    ... on StatusContext {
                      context
                      state
                      targetUrl
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

type GraphQlPullRequestNode = {
  repository?: {
    name?: unknown;
    nameWithOwner?: unknown;
    owner?: {
      login?: unknown;
    };
  };
  title?: unknown;
  number?: unknown;
  url?: unknown;
  author?: {
    login?: unknown;
  } | null;
  isDraft?: unknown;
  headRefName?: unknown;
  updatedAt?: unknown;
  commits?: {
    nodes?: unknown;
  };
};

type GraphQlSearchResponse = {
  data?: {
    search?: {
      issueCount?: unknown;
      pageInfo?: {
        hasNextPage?: unknown;
        endCursor?: unknown;
      };
      nodes?: unknown;
    };
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

function commandFailureMessage(error: ShellCommandError, fallback: string): string {
  const detail = error.stderr?.trim() || error.stdout?.trim();
  return detail ? `${fallback} ${detail}` : fallback;
}

function parseJson<T>(raw: string, errorMessage: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(errorMessage);
  }
}

function createEmptyCiStatus(
  state: PullRequestCiStatusState,
  commitOid: string | null,
): PullRequestCiStatus {
  return {
    state,
    commitOid,
    totalCount: 0,
    passingCount: 0,
    failingCount: 0,
    pendingCount: 0,
    skippedCount: 0,
    unknownCount: 0,
    checks: [],
    isIncomplete: false,
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toCheckRunState(status: unknown, conclusion: unknown): PullRequestCiCheckState {
  if (typeof status === "string" && status !== "COMPLETED") {
    return "pending";
  }

  switch (conclusion) {
    case "SUCCESS":
      return "passing";
    case "NEUTRAL":
    case "SKIPPED":
      return "skipped";
    case "ACTION_REQUIRED":
    case "CANCELLED":
    case "FAILURE":
    case "STALE":
    case "STARTUP_FAILURE":
    case "TIMED_OUT":
      return "failing";
    default:
      return "unknown";
  }
}

function toStatusContextState(state: unknown): PullRequestCiCheckState {
  switch (state) {
    case "SUCCESS":
      return "passing";
    case "FAILURE":
    case "ERROR":
      return "failing";
    case "EXPECTED":
    case "PENDING":
      return "pending";
    default:
      return "unknown";
  }
}

function toCiCheck(rawCheck: unknown): PullRequestCiCheck | null {
  if (!rawCheck || typeof rawCheck !== "object") {
    return null;
  }

  const check = rawCheck as {
    __typename?: unknown;
    name?: unknown;
    context?: unknown;
    status?: unknown;
    conclusion?: unknown;
    state?: unknown;
    detailsUrl?: unknown;
    targetUrl?: unknown;
  };

  if (check.__typename === "CheckRun") {
    const name = stringOrNull(check.name);

    if (!name) {
      return null;
    }

    return {
      name,
      state: toCheckRunState(check.status, check.conclusion),
      url: stringOrNull(check.detailsUrl),
    };
  }

  if (check.__typename === "StatusContext") {
    const name = stringOrNull(check.context);

    if (!name) {
      return null;
    }

    return {
      name,
      state: toStatusContextState(check.state),
      url: stringOrNull(check.targetUrl),
    };
  }

  return null;
}

function toCiStatusState(state: unknown, totalCount: number): PullRequestCiStatusState {
  if (totalCount === 0) {
    return "no-checks";
  }

  switch (state) {
    case "SUCCESS":
      return "passing";
    case "FAILURE":
      return "failing";
    case "ERROR":
      return "error";
    case "EXPECTED":
    case "PENDING":
      return "pending";
    default:
      return "unknown";
  }
}

function toPullRequestCiStatus(node: GraphQlPullRequestNode): PullRequestCiStatus {
  const commitNode = Array.isArray(node.commits?.nodes) ? node.commits.nodes[0] : null;

  if (!commitNode || typeof commitNode !== "object") {
    return createEmptyCiStatus("unknown", null);
  }

  const commit = (commitNode as { commit?: unknown }).commit;

  if (!commit || typeof commit !== "object") {
    return createEmptyCiStatus("unknown", null);
  }

  const commitData = commit as {
    oid?: unknown;
    statusCheckRollup?: {
      state?: unknown;
      contexts?: {
        totalCount?: unknown;
        nodes?: unknown;
      };
    } | null;
  };
  const commitOid = stringOrNull(commitData.oid);

  if (!commitData.statusCheckRollup) {
    return createEmptyCiStatus("no-checks", commitOid);
  }

  const rawChecks = Array.isArray(commitData.statusCheckRollup.contexts?.nodes)
    ? commitData.statusCheckRollup.contexts.nodes
    : [];
  const checks = rawChecks.flatMap((check) => {
    const ciCheck = toCiCheck(check);
    return ciCheck ? [ciCheck] : [];
  });
  const totalCount =
    typeof commitData.statusCheckRollup.contexts?.totalCount === "number"
      ? commitData.statusCheckRollup.contexts.totalCount
      : checks.length;

  const counts = checks.reduce(
    (result, check) => {
      result[check.state] += 1;
      return result;
    },
    {
      passing: 0,
      failing: 0,
      pending: 0,
      skipped: 0,
      unknown: 0,
    } satisfies Record<PullRequestCiCheckState, number>,
  );

  return {
    state: toCiStatusState(commitData.statusCheckRollup.state, totalCount),
    commitOid,
    totalCount,
    passingCount: counts.passing,
    failingCount: counts.failing,
    pendingCount: counts.pending,
    skippedCount: counts.skipped,
    unknownCount: counts.unknown,
    checks,
    isIncomplete: totalCount > checks.length,
  };
}

async function getAuthenticatedUserLogin(): Promise<string> {
  try {
    const result = await runShellCommand("gh", ["api", "user", "--jq", ".login"]);
    const login = result.stdout.trim();

    if (!login) {
      throw new Error("GitHub CLI did not return an authenticated user login.");
    }

    return login;
  } catch (error) {
    throw new Error(
      commandFailureMessage(
        error as ShellCommandError,
        "Could not identify the authenticated GitHub user with gh.",
      ),
    );
  }
}

async function runPullRequestSearch(
  searchQuery: string,
  cursor: string | null,
  errorMessage: string,
): Promise<GraphQlSearchResponse> {
  const args = [
    "api",
    "graphql",
    "-f",
    `query=${pullRequestsSearchQuery}`,
    "-f",
    `searchQuery=${searchQuery}`,
    "-F",
    `first=${pageSize}`,
  ];

  if (cursor) {
    args.push("-f", `cursor=${cursor}`);
  }

  let stdout: string;

  try {
    const result = await runShellCommand("gh", args);
    stdout = result.stdout;
  } catch (error) {
    throw new Error(commandFailureMessage(error as ShellCommandError, errorMessage));
  }

  return parseJson<GraphQlSearchResponse>(
    stdout,
    "GitHub CLI returned an unreadable pull request response.",
  );
}

function toPullRequestSummary(node: GraphQlPullRequestNode): PullRequestSummary | null {
  const owner = node.repository?.owner?.login;
  const name = node.repository?.name;
  const nameWithOwner = node.repository?.nameWithOwner;
  const authorLogin = stringOrNull(node.author?.login) ?? "unknown";

  if (
    typeof owner !== "string" ||
    typeof name !== "string" ||
    typeof nameWithOwner !== "string" ||
    typeof node.title !== "string" ||
    typeof node.number !== "number" ||
    typeof node.url !== "string" ||
    typeof node.isDraft !== "boolean" ||
    typeof node.headRefName !== "string" ||
    typeof node.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    repository: {
      owner,
      name,
      nameWithOwner,
    },
    authorLogin,
    title: node.title,
    number: node.number,
    url: node.url,
    isDraft: node.isDraft,
    headRefName: node.headRefName,
    updatedAt: node.updatedAt,
    ciStatus: toPullRequestCiStatus(node),
  };
}

async function fetchOpenPullRequests(
  searchQuery: string,
  viewerLogin: string,
  errorMessage: string,
): Promise<PullRequestDiscovery> {
  const pullRequests: PullRequestSummary[] = [];
  let cursor: string | null = null;
  let totalCount = 0;
  let isLimited = false;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await runPullRequestSearch(searchQuery, cursor, errorMessage);
    const search = response.data?.search;

    if (!search) {
      throw new Error("GitHub CLI returned a pull request response without search data.");
    }

    if (typeof search.issueCount === "number") {
      totalCount = search.issueCount;
    }

    if (Array.isArray(search.nodes)) {
      for (const node of search.nodes) {
        const pullRequest = toPullRequestSummary(node as GraphQlPullRequestNode);

        if (pullRequest) {
          pullRequests.push(pullRequest);
        }
      }
    }

    const hasNextPage = search.pageInfo?.hasNextPage === true;
    const endCursor = search.pageInfo?.endCursor;

    if (!hasNextPage) {
      break;
    }

    if (typeof endCursor !== "string") {
      throw new Error("GitHub CLI returned paginated pull requests without a next cursor.");
    }

    cursor = endCursor;
    isLimited = page === maxPages - 1;
  }

  return {
    fetchedAt: nowIso(),
    viewerLogin,
    pullRequests,
    totalCount,
    isLimited,
  };
}

export async function fetchAuthoredOpenPullRequests(): Promise<PullRequestDiscovery> {
  const viewerLogin = await getAuthenticatedUserLogin();
  return fetchOpenPullRequests(
    `is:pr is:open author:${viewerLogin} sort:updated-desc`,
    viewerLogin,
    "Could not fetch authored pull requests with gh.",
  );
}

export async function fetchReviewRequestedOpenPullRequests(): Promise<PullRequestDiscovery> {
  const viewerLogin = await getAuthenticatedUserLogin();
  return fetchOpenPullRequests(
    `is:pr is:open review-requested:${viewerLogin} sort:updated-desc`,
    viewerLogin,
    "Could not fetch review-requested pull requests with gh.",
  );
}
