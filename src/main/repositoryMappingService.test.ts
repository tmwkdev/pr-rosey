import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  inspectLocalRepository,
  listRepositoryMappings,
  removeRepositoryMapping,
  saveRepositoryMapping,
} from "@/main/repositoryMappingService";
import type { ShellCommandResult } from "@/main/shellCommand";

type TestRunCommandOptions = {
  isGitRepository?: boolean;
  repositoryRootPath?: string;
  remoteUrl?: string;
};

let userDataPath: string;

beforeEach(async () => {
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "pr-rosey-repository-mappings-"));
});

afterEach(async () => {
  await rm(userDataPath, { force: true, recursive: true });
});

function createResult(stdout: string): ShellCommandResult {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
  };
}

function createTestRunCommand(options: TestRunCommandOptions = {}) {
  return async (_command: string, args: string[] = []) => {
    const subcommand = args.slice(2).join(" ");

    if (subcommand === "rev-parse --is-inside-work-tree") {
      if (options.isGitRepository === false) {
        throw new Error("not a git repository");
      }

      return createResult("true\n");
    }

    if (subcommand === "rev-parse --show-toplevel") {
      return createResult(`${options.repositoryRootPath ?? args[1]}\n`);
    }

    if (subcommand === "remote get-url origin") {
      if (!options.remoteUrl) {
        throw new Error("missing origin");
      }

      return createResult(`${options.remoteUrl}\n`);
    }

    throw new Error(`Unexpected git command: ${args.join(" ")}`);
  };
}

function createPathAwareTestRunCommand() {
  return async (_command: string, args: string[] = []) => {
    const repositoryRootPath = args[1];
    const subcommand = args.slice(2).join(" ");

    if (subcommand === "rev-parse --is-inside-work-tree") {
      return createResult("true\n");
    }

    if (subcommand === "rev-parse --show-toplevel") {
      return createResult(`${repositoryRootPath}\n`);
    }

    if (subcommand === "remote get-url origin") {
      return createResult(`https://github.com/owner/${path.basename(repositoryRootPath)}.git\n`);
    }

    throw new Error(`Unexpected git command: ${args.join(" ")}`);
  };
}

describe("repository mapping service", () => {
  it("inspects a local clone and returns the repository root", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const inspection = await inspectLocalRepository(
      {
        userDataPath,
        runCommand: createTestRunCommand({
          repositoryRootPath,
          remoteUrl: "git@github.com:owner/repo.git",
        }),
      },
      path.join(repositoryRootPath, "src"),
    );

    expect(inspection).toMatchObject({
      localPath: repositoryRootPath,
      status: "ready",
      remoteUrl: "git@github.com:owner/repo.git",
      repositoryNameWithOwner: "owner/repo",
    });
  });

  it("saves and replaces mappings case-insensitively", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand({
      repositoryRootPath,
      remoteUrl: "https://github.com/owner/repo.git",
    });

    await saveRepositoryMapping(
      { userDataPath, runCommand, now: () => "2026-06-05T10:00:00.000Z" },
      { repositoryNameWithOwner: "Owner/Repo", localPath: repositoryRootPath },
    );
    await saveRepositoryMapping(
      { userDataPath, runCommand, now: () => "2026-06-05T10:05:00.000Z" },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    const list = await listRepositoryMappings({ userDataPath, now: () => "now" });

    expect(list.mappings).toHaveLength(1);
    expect(list.mappings[0]).toMatchObject({
      repositoryNameWithOwner: "owner/repo",
      localPath: repositoryRootPath,
      createdAt: "2026-06-05T10:00:00.000Z",
      updatedAt: "2026-06-05T10:05:00.000Z",
    });
  });

  it("rejects a mapping when the selected clone belongs to a different GitHub repository", async () => {
    await expect(
      saveRepositoryMapping(
        {
          userDataPath,
          runCommand: createTestRunCommand({
            repositoryRootPath: path.join(userDataPath, "repo"),
            remoteUrl: "https://github.com/other/repo.git",
          }),
        },
        { repositoryNameWithOwner: "owner/repo", localPath: path.join(userDataPath, "repo") },
      ),
    ).rejects.toThrow("Selected clone belongs to other/repo, not owner/repo.");
  });

  it("serializes concurrent mapping mutations without dropping updates", async () => {
    const runCommand = createPathAwareTestRunCommand();

    await Promise.all([
      saveRepositoryMapping(
        { userDataPath, runCommand },
        { repositoryNameWithOwner: "owner/repo-a", localPath: path.join(userDataPath, "repo-a") },
      ),
      saveRepositoryMapping(
        { userDataPath, runCommand },
        { repositoryNameWithOwner: "owner/repo-b", localPath: path.join(userDataPath, "repo-b") },
      ),
    ]);

    const listAfterSaves = await listRepositoryMappings({ userDataPath });

    expect(listAfterSaves.mappings.map((mapping) => mapping.repositoryNameWithOwner)).toEqual([
      "owner/repo-a",
      "owner/repo-b",
    ]);

    await Promise.all([
      removeRepositoryMapping({ userDataPath }, "owner/repo-a"),
      removeRepositoryMapping({ userDataPath }, "owner/repo-b"),
    ]);

    const listAfterRemoves = await listRepositoryMappings({ userDataPath });

    expect(listAfterRemoves.mappings).toEqual([]);
  });
});
