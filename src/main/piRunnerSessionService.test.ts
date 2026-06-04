import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { PiRunnerSessionService, redactKnownSecrets } from "@/main/piRunnerSessionService";
import type { PullRequestSummary } from "@/shared/pullRequests";
import type { ManagedWorktree } from "@/shared/runner";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((tempRoot) => rm(tempRoot, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("Pi runner session service", () => {
  it("redacts known secret environment values before writing logs", () => {
    process.env.PI_API_KEY = "pi-secret-value";

    expect(redactKnownSecrets("token=pi-secret-value")).toBe("token=[redacted:PI_API_KEY]");

    delete process.env.PI_API_KEY;
  });

  it("starts Pi RPC in the managed worktree and writes the initial prompt", async () => {
    const tempRoot = await createTempRoot();
    const child = new FakeChildProcess();
    const service = createService(tempRoot, child);

    await service.startBabysit({
      pullRequest: createPullRequest(),
      sourceRepoRoot: path.join(tempRoot, "repo"),
    });

    expect(child.spawnCwd).toBe(path.join(tempRoot, "worktree"));
    const commands = child.stdinText
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as { type: string; message?: string });

    expect(commands[0]).toMatchObject({
      type: "prompt",
      message: expect.stringContaining("https://github.com/octo/hello-world/pull/42"),
    });
    expect(commands[0].message).toContain(path.join(tempRoot, "worktree"));
    expect(commands[0]).not.toHaveProperty("prompt");
    expect(commands[1]).toMatchObject({
      type: "get_state",
    });
  });

  it("records streamed Pi events in renderer-visible session state", async () => {
    const tempRoot = await createTempRoot();
    const child = new FakeChildProcess();
    const service = createService(tempRoot, child);

    await service.startBabysit({
      pullRequest: createPullRequest(),
      sourceRepoRoot: path.join(tempRoot, "repo"),
    });
    child.stdout.write(`${JSON.stringify({ type: "tool_call", name: "npm test" })}\n`);
    child.stdout.write(
      `${JSON.stringify({
        type: "response",
        command: "get_state",
        success: true,
        data: {
          sessionId: "pi-session-123",
        },
      })}\n`,
    );

    expect(service.getCurrentSession()?.events).toContainEqual(
      expect.objectContaining({
        kind: "tool",
        label: "npm test",
      }),
    );
    expect(service.getCurrentSession()?.runnerSessionId).toBe("pi-session-123");
  });

  it("moves a running process through aborting to aborted state", async () => {
    const tempRoot = await createTempRoot();
    const child = new FakeChildProcess();
    const service = createService(tempRoot, child);

    await service.startBabysit({
      pullRequest: createPullRequest(),
      sourceRepoRoot: path.join(tempRoot, "repo"),
    });

    expect(service.abortCurrentSession()?.status).toBe("aborting");
    expect(child.killSignal).toBe("SIGTERM");

    child.emit("close", null);

    expect(service.getCurrentSession()?.status).toBe("aborted");
  });
});

class FakeChildProcess extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin = new PassThrough();
  spawnCwd: string | null = null;
  killSignal: NodeJS.Signals | null = null;
  stdinText = "";

  constructor() {
    super();
    this.stdin.on("data", (chunk: Buffer | string) => {
      this.stdinText += chunk.toString();
    });
  }

  kill(signal?: NodeJS.Signals | number): boolean {
    this.killSignal = typeof signal === "string" ? signal : null;
    return true;
  }
}

async function createTempRoot(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "pr-rosey-pi-test-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}

function createService(tempRoot: string, child: FakeChildProcess): PiRunnerSessionService {
  return new PiRunnerSessionService({
    managedWorktreeRoot: path.join(tempRoot, "managed-worktrees"),
    sessionLogRoot: path.join(tempRoot, "runner-sessions"),
    spawnProcess: (_command, _args, options) => {
      child.spawnCwd = options.cwd;
      return child as unknown as ChildProcessWithoutNullStreams;
    },
    createWorktree: async () => createWorktree(tempRoot),
  });
}

function createWorktree(tempRoot: string): ManagedWorktree {
  return {
    kind: "local-worktree",
    repository: "octo/hello-world",
    pullRequestNumber: 42,
    sourceRepoRoot: path.join(tempRoot, "repo"),
    worktreePath: path.join(tempRoot, "worktree"),
    headRefName: "feature/greeting",
    headSha: "abc123",
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
