import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createOrUpdateManagedWorktree } from "@/main/gitWorktreeService";
import {
  type BabysitStartRequest,
  createBabysitPrompt,
  getPiSessionIdFromEvent,
  type ManagedWorktree,
  type RunnerEventSummary,
  type RunnerSessionStartResult,
  type RunnerSessionState,
  summarizePiJsonEvent,
} from "@/shared/runner";

type SpawnPiProcess = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => ChildProcessWithoutNullStreams;

type RunnerServiceOptions = {
  managedWorktreeRoot: string;
  sessionLogRoot: string;
  spawnProcess?: SpawnPiProcess;
  createWorktree?: (
    request: BabysitStartRequest,
    managedWorktreeRoot: string,
  ) => Promise<ManagedWorktree>;
};

type ActiveProcess = {
  child: ChildProcessWithoutNullStreams;
  sessionId: string;
  abortRequested: boolean;
};

const maxVisibleEvents = 200;
const sensitiveEnvironmentNamePattern =
  /(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIAL)/i;

export class PiRunnerSessionService {
  private activeProcess: ActiveProcess | null = null;
  private currentSession: RunnerSessionState | null = null;
  private readonly managedWorktreeRoot: string;
  private readonly sessionLogRoot: string;
  private readonly spawnProcess: SpawnPiProcess;
  private readonly createWorktree: (
    request: BabysitStartRequest,
    managedWorktreeRoot: string,
  ) => Promise<ManagedWorktree>;

  constructor(options: RunnerServiceOptions) {
    this.managedWorktreeRoot = options.managedWorktreeRoot;
    this.sessionLogRoot = options.sessionLogRoot;
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.createWorktree = options.createWorktree ?? createWorktreeForRequest;
  }

  getCurrentSession(): RunnerSessionState | null {
    return this.currentSession ? cloneSession(this.currentSession) : null;
  }

  async startBabysit(request: BabysitStartRequest): Promise<RunnerSessionStartResult> {
    if (this.activeProcess && isRunningStatus(this.currentSession?.status)) {
      throw new Error("A Pi babysit session is already running.");
    }

    const now = nowIso();
    const sessionId = createSessionId(request.pullRequest.number);
    const logDirectory = path.join(this.sessionLogRoot, sessionId);
    await mkdir(logDirectory, { recursive: true });

    const worktree = await this.createWorktree(request, this.managedWorktreeRoot);

    const session: RunnerSessionState = {
      id: sessionId,
      runner: "pi-rpc",
      status: "starting",
      startedAt: now,
      updatedAt: now,
      exitedAt: null,
      pullRequest: {
        repository: request.pullRequest.repository.nameWithOwner,
        number: request.pullRequest.number,
        title: request.pullRequest.title,
        url: request.pullRequest.url,
        headRefName: request.pullRequest.headRefName,
      },
      worktree,
      runnerSessionId: null,
      logDirectory,
      exitCode: null,
      error: null,
      events: [],
    };

    this.currentSession = session;
    await this.persistMetadata(session);

    try {
      const child = this.spawnProcess("pi", ["--mode", "rpc"], {
        cwd: worktree.worktreePath,
        env: {
          ...process.env,
          PI_CODING_AGENT_SESSION_DIR: path.join(logDirectory, "pi-sessions"),
        },
      });

      this.activeProcess = {
        child,
        sessionId,
        abortRequested: false,
      };

      this.attachProcessHandlers(child, sessionId, logDirectory);
      this.markSessionStatus("running");
      this.writePrompt(child, request, worktree, logDirectory);
    } catch (error) {
      this.markSessionFailed(error instanceof Error ? error.message : "Could not start Pi RPC.");
    }

    return {
      session: this.getCurrentSession() ?? session,
    };
  }

  abortCurrentSession(): RunnerSessionState | null {
    if (!this.currentSession || !this.activeProcess) {
      return this.getCurrentSession();
    }

    this.activeProcess.abortRequested = true;
    this.markSessionStatus("aborting");
    this.activeProcess.child.kill("SIGTERM");
    void this.persistMetadata(this.currentSession);

    return this.getCurrentSession();
  }

  private attachProcessHandlers(
    child: ChildProcessWithoutNullStreams,
    sessionId: string,
    logDirectory: string,
  ): void {
    let stdoutBuffer = "";
    let stderrBuffer = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        this.recordPiJsonLine(sessionId, logDirectory, line);
      }
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      const rawText = chunk.toString();
      stderrBuffer += rawText;
      void appendRedactedLog(path.join(logDirectory, "stderr.log"), rawText);
    });

    child.on("error", (error) => {
      this.markSessionFailed(error.message);
    });

    child.on("close", (exitCode) => {
      if (stdoutBuffer.trim()) {
        this.recordPiJsonLine(sessionId, logDirectory, stdoutBuffer);
      }

      if (stderrBuffer.trim()) {
        const event = createEvent("error", "Runner stderr", stderrBuffer.trim());
        this.addEvent(event);
      }

      const activeProcess = this.activeProcess;
      const abortRequested = activeProcess?.sessionId === sessionId && activeProcess.abortRequested;
      this.activeProcess = null;

      if (!this.currentSession || this.currentSession.id !== sessionId) {
        return;
      }

      this.currentSession.status = abortRequested ? "aborted" : "exited";
      this.currentSession.exitCode = typeof exitCode === "number" ? exitCode : null;
      this.currentSession.exitedAt = nowIso();
      this.touchSession();
      void this.persistMetadata(this.currentSession);
    });
  }

  private writePrompt(
    child: ChildProcessWithoutNullStreams,
    request: BabysitStartRequest,
    worktree: ManagedWorktree,
    logDirectory: string,
  ): void {
    const prompt = createBabysitPrompt(request.pullRequest, worktree);
    const payload = {
      id: `${this.currentSession?.id ?? "session"}-prompt`,
      type: "prompt",
      message: prompt,
      metadata: {
        pullRequestUrl: request.pullRequest.url,
        branch: request.pullRequest.headRefName,
        worktreePath: worktree.worktreePath,
      },
    };
    const statePayload = {
      id: `${this.currentSession?.id ?? "session"}-state`,
      type: "get_state",
    };
    const line = `${JSON.stringify(payload)}\n`;
    const stateLine = `${JSON.stringify(statePayload)}\n`;

    child.stdin.write(line);
    child.stdin.write(stateLine);
    void appendRedactedLog(path.join(logDirectory, "events.jsonl"), line);
    void appendRedactedLog(path.join(logDirectory, "events.jsonl"), stateLine);
  }

  private recordPiJsonLine(sessionId: string, logDirectory: string, rawLine: string): void {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      return;
    }

    const timestamp = nowIso();
    const event = summarizePiJsonEvent(
      rawLine,
      timestamp,
      `${this.currentSession.id}-${this.currentSession.events.length + 1}`,
    );
    const runnerSessionId = getPiSessionIdFromEvent(rawLine);

    if (runnerSessionId) {
      this.currentSession.runnerSessionId = runnerSessionId;
    }

    this.addEvent(event);
    void appendRedactedLog(path.join(logDirectory, "events.jsonl"), `${rawLine}\n`);
    void this.persistMetadata(this.currentSession);
  }

  private addEvent(event: RunnerEventSummary): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.events = [...this.currentSession.events, event].slice(-maxVisibleEvents);
    this.touchSession();
  }

  private markSessionStatus(status: RunnerSessionState["status"]): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.status = status;
    this.touchSession();
    void this.persistMetadata(this.currentSession);
  }

  private markSessionFailed(message: string): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.status = "failed";
    this.currentSession.error = message;
    this.currentSession.exitedAt = nowIso();
    this.touchSession();
    void this.persistMetadata(this.currentSession);
  }

  private touchSession(): void {
    if (this.currentSession) {
      this.currentSession.updatedAt = nowIso();
    }
  }

  private async persistMetadata(session: RunnerSessionState): Promise<void> {
    if (!existsSync(session.logDirectory)) {
      await mkdir(session.logDirectory, { recursive: true });
    }

    await writeFile(
      path.join(session.logDirectory, "metadata.json"),
      `${redactKnownSecrets(JSON.stringify(session, null, 2))}\n`,
      "utf8",
    );
  }
}

export function createPiRunnerSessionService(
  options: RunnerServiceOptions,
): PiRunnerSessionService {
  return new PiRunnerSessionService(options);
}

function createEvent(
  kind: RunnerEventSummary["kind"],
  label: string,
  message: string,
): RunnerEventSummary {
  return {
    id: `event-${Date.now()}`,
    timestamp: nowIso(),
    kind,
    label,
    message,
  };
}

async function appendRedactedLog(filePath: string, rawText: string): Promise<void> {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(filePath, redactKnownSecrets(rawText), "utf8");
}

export function redactKnownSecrets(text: string): string {
  let redactedText = text;

  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < 8 || !sensitiveEnvironmentNamePattern.test(name)) {
      continue;
    }

    redactedText = redactedText.split(value).join(`[redacted:${name}]`);
  }

  return redactedText;
}

function cloneSession(session: RunnerSessionState): RunnerSessionState {
  return JSON.parse(JSON.stringify(session)) as RunnerSessionState;
}

function createSessionId(pullRequestNumber: number): string {
  return `pi-pr-${pullRequestNumber}-${Date.now()}`;
}

function createWorktreeForRequest(
  request: BabysitStartRequest,
  managedWorktreeRoot: string,
): Promise<ManagedWorktree> {
  return createOrUpdateManagedWorktree(request.pullRequest, request.sourceRepoRoot, {
    managedWorktreeRoot,
  });
}

function isRunningStatus(status: RunnerSessionState["status"] | undefined): boolean {
  return status === "starting" || status === "running" || status === "aborting";
}

function nowIso(): string {
  return new Date().toISOString();
}
