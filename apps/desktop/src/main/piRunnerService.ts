import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  inspectLocalRepository,
  listRepositoryMappings,
  type RepositoryMappingServiceOptions,
} from "@pr-rosey/desktop/main/repositoryMappingService";
import {
  createPiRunnerActivityEvent,
  type PiRunnerActivityEvent,
  type PiRunnerConversationMessage,
  type PiRunnerConversationStatus,
  type PiRunnerLogLine,
  type PiRunnerLogStream,
  type PiRunnerSessionSnapshot,
  summarizePiRunnerLogLine,
} from "@pr-rosey/desktop/shared/piRunner";
import type { PullRequestSummary } from "@pr-rosey/desktop/shared/pullRequests";
import {
  type RepositoryMapping,
  repositoryMappingKey,
} from "@pr-rosey/desktop/shared/repositoryMappings";

type PiAgentMessage = {
  content?: unknown;
  errorMessage?: unknown;
  isError?: unknown;
  role?: unknown;
  stopReason?: unknown;
  timestamp?: unknown;
  toolName?: unknown;
};

type PiAgentSessionEvent = {
  args?: unknown;
  errorMessage?: unknown;
  isError?: boolean;
  message?: unknown;
  messages?: unknown[];
  partialResult?: unknown;
  result?: unknown;
  toolName?: string;
  type: string;
  willRetry?: boolean;
};

type PiAgentSession = {
  messages: readonly unknown[];
  sessionFile: string | undefined;
  sessionId: string;
  abort: () => Promise<void>;
  dispose: () => void;
  prompt: (text: string) => Promise<void>;
  subscribe: (listener: (event: PiAgentSessionEvent) => void) => () => void;
};

type CreatePiAgentSession = (input: {
  cwd: string;
  sessionDir: string;
  tools: readonly string[];
}) => Promise<PiAgentSession>;

type PiRunnerRuntime = {
  agentSession: PiAgentSession;
  unsubscribe: () => void;
};

export type PiRunnerServiceOptions = RepositoryMappingServiceOptions & {
  createId?: () => string;
  createAgentSession?: CreatePiAgentSession;
};

const sessions = new Map<string, PiRunnerSessionSnapshot>();
const runtimes = new Map<string, PiRunnerRuntime>();
const maxVisibleActivityEvents = 80;
const maxVisibleOutputLines = 40;
const readOnlyPiToolNames = ["read", "grep", "find", "ls"] as const;

function nowIso(options: PiRunnerServiceOptions): string {
  return options.now?.() ?? new Date().toISOString();
}

function getSessionId(options: PiRunnerServiceOptions): string {
  return options.createId?.() ?? randomUUID();
}

function getLogFilePath(userDataPath: string, sessionId: string): string {
  return path.join(userDataPath, "pi-runner-logs", `${sessionId}.jsonl`);
}

function getPiSessionDir(userDataPath: string, sessionId: string): string {
  return path.join(userDataPath, "pi-agent-sessions", sessionId);
}

function isActiveSession(session: PiRunnerSessionSnapshot): boolean {
  return (
    session.status === "starting" || session.status === "running" || session.status === "aborting"
  );
}

function snapshotSession(session: PiRunnerSessionSnapshot): PiRunnerSessionSnapshot {
  return {
    ...session,
    activityEvents: [...session.activityEvents],
    conversation: [...session.conversation],
    outputLines: [...session.outputLines],
  };
}

async function recordSessionLine(
  session: PiRunnerSessionSnapshot,
  stream: PiRunnerLogStream,
  message: string,
  timestamp: string,
): Promise<void> {
  const rawLine: PiRunnerLogLine = { timestamp, stream, message };
  const line = summarizePiRunnerLogLine(rawLine);

  session.activityEvents = [...session.activityEvents, createPiRunnerActivityEvent(rawLine)].slice(
    -maxVisibleActivityEvents,
  );
  session.outputLines = [...session.outputLines, line].slice(-maxVisibleOutputLines);
  session.updatedAt = timestamp;

  await appendFile(session.logFilePath, `${JSON.stringify(line)}\n`, "utf8");
}

async function recordSessionActivity(
  session: PiRunnerSessionSnapshot,
  event: PiRunnerActivityEvent,
): Promise<void> {
  session.activityEvents = [...session.activityEvents, event].slice(-maxVisibleActivityEvents);
  session.updatedAt = event.timestamp;

  const line: PiRunnerLogLine = {
    timestamp: event.timestamp,
    stream: event.stream,
    message: event.summary,
  };
  session.outputLines = [...session.outputLines, line].slice(-maxVisibleOutputLines);

  await appendFile(session.logFilePath, `${JSON.stringify({ activity: event })}\n`, "utf8");
}

function recordSessionLineAsync(
  options: PiRunnerServiceOptions,
  session: PiRunnerSessionSnapshot,
  stream: PiRunnerLogStream,
  message: string,
): void {
  void recordSessionLine(session, stream, message, nowIso(options)).catch(() => undefined);
}

function findMappingForPullRequest(
  mappings: RepositoryMapping[],
  pullRequest: PullRequestSummary,
): RepositoryMapping | null {
  const pullRequestRepositoryKey = repositoryMappingKey(pullRequest.repository.nameWithOwner);

  return (
    mappings.find(
      (mapping) =>
        repositoryMappingKey(mapping.repositoryNameWithOwner) === pullRequestRepositoryKey,
    ) ?? null
  );
}

async function createDefaultPiAgentSession({
  cwd,
  sessionDir,
  tools,
}: {
  cwd: string;
  sessionDir: string;
  tools: readonly string[];
}): Promise<PiAgentSession> {
  const { createAgentSession, SessionManager } = await import("@earendil-works/pi-coding-agent");
  const { session } = await createAgentSession({
    cwd,
    sessionManager: SessionManager.create(cwd, sessionDir),
    tools: [...tools],
  });

  return session;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const lines: string[] = [];

  for (const item of content) {
    const record = asRecord(item);

    if (!record || typeof record.type !== "string") {
      continue;
    }

    if (record.type === "text" && typeof record.text === "string") {
      lines.push(record.text);
    }
  }

  return lines.join("\n").trim();
}

function getConversationStatus(
  message: PiAgentMessage,
  isStreaming: boolean,
): PiRunnerConversationStatus {
  if (isStreaming) {
    return "streaming";
  }

  if (message.stopReason === "aborted") {
    return "aborted";
  }

  if (message.stopReason === "error" || message.isError === true || message.errorMessage) {
    return "failed";
  }

  return "complete";
}

function mapAgentMessageToConversationMessage(
  message: unknown,
  index: number,
  isStreaming = false,
): PiRunnerConversationMessage | null {
  const record = asRecord(message) as PiAgentMessage | null;

  if (!record || typeof record.role !== "string") {
    return null;
  }

  const timestamp =
    typeof record.timestamp === "number"
      ? new Date(record.timestamp).toISOString()
      : new Date(0).toISOString();
  const body = getTextFromContent(record.content);
  const fallbackBody = typeof record.errorMessage === "string" ? record.errorMessage : "";
  const status = getConversationStatus(record, isStreaming);

  if (record.role === "user") {
    return {
      id: `message-${index}-${timestamp}`,
      role: "user",
      status,
      title: "Prompt",
      body: body || fallbackBody,
      timestamp,
    };
  }

  if (record.role === "assistant") {
    if (!body && !fallbackBody) {
      return null;
    }

    return {
      id: `message-${index}-${timestamp}`,
      role: "assistant",
      status,
      title: isStreaming ? "Pi is responding" : "Pi response",
      body: body || fallbackBody,
      timestamp,
    };
  }

  if (record.role === "toolResult") {
    return null;
  }

  return null;
}

function getConversationFromAgentMessages(
  messages: readonly unknown[],
  streamingMessage?: unknown,
): PiRunnerConversationMessage[] {
  const agentMessages = [...messages];

  if (streamingMessage) {
    const lastMessage = asRecord(agentMessages.at(-1));
    const streamingRecord = asRecord(streamingMessage);

    if (
      lastMessage &&
      streamingRecord &&
      lastMessage.role === streamingRecord.role &&
      lastMessage.timestamp === streamingRecord.timestamp
    ) {
      agentMessages[agentMessages.length - 1] = streamingMessage;
    } else {
      agentMessages.push(streamingMessage);
    }
  }

  return agentMessages
    .map((message, index) =>
      mapAgentMessageToConversationMessage(message, index, message === streamingMessage),
    )
    .filter((message): message is PiRunnerConversationMessage => Boolean(message));
}

function summarizeValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  const record = asRecord(value);

  if (record) {
    const content = getTextFromContent(record.content);
    if (content) {
      return content;
    }
  }

  return "";
}

function formatToolArgs(args: unknown): string | null {
  const record = asRecord(args);

  if (!record) {
    return null;
  }

  if (typeof record.command === "string") {
    return record.command;
  }

  return Object.entries(record)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");
}

function createActivityEventFromAgentEvent(
  event: PiAgentSessionEvent,
  timestamp: string,
): PiRunnerActivityEvent | null {
  switch (event.type) {
    case "agent_start":
      return {
        timestamp,
        kind: "system",
        status: "info",
        title: "Pi started",
        summary: "Pi AgentSession started.",
        detail: null,
        stream: "system",
      };
    case "turn_start":
      return {
        timestamp,
        kind: "system",
        status: "info",
        title: "Turn started",
        summary: "Pi started a new agent turn.",
        detail: null,
        stream: "system",
      };
    case "tool_execution_start":
      return {
        timestamp,
        kind: "tool-activity",
        status: "pending",
        title: event.toolName ? `Tool started: ${event.toolName}` : "Tool started",
        summary: event.toolName ? `Running ${event.toolName}.` : "Running tool.",
        detail: formatToolArgs(event.args),
        stream: "system",
      };
    case "tool_execution_update": {
      return {
        timestamp,
        kind: "tool-activity",
        status: "pending",
        title: event.toolName ? `Tool update: ${event.toolName}` : "Tool update",
        summary: event.toolName
          ? `${event.toolName} reported progress.`
          : "Tool reported progress.",
        detail: formatToolArgs(event.args),
        stream: "system",
      };
    }
    case "tool_execution_end": {
      const errorSummary = event.isError ? summarizeValue(event.result) : "";
      return {
        timestamp,
        kind: event.isError ? "error" : "tool-activity",
        status: event.isError ? "failed" : "success",
        title: event.toolName
          ? `Tool ${event.isError ? "failed" : "finished"}: ${event.toolName}`
          : `Tool ${event.isError ? "failed" : "finished"}`,
        summary:
          errorSummary ||
          (event.toolName ? `${event.toolName} finished.` : "Tool execution finished."),
        detail: formatToolArgs(event.args),
        stream: event.isError ? "stderr" : "system",
      };
    }
    case "agent_end":
      return {
        timestamp,
        kind: "system",
        status: "success",
        title: "Pi finished",
        summary: event.willRetry ? "Pi finished this attempt and will retry." : "Pi finished.",
        detail: null,
        stream: "system",
      };
    default:
      return null;
  }
}

export function createPiBabysitPrompt(pullRequest: PullRequestSummary, localPath: string): string {
  const failingChecks = pullRequest.ciStatus.checks
    .filter((check) => check.state === "failing")
    .map((check) => check.name);
  const pendingChecks = pullRequest.ciStatus.checks
    .filter((check) => check.state === "pending")
    .map((check) => check.name);

  return [
    "You are being launched by pr-rosey to babysit one pull request.",
    `Repository: ${pullRequest.repository.nameWithOwner}`,
    `Pull request: #${pullRequest.number} ${pullRequest.title}`,
    `URL: ${pullRequest.url}`,
    `Author: @${pullRequest.authorLogin}`,
    `Head branch: ${pullRequest.headRefName}`,
    `CI summary: ${pullRequest.ciStatus.state} (${pullRequest.ciStatus.passingCount} passing, ${pullRequest.ciStatus.failingCount} failing, ${pullRequest.ciStatus.pendingCount} pending, ${pullRequest.ciStatus.unknownCount} unknown)`,
    `Failing checks: ${failingChecks.length > 0 ? failingChecks.join(", ") : "none"}`,
    `Pending checks: ${pendingChecks.length > 0 ? pendingChecks.join(", ") : "none"}`,
    `Working directory: ${localPath}`,
    "Inspect the repository with read-only tools and report the next safe babysitting step for this PR.",
    "If CI is failing, identify the likely area to inspect next. If CI is pending, say what to wait for. If the PR looks ready, say so but do not stop just because CI is green.",
    "Only read, list, find, or grep files. Do not run shell commands.",
    "Do not edit files, commit, push, merge, comment on GitHub, rerun CI, or start follow-up work.",
    "Reply with BABYSIT REPORT, the evidence inspected, the current blocker or readiness state, and the next safe user-visible action.",
  ].join("\n");
}

export const createPiRepositoryVerificationPrompt = createPiBabysitPrompt;

export function listPiRunnerSessions(): PiRunnerSessionSnapshot[] {
  return [...sessions.values()]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .map(snapshotSession);
}

export function resetPiRunnerSessionsForTests(): void {
  for (const runtime of runtimes.values()) {
    runtime.unsubscribe();
    runtime.agentSession.dispose();
  }

  runtimes.clear();
  sessions.clear();
}

export async function startPiRepositoryVerification(
  options: PiRunnerServiceOptions,
  pullRequest: PullRequestSummary,
): Promise<PiRunnerSessionSnapshot> {
  if ([...sessions.values()].some(isActiveSession)) {
    throw new Error("A Pi babysit session is already running.");
  }

  const mappings = await listRepositoryMappings(options);
  const mapping = findMappingForPullRequest(mappings.mappings, pullRequest);

  if (!mapping) {
    throw new Error(
      `Map ${pullRequest.repository.nameWithOwner} to a trusted local clone in Settings before starting Pi.`,
    );
  }

  const inspection = await inspectLocalRepository(options, mapping.localPath);

  if (inspection.status !== "ready") {
    throw new Error(inspection.message);
  }

  if (
    !inspection.repositoryNameWithOwner ||
    repositoryMappingKey(inspection.repositoryNameWithOwner) !==
      repositoryMappingKey(pullRequest.repository.nameWithOwner)
  ) {
    throw new Error(
      `Mapped clone belongs to ${inspection.repositoryNameWithOwner ?? "an unknown repository"}, not ${
        pullRequest.repository.nameWithOwner
      }.`,
    );
  }

  const sessionId = getSessionId(options);
  const startedAt = nowIso(options);
  const logFilePath = getLogFilePath(options.userDataPath, sessionId);
  await mkdir(path.dirname(logFilePath), { recursive: true });

  const session: PiRunnerSessionSnapshot = {
    id: sessionId,
    status: "starting",
    repositoryNameWithOwner: pullRequest.repository.nameWithOwner,
    pullRequestNumber: pullRequest.number,
    pullRequestUrl: pullRequest.url,
    localPath: inspection.localPath,
    pid: null,
    startedAt,
    updatedAt: startedAt,
    exitedAt: null,
    exitCode: null,
    error: null,
    logFilePath,
    activityEvents: [],
    conversation: [],
    outputLines: [],
  };

  sessions.set(session.id, session);
  await recordSessionLine(
    session,
    "system",
    `Starting Pi AgentSession in ${inspection.localPath}.`,
    startedAt,
  );

  let agentSession: PiAgentSession;

  try {
    agentSession = await (options.createAgentSession ?? createDefaultPiAgentSession)({
      cwd: inspection.localPath,
      sessionDir: getPiSessionDir(options.userDataPath, session.id),
      tools: readOnlyPiToolNames,
    });
  } catch (error) {
    const failedAt = nowIso(options);
    session.status = "failed";
    session.error = error instanceof Error ? error.message : "Could not create Pi AgentSession.";
    session.exitedAt = failedAt;
    session.exitCode = 1;
    session.updatedAt = failedAt;
    await recordSessionLine(
      session,
      "system",
      `Pi AgentSession failed before prompt: ${session.error}`,
      failedAt,
    );

    throw error;
  }

  session.pid = null;
  session.status = "running";
  session.conversation = getConversationFromAgentMessages(agentSession.messages);
  await recordSessionLine(
    session,
    "system",
    `Created Pi AgentSession ${agentSession.sessionId}${
      agentSession.sessionFile ? ` at ${agentSession.sessionFile}` : ""
    }.`,
    nowIso(options),
  );

  const unsubscribe = agentSession.subscribe((event) => {
    const timestamp = nowIso(options);
    session.updatedAt = timestamp;

    if (event.type === "message_update" && event.message) {
      session.conversation = getConversationFromAgentMessages(agentSession.messages, event.message);
      return;
    }

    if (event.type === "message_end" || event.type === "turn_end" || event.type === "agent_end") {
      const messages =
        event.type === "agent_end" && Array.isArray(event.messages)
          ? event.messages
          : agentSession.messages;
      session.conversation = getConversationFromAgentMessages(messages);
    }

    const activityEvent = createActivityEventFromAgentEvent(event, timestamp);
    if (activityEvent) {
      void recordSessionActivity(session, activityEvent).catch(() => undefined);
    }

    if (event.type === "agent_end") {
      if (event.willRetry) {
        return;
      }

      session.status = session.status === "aborting" ? "aborted" : "exited";
      session.exitCode = 0;
      session.exitedAt = timestamp;
      runtimes.delete(session.id);
      unsubscribe();
      agentSession.dispose();
    }
  });

  runtimes.set(session.id, { agentSession, unsubscribe });

  await recordSessionLine(
    session,
    "system",
    `Sent read-only babysit prompt for ${pullRequest.repository.nameWithOwner}#${pullRequest.number}.`,
    nowIso(options),
  );
  const prompt = createPiBabysitPrompt(pullRequest, inspection.localPath);
  session.conversation = [
    ...session.conversation,
    {
      id: `${session.id}-prompt`,
      role: "user",
      status: "pending",
      title: "Prompt",
      body: prompt,
      timestamp: session.updatedAt,
    },
  ];

  void agentSession.prompt(prompt).catch((error: unknown) => {
    const timestamp = nowIso(options);
    session.status = session.status === "aborting" ? "aborted" : "failed";
    session.error = error instanceof Error ? error.message : "Pi AgentSession failed.";
    session.exitedAt = timestamp;
    session.exitCode = session.status === "aborted" ? 0 : 1;
    session.updatedAt = timestamp;
    runtimes.delete(session.id);
    unsubscribe();
    agentSession.dispose();
    recordSessionLineAsync(options, session, "system", `Pi AgentSession failed: ${session.error}`);
  });

  return snapshotSession(session);
}

export async function abortPiRunnerSession(
  options: PiRunnerServiceOptions,
  sessionId: string,
): Promise<PiRunnerSessionSnapshot> {
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error("Pi runner session was not found.");
  }

  const runtime = runtimes.get(sessionId);

  if (!runtime || !isActiveSession(session)) {
    return snapshotSession(session);
  }

  session.status = "aborting";
  session.updatedAt = nowIso(options);
  await recordSessionLine(session, "system", "Abort requested by user.", session.updatedAt);
  await runtime.agentSession.abort();

  return snapshotSession(session);
}
