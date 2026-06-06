export type LocalRepositoryInspectionStatus =
  | "ready"
  | "not-git-repository"
  | "missing-origin"
  | "unsupported-origin"
  | "error";

export type LocalRepositoryInspection = {
  localPath: string;
  status: LocalRepositoryInspectionStatus;
  message: string;
  remoteUrl: string | null;
  repositoryNameWithOwner: string | null;
};

export type RepositoryMapping = {
  repositoryNameWithOwner: string;
  localPath: string;
  remoteUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RepositoryMappingList = {
  loadedAt: string;
  mappings: RepositoryMapping[];
};

export type SaveRepositoryMappingInput = {
  repositoryNameWithOwner: string;
  localPath: string;
};

const githubNameWithOwnerPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function stripGitSuffix(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

function normalizeNameWithOwner(value: string): string | null {
  const trimmed = stripGitSuffix(value.trim()).replace(/^\/+|\/+$/g, "");

  if (!githubNameWithOwnerPattern.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function repositoryMappingKey(repositoryNameWithOwner: string): string {
  return repositoryNameWithOwner.toLowerCase();
}

export function normalizeRepositoryNameWithOwner(value: string): string | null {
  const directName = normalizeNameWithOwner(value);

  if (directName) {
    return directName;
  }

  return repositoryNameWithOwnerFromRemoteUrl(value);
}

export function repositoryNameWithOwnerFromRemoteUrl(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  const scpLikeSshMatch = /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i.exec(trimmed);

  if (scpLikeSshMatch) {
    return normalizeNameWithOwner(scpLikeSshMatch[1]);
  }

  try {
    const parsedUrl = new URL(trimmed);

    if (parsedUrl.hostname.toLowerCase() !== "github.com") {
      return null;
    }

    return normalizeNameWithOwner(parsedUrl.pathname);
  } catch {
    return null;
  }
}
