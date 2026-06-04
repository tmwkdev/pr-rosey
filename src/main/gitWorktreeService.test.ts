import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createOrUpdateManagedWorktree,
  createPullRequestFetchCommand,
  createWorktreeAddCommand,
  getManagedWorktreePath,
  type WorktreeCommandRunner,
} from "@/main/gitWorktreeService";
import type { ShellCommandResult } from "@/main/shellCommand";
import type { PullRequestSummary } from "@/shared/pullRequests";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((tempRoot) => rm(tempRoot, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("managed git worktree service", () => {
  it("constructs the PR fetch and worktree add commands", () => {
    expect(createPullRequestFetchCommand(42)).toEqual({
      command: "git",
      args: ["fetch", "origin", "pull/42/head:refs/remotes/pr-rosey/pr-42"],
    });

    expect(createWorktreeAddCommand("/tmp/worktree", 42)).toEqual({
      command: "git",
      args: [
        "worktree",
        "add",
        "-B",
        "pr-rosey/pr-42",
        "/tmp/worktree",
        "refs/remotes/pr-rosey/pr-42",
      ],
    });
  });

  it("creates a managed worktree for a trusted local repository", async () => {
    const tempRoot = await createTempRoot();
    const sourceRepoRoot = path.join(tempRoot, "repo");
    const managedWorktreeRoot = path.join(tempRoot, "managed");
    const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
    const runCommand = createFakeGitRunner(sourceRepoRoot, calls);

    const worktree = await createOrUpdateManagedWorktree(createPullRequest(), sourceRepoRoot, {
      managedWorktreeRoot,
      runCommand,
    });

    expect(worktree.worktreePath).toBe(
      getManagedWorktreePath(managedWorktreeRoot, "octo/hello-world", 42),
    );
    expect(worktree.sourceRepoRoot).toBe(sourceRepoRoot);
    expect(worktree.headSha).toBe("abc123");
    expect(calls).toContainEqual({
      command: "git",
      args: ["fetch", "origin", "pull/42/head:refs/remotes/pr-rosey/pr-42"],
      cwd: sourceRepoRoot,
    });
    expect(calls).toContainEqual({
      command: "git",
      args: [
        "worktree",
        "add",
        "-B",
        "pr-rosey/pr-42",
        worktree.worktreePath,
        "refs/remotes/pr-rosey/pr-42",
      ],
      cwd: sourceRepoRoot,
    });
  });

  it("refuses to update an existing dirty managed worktree", async () => {
    const tempRoot = await createTempRoot();
    const sourceRepoRoot = path.join(tempRoot, "repo");
    const managedWorktreeRoot = path.join(tempRoot, "managed");
    const worktreePath = getManagedWorktreePath(managedWorktreeRoot, "octo/hello-world", 42);
    await mkdir(worktreePath, { recursive: true });

    const runCommand = createFakeGitRunner(sourceRepoRoot, [], {
      dirtyWorktreePath: worktreePath,
    });

    await expect(
      createOrUpdateManagedWorktree(createPullRequest(), sourceRepoRoot, {
        managedWorktreeRoot,
        runCommand,
      }),
    ).rejects.toThrow("Existing managed worktree has uncommitted changes.");
  });

  it("refuses a local repository whose origin does not match the pull request", async () => {
    const tempRoot = await createTempRoot();
    const sourceRepoRoot = path.join(tempRoot, "repo");
    const runCommand = createFakeGitRunner(sourceRepoRoot, [], {
      originUrl: "git@github.com:someone/else.git",
    });

    await expect(
      createOrUpdateManagedWorktree(createPullRequest(), sourceRepoRoot, {
        managedWorktreeRoot: path.join(tempRoot, "managed"),
        runCommand,
      }),
    ).rejects.toThrow("Local repository origin does not match octo/hello-world.");
  });

  it("refuses to reuse an existing clean worktree with an unrelated origin", async () => {
    const tempRoot = await createTempRoot();
    const sourceRepoRoot = path.join(tempRoot, "repo");
    const managedWorktreeRoot = path.join(tempRoot, "managed");
    const worktreePath = getManagedWorktreePath(managedWorktreeRoot, "octo/hello-world", 42);
    await mkdir(worktreePath, { recursive: true });

    const runCommand = createFakeGitRunner(sourceRepoRoot, [], {
      worktreeOriginUrl: "git@github.com:someone/else.git",
    });

    await expect(
      createOrUpdateManagedWorktree(createPullRequest(), sourceRepoRoot, {
        managedWorktreeRoot,
        runCommand,
      }),
    ).rejects.toThrow("Existing managed worktree origin does not match octo/hello-world.");
  });

  it("refuses relative local repository paths before running git commands", async () => {
    const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
    const runCommand = createFakeGitRunner("/absolute/repo", calls);

    await expect(
      createOrUpdateManagedWorktree(createPullRequest(), "relative/repo", {
        managedWorktreeRoot: "/absolute/managed",
        runCommand,
      }),
    ).rejects.toThrow("Local repository path must be absolute.");

    expect(calls).toEqual([]);
  });
});

async function createTempRoot(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "pr-rosey-worktree-test-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}

function createFakeGitRunner(
  sourceRepoRoot: string,
  calls: Array<{ command: string; args: string[]; cwd?: string }>,
  options: { dirtyWorktreePath?: string; originUrl?: string; worktreeOriginUrl?: string } = {},
): WorktreeCommandRunner {
  return async (command, args, runOptions) => {
    calls.push({ command, args, cwd: runOptions?.cwd });

    if (args.join(" ") === "rev-parse --show-toplevel") {
      return result(runOptions?.cwd ?? sourceRepoRoot);
    }

    if (args.join(" ") === "remote get-url origin") {
      if (runOptions?.cwd !== sourceRepoRoot && options.worktreeOriginUrl) {
        return result(options.worktreeOriginUrl);
      }

      return result(options.originUrl ?? "git@github.com:octo/hello-world.git");
    }

    if (args.join(" ") === "status --porcelain") {
      return result(runOptions?.cwd === options.dirtyWorktreePath ? " M package.json\n" : "");
    }

    if (args.join(" ") === "rev-parse HEAD") {
      return result("abc123\n");
    }

    return result("");
  };
}

function result(stdout: string): ShellCommandResult {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
  };
}

function createPullRequest(): PullRequestSummary {
  return {
    repository: {
      owner: "octo",
      name: "hello-world",
      nameWithOwner: "octo/hello-world",
    },
    authorLogin: "octocat",
    title: "Improve greeting",
    number: 42,
    url: "https://github.com/octo/hello-world/pull/42",
    isDraft: false,
    headRefName: "feature/greeting",
    updatedAt: "2026-06-04T12:00:00.000Z",
    ciStatus: {
      state: "passing",
      commitOid: "abc123",
      totalCount: 1,
      passingCount: 1,
      failingCount: 0,
      pendingCount: 0,
      skippedCount: 0,
      unknownCount: 0,
      checks: [],
      isIncomplete: false,
    },
  };
}
