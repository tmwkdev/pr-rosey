import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  abortPiRunnerSession,
  createPiBabysitPrompt,
  listPiRunnerSessions,
  resetPiRunnerSessionsForTests,
  startPiRepositoryVerification,
} from "@pr-rosey/desktop/main/piRunnerService";
import { saveRepositoryMapping } from "@pr-rosey/desktop/main/repositoryMappingService";
import type { ShellCommandError, ShellCommandResult } from "@pr-rosey/desktop/main/shellCommand";
import type { PullRequestSummary } from "@pr-rosey/desktop/shared/pullRequests";
import type { CliOptions, WatchAction, WatchReport } from "@pr-rosey/pr-watch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

type WatchCall = CliOptions;

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

function createWatchReport(
  action: WatchAction = "ready_keep_watching",
  overrides: Partial<WatchReport["decision"]> = {},
): WatchReport {
  const needsUser = action === "ask_user" || action === "report_human_feedback";
  const terminal = action === "stop_terminal";
  const failedChecks =
    action === "diagnose_branch_failure" || action === "surface_failed_job"
      ? [
          {
            name: "Lint and typecheck",
            result: "fail" as const,
            workflow: "CI",
            url: "https://github.com/owner/repo/actions/runs/1/job/2",
            headSha: "abc123",
            failureCause: "branch" as const,
            summary: "tsgo failed",
          },
        ]
      : [];

  return {
    schemaVersion: "pr-watch-report/v1",
    generatedAt: "2026-06-06T12:00:00.000Z",
    target: {
      selector: "https://github.com/owner/repo/pull/12",
      repository: "owner/repo",
      stateFile: path.join(userDataPath, "state.json"),
    },
    snapshot: {
      schemaVersion: "pr-watch-snapshot/v1",
      collectedAt: "2026-06-06T12:00:00.000Z",
      repository: "owner/repo",
      pr: {
        number: 12,
        url: "https://github.com/owner/repo/pull/12",
        title: "Test pull request",
        lifecycle: terminal ? "merged" : "open",
        headBranch: "feature",
        baseBranch: "main",
        headSha: "abc123",
        mergeable: "MERGEABLE",
        mergeState: "CLEAN",
        reviewDecision: "",
        isDraft: false,
      },
      ci: {
        currentSha: "abc123",
        checks: failedChecks,
      },
      feedback: {
        items:
          action === "report_human_feedback"
            ? [
                {
                  id: "review-comment:1",
                  kind: "review_comment",
                  author: "reviewer",
                  body: "Please update this before merge.",
                  submittedAt: "2026-06-06T12:00:00.000Z",
                  url: "https://github.com/owner/repo/pull/12#discussion_r1",
                  actionable: true,
                },
              ]
            : [],
      },
    },
    decision: {
      action,
      summary:
        action === "ready_keep_watching"
          ? "The pull request looks ready, but it is still open; keep watching."
          : `${action} summary`,
      terminal,
      needsUser,
      currentSha: "abc123",
      reasons: [action],
      feedback:
        action === "report_human_feedback"
          ? [
              {
                id: "review-comment:1",
                kind: "review_comment",
                author: "reviewer",
                body: "Please update this before merge.",
                submittedAt: "2026-06-06T12:00:00.000Z",
                url: "https://github.com/owner/repo/pull/12#discussion_r1",
                actionable: true,
              },
            ]
          : [],
      failedChecks,
      pendingChecks: action === "watch_wait" ? [{ name: "CI", result: "pending" }] : [],
      retry: {
        used: 0,
        limit: 2,
        remaining: 2,
      },
      ...overrides,
    },
  };
}

function createNonStaticBranchFailureReport(): WatchReport {
  const failedChecks = [
    {
      name: "Unit tests",
      result: "fail" as const,
      workflow: "CI",
      url: "https://github.com/owner/repo/actions/runs/1/job/3",
      headSha: "abc123",
      failureCause: "branch" as const,
      summary: "Vitest failed",
    },
  ];

  return createWatchReport("diagnose_branch_failure", { failedChecks });
}

function createTypecheckError(stdout: string): ShellCommandError {
  const error = new Error("typecheck failed") as ShellCommandError;
  error.stdout = stdout;
  error.stderr = "";
  return error;
}

function createAutofixRunCommand(repositoryRootPath: string, calls: string[]) {
  return async (command: string, args: string[] = []) => {
    calls.push([command, ...args].join(" "));

    if (command === "npm") {
      const scriptName = args.at(-1);

      if (scriptName === "typecheck") {
        throw createTypecheckError(
          "apps/desktop/src/main/piRunnerService.ts(2,7): error TS2322: Type 'number' is not assignable to type 'string'.",
        );
      }

      if (scriptName === "check") {
        return createResult("check passed\n");
      }
    }

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

    if (subcommand === "branch --show-current") {
      return createResult("feature\n");
    }

    if (subcommand === "status --porcelain") {
      return createResult("");
    }

    if (subcommand.startsWith("add ")) {
      return createResult("");
    }

    if (subcommand === "commit -m Fix static analysis failure") {
      return createResult("[feature abc123] Fix static analysis failure\n");
    }

    if (subcommand === "push origin feature") {
      return createResult("");
    }

    throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
  };
}

function createWatchOptions(report = createWatchReport()) {
  const calls: WatchCall[] = [];
  return {
    calls,
    evaluateWatchOnce: async (options: CliOptions) => {
      calls.push(options);
      return report;
    },
    sleep: () => new Promise<void>(() => undefined),
    watchPollMilliseconds: 5,
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
  it("builds a read-only babysit prompt with PR and CI context", () => {
    const prompt = createPiBabysitPrompt(createPullRequestSummary(), "/tmp/repo");

    expect(prompt).toContain("Repository: owner/repo");
    expect(prompt).toContain("Pull request: #12 Test pull request");
    expect(prompt).toContain("Head branch: feature");
    expect(prompt).toContain("CI summary: passing");
    expect(prompt).toContain("Working directory: /tmp/repo");
    expect(prompt).toContain("Only read, list, find, or grep files");
    expect(prompt).toContain("Do not edit files, commit, push, merge");
    expect(prompt).toContain("BABYSIT REPORT");
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

  it("starts a watch session in the mapped repository without starting Pi or spending prompt tokens", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];
    const watchOptions = createWatchOptions();

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
        evaluateWatchOnce: watchOptions.evaluateWatchOnce,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: watchOptions.sleep,
        watchPollMilliseconds: watchOptions.watchPollMilliseconds,
      },
      createPullRequestSummary(),
    );

    expect(agentSessionCalls).toHaveLength(0);
    expect(session).toMatchObject({
      id: "session-1",
      status: "running",
      localPath: repositoryRootPath,
      pid: null,
      logFilePath: path.join(userDataPath, "pi-runner-logs", "session-1.jsonl"),
    });
    expect(session.conversation).toEqual([]);

    const logFile = await readFile(session.logFilePath, "utf8");
    expect(logFile).toContain("Starting PR watch for owner/repo#12");
    expect(logFile).not.toContain("Starting Pi AgentSession");
    expect(logFile).not.toContain("Created Pi AgentSession");
    expect(logFile).not.toContain("Sent read-only babysit prompt");
  });

  it("starts an autonomous PR watch loop for the selected pull request", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];
    const watchOptions = createWatchOptions(createWatchReport("watch_wait"));

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-watch",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        evaluateWatchOnce: watchOptions.evaluateWatchOnce,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: watchOptions.sleep,
        watchPollMilliseconds: watchOptions.watchPollMilliseconds,
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(watchOptions.calls).toHaveLength(1);
    });

    expect(watchOptions.calls[0]).toMatchObject({
      selector: "https://github.com/owner/repo/pull/12",
      repository: "owner/repo",
      noLock: true,
      retryLimit: 2,
      maxIterations: 1,
    });
    expect(watchOptions.calls[0].stateFile).toContain("pr-watch-sessions/session-watch-state.json");
    expect(agentSessionCalls).toHaveLength(0);

    const runningSession = listPiRunnerSessions()[0];
    expect(runningSession.status).toBe("running");
    expect(runningSession.activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "PR watch started",
        }),
        expect.objectContaining({
          title: "PR watch: watch_wait",
          summary: expect.stringContaining("watch_wait summary"),
        }),
      ]),
    );
  });

  it("autofixes and pushes a narrow static-analysis failure without starting Pi", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    await mkdir(path.join(repositoryRootPath, "apps/desktop/src/main"), { recursive: true });
    const sourceFilePath = path.join(
      repositoryRootPath,
      "apps/desktop/src/main/piRunnerService.ts",
    );
    await writeFile(
      sourceFilePath,
      ['const ok = "ready";', "const staticAnalysisProbe: string = 42;", ""].join("\n"),
      "utf8",
    );
    const runCommandCalls: string[] = [];
    const runCommand = createAutofixRunCommand(repositoryRootPath, runCommandCalls);
    const agentSessionCalls: AgentSessionCall[] = [];
    const watchOptions = createWatchOptions(createWatchReport("diagnose_branch_failure"));

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-autofix",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        evaluateWatchOnce: watchOptions.evaluateWatchOnce,
        maxWatchIterations: 1,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: async () => undefined,
        watchPollMilliseconds: 5,
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(runCommandCalls).toContain(`git -C ${repositoryRootPath} push origin feature`);
    });

    await expect(readFile(sourceFilePath, "utf8")).resolves.not.toContain("staticAnalysisProbe");
    expect(agentSessionCalls).toHaveLength(0);
    expect(runCommandCalls).toEqual(
      expect.arrayContaining([
        `git -C ${repositoryRootPath} branch --show-current`,
        `git -C ${repositoryRootPath} status --porcelain`,
        `npm --prefix ${repositoryRootPath} run typecheck`,
        `npm --prefix ${repositoryRootPath} run check`,
        `git -C ${repositoryRootPath} add apps/desktop/src/main/piRunnerService.ts`,
        `git -C ${repositoryRootPath} commit -m Fix static analysis failure`,
        `git -C ${repositoryRootPath} push origin feature`,
      ]),
    );
    expect(listPiRunnerSessions()[0].activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Static analysis fix pushed",
          status: "success",
        }),
      ]),
    );
  });

  it("asks Pi for read-only diagnosis when PR watch finds a branch failure", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];
    const watchOptions = createWatchOptions(createNonStaticBranchFailureReport());

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-diagnose",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        evaluateWatchOnce: watchOptions.evaluateWatchOnce,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: watchOptions.sleep,
        watchPollMilliseconds: watchOptions.watchPollMilliseconds,
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(agentSessionCalls).toHaveLength(1);
    });

    expect(agentSessionCalls[0]).toMatchObject({
      cwd: repositoryRootPath,
      sessionDir: path.join(userDataPath, "pi-agent-sessions", "session-diagnose"),
      tools: ["read", "grep", "find", "ls"],
    });
    expect(agentSessionCalls[0].session.prompts).toHaveLength(1);
    expect(agentSessionCalls[0].session.prompts[0]).toContain("PR-WATCH UPDATE");
    expect(agentSessionCalls[0].session.prompts[0]).toContain("Decision: diagnose_branch_failure");
    expect(agentSessionCalls[0].session.prompts[0]).toContain("Unit tests");
    expect(agentSessionCalls[0].session.prompts[0]).toContain("Use read-only tools only");
    expect(listPiRunnerSessions()[0]).toMatchObject({
      id: "session-diagnose",
      status: "running",
    });
  });

  it("does not send duplicate read-only diagnosis prompts for the same failure", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];
    const report = createNonStaticBranchFailureReport();
    const watchCalls: CliOptions[] = [];

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-deduped-diagnosis",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        evaluateWatchOnce: async (options) => {
          watchCalls.push(options);
          return report;
        },
        maxWatchIterations: 2,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: async () => undefined,
        watchPollMilliseconds: 5,
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(watchCalls).toHaveLength(2);
    });

    expect(agentSessionCalls[0].session.prompts).toHaveLength(1);
    expect(agentSessionCalls[0].session.prompts[0]).toContain("PR-WATCH UPDATE");
    expect(listPiRunnerSessions()[0].activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "PR watch diagnosis already queued",
        }),
      ]),
    );
  });

  it("stops and surfaces escalation when PR watch needs user input", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];
    const watchOptions = createWatchOptions(createWatchReport("report_human_feedback"));

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-feedback",
        createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
        evaluateWatchOnce: watchOptions.evaluateWatchOnce,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: watchOptions.sleep,
        watchPollMilliseconds: watchOptions.watchPollMilliseconds,
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(listPiRunnerSessions()[0].status).toBe("exited");
    });

    const stoppedSession = listPiRunnerSessions()[0];
    expect(agentSessionCalls).toHaveLength(0);
    expect(stoppedSession.activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "important-output",
          title: "PR watch: report_human_feedback",
          status: "failed",
        }),
      ]),
    );
    expect(stoppedSession.outputLines.map((line) => line.message)).toContain(
      "PR watch needs user input: report_human_feedback summary",
    );
  });

  it("records structured AgentSession events and aborts an active Pi session", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];
    const watchOptions = createWatchOptions(createNonStaticBranchFailureReport());

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
        evaluateWatchOnce: watchOptions.evaluateWatchOnce,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: watchOptions.sleep,
        watchPollMilliseconds: watchOptions.watchPollMilliseconds,
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(agentSessionCalls).toHaveLength(1);
    });

    const assistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "BABYSIT REPORT /tmp/repo" }],
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
          body: "BABYSIT REPORT /tmp/repo",
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

    agentSessionCalls[0].session.emit({ type: "agent_end", messages: [], willRetry: false });

    await vi.waitFor(() => {
      expect(listPiRunnerSessions()[0].status).toBe("aborted");
    });

    const abortedSession = listPiRunnerSessions()[0];
    expect(abortedSession).toMatchObject({
      id: "session-2",
      status: "aborted",
      exitCode: 0,
      error: null,
    });
    expect(abortedSession.outputLines.map((line) => line.message)).toContain(
      "Pi AgentSession stopped after abort.",
    );

    await expect(
      startPiRepositoryVerification(
        {
          userDataPath,
          runCommand,
          createId: () => "session-3",
          createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
          evaluateWatchOnce: watchOptions.evaluateWatchOnce,
          sleep: watchOptions.sleep,
        },
        createPullRequestSummary(),
      ),
    ).resolves.toMatchObject({
      id: "session-3",
      status: "running",
    });
  });

  it("keeps tool-only assistant messages and tool results out of the human conversation", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);
    const agentSessionCalls: AgentSessionCall[] = [];
    const watchOptions = createWatchOptions(createNonStaticBranchFailureReport());

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
        evaluateWatchOnce: watchOptions.evaluateWatchOnce,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: watchOptions.sleep,
        watchPollMilliseconds: watchOptions.watchPollMilliseconds,
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(agentSessionCalls).toHaveLength(1);
    });

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

  it("records failed lazy Pi startup and does not leave an active blocker", async () => {
    const repositoryRootPath = path.join(userDataPath, "repo");
    const runCommand = createTestRunCommand(repositoryRootPath);

    await saveRepositoryMapping(
      { userDataPath, runCommand },
      { repositoryNameWithOwner: "owner/repo", localPath: repositoryRootPath },
    );

    await startPiRepositoryVerification(
      {
        userDataPath,
        runCommand,
        createId: () => "session-failed",
        createAgentSession: async () => {
          throw new Error("SDK unavailable");
        },
        evaluateWatchOnce: createWatchOptions(createNonStaticBranchFailureReport())
          .evaluateWatchOnce,
        now: () => "2026-06-06T12:00:00.000Z",
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(listPiRunnerSessions()[0].status).toBe("failed");
    });

    const failedSession = listPiRunnerSessions()[0];
    expect(failedSession).toMatchObject({
      id: "session-failed",
      status: "failed",
      error: "SDK unavailable",
      exitCode: 1,
    });

    const agentSessionCalls: AgentSessionCall[] = [];
    const watchOptions = createWatchOptions();
    await expect(
      startPiRepositoryVerification(
        {
          userDataPath,
          runCommand,
          createId: () => "session-after-failure",
          createAgentSession: createTestAgentSessionFactory(agentSessionCalls),
          evaluateWatchOnce: watchOptions.evaluateWatchOnce,
          sleep: watchOptions.sleep,
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
    const watchOptions = createWatchOptions(createNonStaticBranchFailureReport());

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
        evaluateWatchOnce: watchOptions.evaluateWatchOnce,
        now: () => "2026-06-06T12:00:00.000Z",
        sleep: watchOptions.sleep,
        watchPollMilliseconds: watchOptions.watchPollMilliseconds,
      },
      createPullRequestSummary(),
    );

    await vi.waitFor(() => {
      expect(agentSessionCalls).toHaveLength(1);
    });

    agentSessionCalls[0].session.emit({ type: "agent_end", messages: [], willRetry: true });

    expect(listPiRunnerSessions()[0]).toMatchObject({
      id: "session-retry",
      status: "running",
      exitedAt: null,
    });
    expect(agentSessionCalls[0].session.disposed).toBe(false);
  });
});
