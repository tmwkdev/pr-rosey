import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { runShellCommand, type ShellCommandResult } from "@pr-rosey/desktop/main/shellCommand";
import type {
  LocalRepositoryInspection,
  RepositoryMapping,
  RepositoryMappingList,
  SaveRepositoryMappingInput,
} from "@pr-rosey/desktop/shared/repositoryMappings";
import {
  normalizeRepositoryNameWithOwner,
  repositoryMappingKey,
  repositoryNameWithOwnerFromRemoteUrl,
} from "@pr-rosey/desktop/shared/repositoryMappings";

type ShellCommandRunner = (command: string, args?: string[]) => Promise<ShellCommandResult>;

export type RepositoryMappingServiceOptions = {
  userDataPath: string;
  runCommand?: ShellCommandRunner;
  now?: () => string;
};

type StoredRepositoryMappings = {
  version: 1;
  mappings: RepositoryMapping[];
};

const storageFileName = "repository-mappings.json";
const mutationQueues = new Map<string, Promise<void>>();

function nowIso(options: RepositoryMappingServiceOptions): string {
  return options.now?.() ?? new Date().toISOString();
}

function getRunner(options: RepositoryMappingServiceOptions): ShellCommandRunner {
  return options.runCommand ?? runShellCommand;
}

export function getRepositoryMappingsFilePath(userDataPath: string): string {
  return path.join(userDataPath, storageFileName);
}

function toStoredRepositoryMappings(rawValue: unknown): StoredRepositoryMappings {
  if (!rawValue || typeof rawValue !== "object") {
    return { version: 1, mappings: [] };
  }

  const rawMappings = (rawValue as { mappings?: unknown }).mappings;

  if (!Array.isArray(rawMappings)) {
    return { version: 1, mappings: [] };
  }

  const mappings = rawMappings.flatMap((rawMapping) => {
    if (!rawMapping || typeof rawMapping !== "object") {
      return [];
    }

    const mapping = rawMapping as Partial<RepositoryMapping>;

    if (
      typeof mapping.repositoryNameWithOwner !== "string" ||
      typeof mapping.localPath !== "string" ||
      typeof mapping.createdAt !== "string" ||
      typeof mapping.updatedAt !== "string"
    ) {
      return [];
    }

    return [
      {
        repositoryNameWithOwner: mapping.repositoryNameWithOwner,
        localPath: mapping.localPath,
        remoteUrl: typeof mapping.remoteUrl === "string" ? mapping.remoteUrl : null,
        createdAt: mapping.createdAt,
        updatedAt: mapping.updatedAt,
      },
    ];
  });

  return { version: 1, mappings };
}

async function readStoredMappings(
  options: RepositoryMappingServiceOptions,
): Promise<StoredRepositoryMappings> {
  try {
    const rawFile = await readFile(getRepositoryMappingsFilePath(options.userDataPath), "utf8");
    return toStoredRepositoryMappings(JSON.parse(rawFile));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, mappings: [] };
    }

    throw new Error("Repository mappings could not be read.");
  }
}

async function writeStoredMappings(
  options: RepositoryMappingServiceOptions,
  mappings: RepositoryMapping[],
): Promise<void> {
  await mkdir(options.userDataPath, { recursive: true });

  const filePath = getRepositoryMappingsFilePath(options.userDataPath);
  const temporaryFilePath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const storedMappings: StoredRepositoryMappings = { version: 1, mappings };

  await writeFile(temporaryFilePath, `${JSON.stringify(storedMappings, null, 2)}\n`, "utf8");
  await rename(temporaryFilePath, filePath);
}

async function withRepositoryMappingsMutation<T>(
  options: RepositoryMappingServiceOptions,
  mutation: () => Promise<T>,
): Promise<T> {
  const queueKey = path.resolve(options.userDataPath);
  const previousMutation = mutationQueues.get(queueKey) ?? Promise.resolve();
  let releaseCurrentMutation: () => void = () => {};
  const currentMutation = new Promise<void>((resolve) => {
    releaseCurrentMutation = resolve;
  });
  const queuedMutation = previousMutation.catch(() => undefined).then(() => currentMutation);

  mutationQueues.set(queueKey, queuedMutation);

  await previousMutation.catch(() => undefined);

  try {
    return await mutation();
  } finally {
    releaseCurrentMutation();

    if (mutationQueues.get(queueKey) === queuedMutation) {
      mutationQueues.delete(queueKey);
    }
  }
}

function sortMappings(mappings: RepositoryMapping[]): RepositoryMapping[] {
  return [...mappings].sort((left, right) =>
    left.repositoryNameWithOwner.localeCompare(right.repositoryNameWithOwner),
  );
}

export async function listRepositoryMappings(
  options: RepositoryMappingServiceOptions,
): Promise<RepositoryMappingList> {
  const storedMappings = await readStoredMappings(options);

  return {
    loadedAt: nowIso(options),
    mappings: sortMappings(storedMappings.mappings),
  };
}

export async function inspectLocalRepository(
  options: RepositoryMappingServiceOptions,
  localPath: string,
): Promise<LocalRepositoryInspection> {
  const normalizedPath = path.resolve(localPath);
  const runCommand = getRunner(options);

  try {
    const insideWorkTree = await runCommand("git", [
      "-C",
      normalizedPath,
      "rev-parse",
      "--is-inside-work-tree",
    ]);

    if (insideWorkTree.stdout.trim() !== "true") {
      return {
        localPath: normalizedPath,
        status: "not-git-repository",
        message: "Choose a folder inside a Git repository.",
        remoteUrl: null,
        repositoryNameWithOwner: null,
      };
    }
  } catch {
    return {
      localPath: normalizedPath,
      status: "not-git-repository",
      message: "Choose a folder inside a Git repository.",
      remoteUrl: null,
      repositoryNameWithOwner: null,
    };
  }

  let repositoryRootPath = normalizedPath;

  try {
    const rootResult = await runCommand("git", [
      "-C",
      normalizedPath,
      "rev-parse",
      "--show-toplevel",
    ]);
    const rootPath = rootResult.stdout.trim();

    if (rootPath) {
      repositoryRootPath = rootPath;
    }
  } catch {
    return {
      localPath: normalizedPath,
      status: "error",
      message: "Git could not resolve the repository root.",
      remoteUrl: null,
      repositoryNameWithOwner: null,
    };
  }

  let remoteUrl: string | null = null;

  try {
    const remoteResult = await runCommand("git", [
      "-C",
      repositoryRootPath,
      "remote",
      "get-url",
      "origin",
    ]);
    remoteUrl = remoteResult.stdout.trim() || null;
  } catch {
    return {
      localPath: repositoryRootPath,
      status: "missing-origin",
      message: "This Git repository has no origin remote. Enter owner/repo manually.",
      remoteUrl: null,
      repositoryNameWithOwner: null,
    };
  }

  const repositoryNameWithOwner = remoteUrl
    ? repositoryNameWithOwnerFromRemoteUrl(remoteUrl)
    : null;

  if (!repositoryNameWithOwner) {
    return {
      localPath: repositoryRootPath,
      status: "unsupported-origin",
      message: "Origin is not a github.com remote. Enter owner/repo manually.",
      remoteUrl,
      repositoryNameWithOwner: null,
    };
  }

  return {
    localPath: repositoryRootPath,
    status: "ready",
    message: `Detected ${repositoryNameWithOwner} from origin.`,
    remoteUrl,
    repositoryNameWithOwner,
  };
}

export async function saveRepositoryMapping(
  options: RepositoryMappingServiceOptions,
  input: SaveRepositoryMappingInput,
): Promise<RepositoryMapping> {
  const repositoryNameWithOwner = normalizeRepositoryNameWithOwner(input.repositoryNameWithOwner);

  if (!repositoryNameWithOwner) {
    throw new Error("Enter a GitHub repository as owner/repo.");
  }

  if (!input.localPath.trim()) {
    throw new Error("Choose a local clone path.");
  }

  const inspection = await inspectLocalRepository(options, input.localPath);

  if (inspection.status === "not-git-repository" || inspection.status === "error") {
    throw new Error(inspection.message);
  }

  if (
    inspection.repositoryNameWithOwner &&
    repositoryMappingKey(inspection.repositoryNameWithOwner) !==
      repositoryMappingKey(repositoryNameWithOwner)
  ) {
    throw new Error(
      `Selected clone belongs to ${inspection.repositoryNameWithOwner}, not ${repositoryNameWithOwner}.`,
    );
  }

  return withRepositoryMappingsMutation(options, async () => {
    const storedMappings = await readStoredMappings(options);
    const existingMapping = storedMappings.mappings.find(
      (mapping) =>
        repositoryMappingKey(mapping.repositoryNameWithOwner) ===
        repositoryMappingKey(repositoryNameWithOwner),
    );
    const savedAt = nowIso(options);
    const nextMapping: RepositoryMapping = {
      repositoryNameWithOwner,
      localPath: inspection.localPath,
      remoteUrl: inspection.remoteUrl,
      createdAt: existingMapping?.createdAt ?? savedAt,
      updatedAt: savedAt,
    };
    const nextMappings = sortMappings([
      ...storedMappings.mappings.filter(
        (mapping) =>
          repositoryMappingKey(mapping.repositoryNameWithOwner) !==
          repositoryMappingKey(repositoryNameWithOwner),
      ),
      nextMapping,
    ]);

    await writeStoredMappings(options, nextMappings);

    return nextMapping;
  });
}

export async function removeRepositoryMapping(
  options: RepositoryMappingServiceOptions,
  repositoryNameWithOwner: string,
): Promise<RepositoryMappingList> {
  const normalizedRepositoryNameWithOwner =
    normalizeRepositoryNameWithOwner(repositoryNameWithOwner);

  if (!normalizedRepositoryNameWithOwner) {
    throw new Error("Repository mapping key must be owner/repo.");
  }

  return withRepositoryMappingsMutation(options, async () => {
    const storedMappings = await readStoredMappings(options);
    const nextMappings = sortMappings(
      storedMappings.mappings.filter(
        (mapping) =>
          repositoryMappingKey(mapping.repositoryNameWithOwner) !==
          repositoryMappingKey(normalizedRepositoryNameWithOwner),
      ),
    );

    await writeStoredMappings(options, nextMappings);

    return {
      loadedAt: nowIso(options),
      mappings: nextMappings,
    };
  });
}
