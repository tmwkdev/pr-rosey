import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abortPiRunnerSession,
  createPiRepositoryVerificationPrompt,
  resetPiRunnerSessionsForTests,
  startPiRepositoryVerification,
} from "@/main/piRunnerService";
import { saveRepositoryMapping } from "@/main/repositoryMappingService";
import type { ShellCommandResult } from "@/main/shellCommand";
import type { PullRequestSummary } from "@/shared/pullRequests";

class FakePiProcess extends EventEmitter {
  readonly pid = 12345;
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killedWithSignal: string | null = null;
  stdinWrites: string[] = [];

  constructor() {
    super();

    this.stdin.on("data", (chunk) => {
      this.stdinWrites.push(chunk.toString());
    });
  }

  kill(signal?: NodeJS.Signals): boolean {
    this.killedWithSignal = signal ?? null;
    return true;
  }
}

type SpawnCall = {
  args: string[];
  command: string;
  cwd: string;
  process: FakePiProcess;
};

let userDataPath: string;

beforeEach(async () => {
  resetPiRunnerSessionsForTests();
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "pr-rosey-pi-runner-"));
});

afterEach(async () => {
  resetPiRunnerSessionsForTests();
  await rm(userDataPath, { force: true, recursive: true });
});

function createResult(stdout: string): ShellCommandResult {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
  };
}

function createTestRunCommand(repositoryRootPath: string) {
  return async (_command: string, args: string[] = []) => {
    const subcommand = args.slice(2).join(" ");

    if (subcommand === "rev-parse --is-inside-work-tree") {
      return createResult("true\n");
    }

    if (subcommand === "rev-parse --show-toplevel") {
      return createResult(`${repositoryRootPath}\n`);
    }

    if (subcommand === "remote get-url origin") {
      return createResult("https://github.com/owner/repo.git\n");
    }

    throw new Error(`Unexpected git command: ${args.join(" ")}`);
  };
}

function createPullRequestSummary(): PullRequestSummary {
  return {
    repository: {
      owner: "owner",
      name: "repo",
      nameWithOwner: "owner/repo",
    },
    authorLogin: "octocat",
    title: "Test pull request",
    number: 12,
    url: "https://github.com/owner/repo/pull/12",
    isDraft: false,
    headRefName: "feature",
    updatedAt: "2026-06-06T12:00:00.000Z",
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

function createTestSpawnProcess(calls: SpawnCall[]) {
  return (command: string, args: string[], options: { cwd: string }) => {
    const process = new FakePiProcess();
    calls.push({ command, args, cwd: options.cwd, process });

    return process;
  };
}

describe("pi runner service", () => {
  it("builds a read-only repository verification prompt", () => {
    const prompt = createPiRepositoryVerificationPrompt(createPullRequestSummary(), "/tmp/repo");

    expect(prompt).toContain("Expected repository: owner/repo");
    expect(prompt).toContain("Working directory: /tmp/repo");
    expect(prompt).toContain("Use only read-only commands");
    expect(prompt).toContain("Do not edit files, commit, push, merge");
    expect(prompt).toContain("VERIFIED");
  });

  it("refuses to start Pi without a trusted repository mapping", async () => {
    await expect(
      startPiRepositoryVerification(
        {
          userDataPath,
          runCommand: createTestRunCommand(path.join(userDataPath, "repo")),
        },
        createPullRequestSummary(),
      ),
    ).rejects.toThrow("Map owner/repo to a trusted local clone in Settings before starting Pi.");
  });

  it("starts Pi RPC in the mapped repository and sends the verification prompt", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const spawnCalls: SpawnCall[] = [];

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    const session = await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-1",
        spawnProcess: createTestSpawnProcess(spawnCalls),
        now: () => "2026-06-06T12:00:00.000Z",
      },
      createPullRequestSummary(),
    );

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0]).toMatchObject({
      command: "pi",
      args: ["--mode", "rpc", "--no-session", "--name", "pr-rosey owner/repo#12"],
      cwd: repositoryRootPath,
    });
    expect(spawnCalls[0].process.stdinWrites.join("")).toContain('"type":"prompt"');
    expect(spawnCalls[0].process.stdinWrites.join("")).toContain("Expected repository: owner/repo");
    expect(session).toMatchObject({
      id: "session-1",
      status: "running",
      localPath: repositoryRootPath,
      pid: 12345,
      logFilePath: path.join(userDataPath, "pi-runner-logs", "session-1.jsonl"),
    });

    const logFile = await readFile(session.logFilePath, "utf8");
    expect(logFile).toContain("Starting pi --mode rpc --no-session");
    expect(logFile).toContain("Sent read-only repository verification prompt");
  });

  it("records stdout summaries and aborts an active Pi process", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const spawnCalls: SpawnCall[] = [];

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-2",
        spawnProcess: createTestSpawnProcess(spawnCalls),
        now: () => "2026-06-06T12:00:00.000Z",
      },
      createPullRequestSummary(),
    );

    spawnCalls[0].process.stdout.write('{"type":"response","command":"prompt","success":true}\n');

    const abortingSession = await abortPiRunnerSession(
      { userDataPath, now: () => "2026-06-06T12:00:01.000Z" },
      "session-2",
    );

    expect(abortingSession.status).toBe("aborting");
    expect(spawnCalls[0].process.killedWithSignal).toBe("SIGTERM");
    expect(abortingSession.outputLines.map((line) => line.message)).toContain(
      "Pi response for prompt: accepted",
    );
    expect(abortingSession.outputLines.map((line) => line.message)).toContain(
      "Abort requested by user.",
    );

    await expect(
      startPiRepositoryVerification(
        {
          userDataPath,
          runCommand,
          createId: () => "session-3",
          spawnProcess: createTestSpawnProcess(spawnCalls),
        },
        createPullRequestSummary(),
      ),
    ).rejects.toThrow("A Pi verification session is already running.");
  });
});
