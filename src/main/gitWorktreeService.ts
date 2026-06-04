import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { runShellCommand, type ShellCommandResult } from "@/main/shellCommand";
import type { PullRequestSummary } from "@/shared/pullRequests";
import type { ManagedWorktree } from "@/shared/runner";

export type WorktreeCommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string; timeoutMs?: number },
) => Promise<ShellCommandResult>;

export type ManagedWorktreeOptions = {
  managedWorktreeRoot: string;
  runCommand?: WorktreeCommandRunner;
};

type GitCommandSpec = {
  command: "git";
  args: string[];
};

const managedBranchPrefix = "pr-rosey";
const managedRemoteRefPrefix = "refs/remotes/pr-rosey";

export function createPullRequestFetchCommand(pullRequestNumber: number): GitCommandSpec {
  const remoteRef = createManagedRemoteRef(pullRequestNumber);

  return {
    command: "git",
    args: ["fetch", "origin", `pull/${pullRequestNumber}/head:${remoteRef}`],
  };
}

export function createWorktreeAddCommand(
  worktreePath: string,
  pullRequestNumber: number,
): GitCommandSpec {
  return {
    command: "git",
    args: [
      "worktree",
      "add",
      "-B",
      createManagedBranchName(pullRequestNumber),
      worktreePath,
      createManagedRemoteRef(pullRequestNumber),
    ],
  };
}

export function createWorktreeUpdateCommand(pullRequestNumber: number): GitCommandSpec {
  return {
    command: "git",
    args: [
      "checkout",
      "-B",
      createManagedBranchName(pullRequestNumber),
      createManagedRemoteRef(pullRequestNumber),
    ],
  };
}

export async function createOrUpdateManagedWorktree(
  pullRequest: PullRequestSummary,
  sourceRepoRoot: string,
  options: ManagedWorktreeOptions,
): Promise<ManagedWorktree> {
  const runCommand = options.runCommand ?? runShellCommand;
  const trimmedSourceRepoRoot = sourceRepoRoot.trim();

  if (!path.isAbsolute(trimmedSourceRepoRoot)) {
    throw new Error("Local repository path must be absolute.");
  }

  const normalizedSourceRepoRoot = path.resolve(sourceRepoRoot);
  const repositorySlug = pullRequest.repository.nameWithOwner;
  const worktreePath = getManagedWorktreePath(
    options.managedWorktreeRoot,
    repositorySlug,
    pullRequest.number,
  );

  await assertTrustedSourceRepository(runCommand, normalizedSourceRepoRoot, pullRequest);
  await assertSafeManagedWorktree(runCommand, normalizedSourceRepoRoot, worktreePath, pullRequest);
  await mkdir(path.dirname(worktreePath), { recursive: true });

  const fetchCommand = createPullRequestFetchCommand(pullRequest.number);
  await runGit(runCommand, normalizedSourceRepoRoot, fetchCommand.args);

  if (existsSync(worktreePath)) {
    const updateCommand = createWorktreeUpdateCommand(pullRequest.number);
    await runGit(runCommand, worktreePath, updateCommand.args);
  } else {
    const addCommand = createWorktreeAddCommand(worktreePath, pullRequest.number);
    await runGit(runCommand, normalizedSourceRepoRoot, addCommand.args);
  }

  const headSha = await readHeadSha(runCommand, worktreePath);

  return {
    kind: "local-worktree",
    repository: repositorySlug,
    pullRequestNumber: pullRequest.number,
    sourceRepoRoot: normalizedSourceRepoRoot,
    worktreePath,
    headRefName: pullRequest.headRefName,
    headSha,
  };
}

export function getManagedWorktreePath(
  managedWorktreeRoot: string,
  repositorySlug: string,
  pullRequestNumber: number,
): string {
  return path.join(
    managedWorktreeRoot,
    sanitizePathSegment(repositorySlug),
    `pr-${pullRequestNumber}`,
  );
}

async function assertTrustedSourceRepository(
  runCommand: WorktreeCommandRunner,
  sourceRepoRoot: string,
  pullRequest: PullRequestSummary,
): Promise<void> {
  const topLevel = (
    await runGit(runCommand, sourceRepoRoot, ["rev-parse", "--show-toplevel"])
  ).stdout.trim();

  if (path.resolve(topLevel) !== sourceRepoRoot) {
    throw new Error("Local repository path must point at the git repository root.");
  }

  const originUrl = (
    await runGit(runCommand, sourceRepoRoot, ["remote", "get-url", "origin"])
  ).stdout.trim();

  if (
    !doesRemoteMatchRepository(originUrl, pullRequest.repository.owner, pullRequest.repository.name)
  ) {
    throw new Error(
      `Local repository origin does not match ${pullRequest.repository.nameWithOwner}.`,
    );
  }
}

async function assertSafeManagedWorktree(
  runCommand: WorktreeCommandRunner,
  sourceRepoRoot: string,
  worktreePath: string,
  pullRequest: PullRequestSummary,
): Promise<void> {
  if (path.resolve(worktreePath) === sourceRepoRoot) {
    throw new Error("Managed worktree cannot be the source repository checkout.");
  }

  if (!existsSync(worktreePath)) {
    return;
  }

  const topLevel = (
    await runGit(runCommand, worktreePath, ["rev-parse", "--show-toplevel"])
  ).stdout.trim();

  if (path.resolve(topLevel) !== path.resolve(worktreePath)) {
    throw new Error("Existing managed worktree path is not a git worktree root.");
  }

  const originUrl = (
    await runGit(runCommand, worktreePath, ["remote", "get-url", "origin"])
  ).stdout.trim();

  if (
    !doesRemoteMatchRepository(originUrl, pullRequest.repository.owner, pullRequest.repository.name)
  ) {
    throw new Error(
      `Existing managed worktree origin does not match ${pullRequest.repository.nameWithOwner}.`,
    );
  }

  const dirtyOutput = (await runGit(runCommand, worktreePath, ["status", "--porcelain"])).stdout;

  if (dirtyOutput.trim()) {
    throw new Error("Existing managed worktree has uncommitted changes. Aborting babysit start.");
  }
}

async function readHeadSha(
  runCommand: WorktreeCommandRunner,
  worktreePath: string,
): Promise<string | null> {
  try {
    const result = await runGit(runCommand, worktreePath, ["rev-parse", "HEAD"]);
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

async function runGit(
  runCommand: WorktreeCommandRunner,
  cwd: string,
  args: string[],
): Promise<ShellCommandResult> {
  return runCommand("git", args, { cwd, timeoutMs: 30_000 });
}

function createManagedBranchName(pullRequestNumber: number): string {
  return `${managedBranchPrefix}/pr-${pullRequestNumber}`;
}

function createManagedRemoteRef(pullRequestNumber: number): string {
  return `${managedRemoteRefPrefix}/pr-${pullRequestNumber}`;
}

function doesRemoteMatchRepository(remoteUrl: string, owner: string, name: string): boolean {
  const normalizedRemote = remoteUrl.toLowerCase().replace(/\.git$/, "");
  const normalizedRepository = `${owner}/${name}`.toLowerCase();

  return (
    normalizedRemote.endsWith(`github.com/${normalizedRepository}`) ||
    normalizedRemote.endsWith(`github.com:${normalizedRepository}`)
  );
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "__");
}
