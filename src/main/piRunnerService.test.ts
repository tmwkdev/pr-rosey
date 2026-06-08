import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abortPiRunnerSession,
  createPiRepositoryVerificationPrompt,
  listPiRunnerSessions,
  resetPiRunnerSessionsForTests,
  startPiRepositoryVerification,
} from "@/main/piRunnerService";
import { saveRepositoryMapping } from "@/main/repositoryMappingService";
import type { ShellCommandResult } from "@/main/shellCommand";
import type { PullRequestSummary } from "@/shared/pullRequests";

type FakeAgentSessionEvent = {
  args?: unknown;
  isError?: boolean;
  message?: unknown;
  messages?: unknown[];
  result?: unknown;
  toolName?: string;
  type: string;
  willRetry?: boolean;
};

class FakeAgentSession {
  readonly sessionFile = "/tmp/pi-session.jsonl";
  readonly sessionId = "pi-session-1";
  abortCalled = false;
  disposed = false;
  messages: unknown[] = [];
  prompts: string[] = [];
  private listeners: Array<(event: FakeAgentSessionEvent) => void> = [];

  abort(): Promise<void> {
    this.abortCalled = true;
    return Promise.resolve();
  }

  dispose(): void {
    this.disposed = true;
  }

  emit(event: FakeAgentSessionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  prompt(text: string): Promise<void> {
    this.prompts.push(text);
    this.messages = [
      ...this.messages,
      {
        role: "user",
        content: text,
        timestamp: Date.parse("2026-06-06T12:00:00.000Z"),
      },
    ];
    this.emit({ type: "agent_start" });
    this.emit({ type: "message_end", message: this.messages[0] });
    return Promise.resolve();
  }

  subscribe(listener: (event: FakeAgentSessionEvent) => void): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter((currentListener) => currentListener !== listener);
    };
  }
}

type AgentSessionCall = {
  cwd: string;
  session: FakeAgentSession;
  sessionDir: string;
  tools: readonly string[];
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

function createTestAgentSessionFactory(calls: AgentSessionCall[]) {
  return async (input: { cwd: string; sessionDir: string; tools: readonly string[] }) => {
    const session = new FakeAgentSession();
    calls.push({ ...input, session });

    return session;
  };
}

describe("pi runner service", () => {
  it("builds a read-only repository verification prompt", () => {
    const prompt = createPiRepositoryVerificationPrompt(createPullRequestSummary(), "/tmp/repo");

    expect(prompt).toContain("Expected repository: owner/repo");
    expect(prompt).toContain("Working directory: /tmp/repo");
    expect(prompt).toContain("Only read, list, find, or grep files");
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

  it("starts a Pi AgentSession in the mapped repository and sends the verification prompt", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    const session = await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-1",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        now: () => "2026-06-06T12:00:00.000Z",
      },
      createPullRequestSummary(),
    );

    expect(agentSessionCalls).toHaveLength(1);
    expect(agentSessionCalls[0]).toMatchObject({
      cwd: repositoryRootPath,
      sessionDir: path.join(userDataPath, "pi-agent-sessions", "session-1"),
      tools: ["read", "grep", "find", "ls"],
    });
    expect(agentSessionCalls[0].session.prompts.join("")).toContain(
      "Expected repository: owner/repo",
    );
    expect(session).toMatchObject({
      id: "session-1",
      status: "running",
      localPath: repositoryRootPath,
      pid: null,
      logFilePath: path.join(userDataPath, "pi-runner-logs", "session-1.jsonl"),
    });
    expect(session.conversation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          body: expect.stringContaining("Expected repository: owner/repo"),
        }),
      ]),
    );

    const logFile = await readFile(session.logFilePath, "utf8");
    expect(logFile).toContain("Starting Pi AgentSession");
    expect(logFile).toContain("Created Pi AgentSession");
    expect(logFile).toContain("Sent read-only repository verification prompt");
  });

  it("records structured AgentSession events and aborts an active Pi session", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-2",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        now: () => "2026-06-06T12:00:00.000Z",
      },
      createPullRequestSummary(),
    );

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "VERIFIED /tmp/repo" }],
      stopReason: "stop",
      timestamp: Date.parse("2026-06-06T12:00:01.000Z"),
    };
    agentSessionCalls[0].session.messages = [
      ...agentSessionCalls[0].session.messages,
      assistantMessage,
    ];
    agentSessionCalls[0].session.emit({ type: "message_update", message: assistantMessage });
    agentSessionCalls[0].session.emit({
      type: "tool_execution_start",
      toolName: "bash",
      args: { command: "pwd" },
    });
    agentSessionCalls[0].session.emit({
      type: "tool_execution_end",
      toolName: "bash",
      args: { command: "pwd" },
      result: { content: [{ type: "text", text: repositoryRootPath }] },
      isError: false,
    });

    const runningSession = listPiRunnerSessions()[0];
    expect(runningSession.conversation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          body: "VERIFIED /tmp/repo",
        }),
      ]),
    );
    expect(runningSession.activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "tool-activity",
          title: "Tool started: bash",
        }),
        expect.objectContaining({
          kind: "tool-activity",
          title: "Tool finished: bash",
          summary: "bash finished.",
        }),
      ]),
    );
    expect(runningSession.activityEvents).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          summary: repositoryRootPath,
        }),
      ]),
    );

    const abortingSession = await abortPiRunnerSession(
      { userDataPath, now: () => "2026-06-06T12:00:01.000Z" },
      "session-2",
    );

    expect(abortingSession.status).toBe("aborting");
    expect(agentSessionCalls[0].session.abortCalled).toBe(true);
    expect(abortingSession.outputLines.map((line) => line.message)).toContain(
      "Abort requested by user.",
    );
    expect(abortingSession.activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "system",
          title: "Stop requested",
        }),
      ]),
    );

    await expect(
      startPiRepositoryVerification(
        {
          userDataPath,
          runCommand,
          createId: () => "session-3",
          createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        },
        createPullRequestSummary(),
      ),
    ).rejects.toThrow("A Pi verification session is already running.");
  });

  it("keeps tool-only assistant messages and tool results out of the human conversation", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-tool-only",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        now: () => "2026-06-06T12:00:00.000Z",
      },
      createPullRequestSummary(),
    );

    agentSessionCalls[0].session.messages = [
      ...agentSessionCalls[0].session.messages,
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "tool-1",
            name: "read",
            arguments: { path: "src/main/piRunnerService.ts" },
          },
        ],
        stopReason: "toolUse",
        timestamp: Date.parse("2026-06-06T12:00:01.000Z"),
      },
      {
        role: "toolResult",
        toolCallId: "tool-1",
        toolName: "read",
        content: [{ type: "text", text: "file contents that should stay out of chat" }],
        isError: false,
        timestamp: Date.parse("2026-06-06T12:00:02.000Z"),
      },
    ];
    agentSessionCalls[0].session.emit({
      type: "message_end",
      message: agentSessionCalls[0].session.messages.at(-1),
    });

    const runningSession = listPiRunnerSessions()[0];
    expect(runningSession.conversation).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          body: expect.stringContaining("Requested read"),
        }),
        expect.objectContaining({
          body: expect.stringContaining("file contents that should stay out of chat"),
        }),
        expect.objectContaining({
          title: "read result",
        }),
      ]),
    );
  });

  it("records failed startup and does not leave an active blocker when AgentSession creation fails", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await expect(
      startPiRepositoryVerification(
        {
          userDataPath,
          runCommand,
          createId: () => "session-failed",
          createAgentSession: async () => {
            throw new Error("SDK unavailable");
          },
          now: () => "2026-06-06T12:00:00.000Z",
        },
        createPullRequestSummary(),
      ),
    ).rejects.toThrow("SDK unavailable");

    const failedSession = listPiRunnerSessions()[0];
    expect(failedSession).toMatchObject({
      id: "session-failed",
      status: "failed",
      error: "SDK unavailable",
      exitCode: 1,
    });

    const agentSessionCalls: AgentSessionCall[] = [];
    await expect(
      startPiRepositoryVerification(
        {
          userDataPath,
          runCommand,
          createId: () => "session-after-failure",
          createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        },
        createPullRequestSummary(),
      ),
    ).resolves.toMatchObject({
      id: "session-after-failure",
      status: "running",
    });
  });

  it("keeps an AgentSession running when Pi reports agent_end with willRetry", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-retry",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        now: () => "2026-06-06T12:00:00.000Z",
      },
      createPullRequestSummary(),
    );

    agentSessionCalls[0].session.emit({ type: "agent_end", messages: [], willRetry: true });

    expect(listPiRunnerSessions()[0]).toMatchObject({
      id: "session-retry",
      status: "running",
      exitedAt: null,
    });
    expect(agentSessionCalls[0].session.disposed).toBe(false);
  });
});
