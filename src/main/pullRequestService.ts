import type { PullRequestDiscovery, PullRequestSummary } from "../shared/pullRequests.js";
import { runShellCommand, type ShellCommandError } from "./shellCommand.js";

const pageSize = 100;
const maxPages = 10;

const authoredPullRequestsQuery = `
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
        isDraft
        headRefName
        updatedAt
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
  isDraft?: unknown;
  headRefName?: unknown;
  updatedAt?: unknown;
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
): Promise<GraphQlSearchResponse> {
  const args = [
    "api",
    "graphql",
    "-f",
    `query=${authoredPullRequestsQuery}`,
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
    throw new Error(
      commandFailureMessage(
        error as ShellCommandError,
        "Could not fetch authored pull requests with gh.",
      ),
    );
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
    title: node.title,
    number: node.number,
    url: node.url,
    isDraft: node.isDraft,
    headRefName: node.headRefName,
    updatedAt: node.updatedAt,
  };
}

export async function fetchAuthoredOpenPullRequests(): Promise<PullRequestDiscovery> {
  const viewerLogin = await getAuthenticatedUserLogin();
  const searchQuery = `is:pr is:open author:${viewerLogin} sort:updated-desc`;
  const pullRequests: PullRequestSummary[] = [];
  let cursor: string | null = null;
  let totalCount = 0;
  let isLimited = false;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await runPullRequestSearch(searchQuery, cursor);
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
