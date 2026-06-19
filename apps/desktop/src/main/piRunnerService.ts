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
import {
  type CliOptions,
  DEFAULT_RETRY_LIMIT,
  evaluateOnce,
  type WatchAction,
  type WatchReport,
} from "@pr-rosey/pr-watch";

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
  agentSession?: PiAgentSession;
  promptedWatchKeys: Set<string>;
  promptQueue: Promise<void>;
  watchAbortController: AbortController;
  unsubscribe?: () => void;
};

type EvaluateWatchOnce = (options: CliOptions) => Promise<WatchReport>;

type Sleep = (milliseconds: number, signal: AbortSignal) => Promise<void>;

export type PiRunnerServiceOptions = RepositoryMappingServiceOptions & {
  createId?: () => string;
  createAgentSession?: CreatePiAgentSession;
  evaluateWatchOnce?: EvaluateWatchOnce;
  maxWatchIterations?: number;
  sleep?: Sleep;
  watchPollMilliseconds?: number;
};

const sessions = new Map<string, PiRunnerSessionSnapshot>();
const runtimes = new Map<string, PiRunnerRuntime>();
const maxVisibleActivityEvents = 80;
const maxVisibleOutputLines = 40;
const readOnlyPiToolNames = ["read", "grep", "find", "ls"] as const;
const defaultWatchPollMilliseconds = 60_000;

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

function getWatchStateFilePath(userDataPath: string, sessionId: string): string {
  return path.join(userDataPath, "pr-watch-sessions", `${sessionId}-state.json`);
}

function sleepWithAbort(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolveSleep) => {
    const timeoutId = setTimeout(resolveSleep, milliseconds);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        resolveSleep();
      },
      { once: true },
    );
  });
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

async function finishSession(
  session: PiRunnerSessionSnapshot,
  status: Extract<PiRunnerSessionSnapshot["status"], "exited" | "failed" | "aborted">,
  timestamp: string,
  exitCode: number,
  message: string,
  error: string | null = null,
): Promise<void> {
  if (!isActiveSession(session)) {
    return;
  }

  const runtime = runtimes.get(session.id);
  runtime?.watchAbortController.abort();
  runtime?.unsubscribe?.();
  runtime?.agentSession?.dispose();
  runtimes.delete(session.id);

  session.status = status;
  session.exitedAt = timestamp;
  session.exitCode = exitCode;
  session.error = error;
  session.updatedAt = timestamp;

  await recordSessionLine(session, status === "failed" ? "stderr" : "system", message, timestamp);
}

function describeWatchReport(report: WatchReport): string {
  const parts = [
    report.decision.summary,
    `SHA ${report.decision.currentSha.slice(0, 12)}`,
    `${report.decision.pendingChecks.length} pending`,
    `${report.decision.failedChecks.length} failed`,
    `${report.decision.feedback.length} feedback`,
  ];

  return parts.join(" / ");
}

function createWatchDecisionEvent(report: WatchReport, timestamp: string): PiRunnerActivityEvent {
  const needsUser =
    report.decision.needsUser || watchActionRequiresUserApproval(report.decision.action);
  const status: PiRunnerActivityEvent["status"] = report.decision.terminal
    ? "success"
    : needsUser
      ? "failed"
      : "info";

  return {
    timestamp,
    kind: needsUser ? "important-output" : "system",
    status,
    title: `PR watch: ${report.decision.action}`,
    summary: describeWatchReport(report),
    detail: createWatchReportDetail(report),
    stream: "system",
  };
}

function createWatchReportDetail(report: WatchReport): string | null {
  const lines = [
    `PR: ${report.snapshot.pr.url}`,
    `Lifecycle: ${report.snapshot.pr.lifecycle}`,
    `Merge state: ${report.snapshot.pr.mergeable} / ${report.snapshot.pr.mergeState}`,
    `Review decision: ${report.snapshot.pr.reviewDecision || "none"}`,
  ];

  for (const check of report.decision.failedChecks.slice(0, 5)) {
    lines.push(`Failed: ${check.name}${check.url ? ` (${check.url})` : ""}`);
  }

  for (const check of report.decision.pendingChecks.slice(0, 5)) {
    lines.push(`Pending: ${check.name}${check.url ? ` (${check.url})` : ""}`);
  }

  for (const item of report.decision.feedback.slice(0, 5)) {
    lines.push(`Feedback from @${item.author}: ${item.url ?? item.id}`);
  }

  return lines.join("\n");
}

function watchActionRequiresUserApproval(action: WatchAction): boolean {
  return action === "recommend_rerun" || action === "ask_user";
}

function shouldAskPiForReadOnlyDiagnosis(action: WatchAction): boolean {
  return action === "surface_failed_job" || action === "diagnose_branch_failure";
}

function getWatchDiagnosisPromptKey(report: WatchReport): string {
  const failedCheckNames = report.decision.failedChecks
    .map((check) => check.name)
    .sort()
    .join(",");

  return [report.decision.action, report.decision.currentSha, failedCheckNames].join(":");
}

function createPiWatchUpdatePrompt(report: WatchReport, localPath: string): string {
  const failedChecks = report.decision.failedChecks.map((check) =>
    [check.name, check.workflow, check.url, check.summary].filter(Boolean).join(" / "),
  );
  const pendingChecks = report.decision.pendingChecks.map((check) => check.name);
  const feedback = report.decision.feedback.map((item) =>
    [item.kind, `@${item.author}`, item.url, item.body.slice(0, 500)].filter(Boolean).join(" / "),
  );

  return [
    "PR-WATCH UPDATE",
    `Repository: ${report.snapshot.repository ?? report.target.repository ?? "unknown"}`,
    `Pull request: #${report.snapshot.pr.number} ${report.snapshot.pr.title}`,
    `URL: ${report.snapshot.pr.url}`,
    `Decision: ${report.decision.action}`,
    `Summary: ${report.decision.summary}`,
    `Reasons: ${report.decision.reasons.join(", ") || "none"}`,
    `Head SHA: ${report.decision.currentSha}`,
    `Merge state: ${report.snapshot.pr.mergeable} / ${report.snapshot.pr.mergeState}`,
    `Review decision: ${report.snapshot.pr.reviewDecision || "none"}`,
    `Working directory: ${localPath}`,
    `Failed checks: ${failedChecks.length > 0 ? failedChecks.join("\n- ") : "none"}`,
    `Pending checks: ${pendingChecks.length > 0 ? pendingChecks.join(", ") : "none"}`,
    `Feedback: ${feedback.length > 0 ? feedback.join("\n- ") : "none"}`,
    "Use read-only tools only. Do not run shell commands, edit files, commit, push, merge, comment on GitHub, resolve review threads, or rerun CI.",
    "Return BABYSIT REPORT with the evidence inspected, likely cause or readiness state, and the next safe user-visible action.",
  ].join("\n");
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

async function ensurePiAgentSession(
  options: PiRunnerServiceOptions,
  session: PiRunnerSessionSnapshot,
): Promise<PiAgentSession | null> {
  const runtime = runtimes.get(session.id);

  if (!runtime || !isActiveSession(session)) {
    return null;
  }

  if (runtime.agentSession) {
    return runtime.agentSession;
  }

  await recordSessionLine(
    session,
    "system",
    `Starting Pi AgentSession in ${session.localPath}.`,
    nowIso(options),
  );

  let agentSession: PiAgentSession;

  try {
    agentSession = await (options.createAgentSession ?? createDefaultPiAgentSession)({
      cwd: session.localPath,
      sessionDir: getPiSessionDir(options.userDataPath, session.id),
      tools: readOnlyPiToolNames,
    });
  } catch (error) {
    const failedAt = nowIso(options);
    const message = error instanceof Error ? error.message : "Could not create Pi AgentSession.";
    await finishSession(
      session,
      "failed",
      failedAt,
      1,
      `Pi AgentSession failed before prompt: ${message}`,
      message,
    );
    throw error;
  }

  session.pid = null;
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

      if (session.status === "aborting") {
        void finishSession(
          session,
          "aborted",
          timestamp,
          0,
          "Pi AgentSession stopped after abort.",
        ).catch(() => undefined);
      }
    }
  });

  runtime.agentSession = agentSession;
  runtime.unsubscribe = unsubscribe;

  return agentSession;
}

async function queuePiPrompt(
  options: PiRunnerServiceOptions,
  session: PiRunnerSessionSnapshot,
  prompt: string,
  logMessage: string,
): Promise<void> {
  const runtime = runtimes.get(session.id);

  if (!runtime || !isActiveSession(session)) {
    return;
  }

  const agentSession = await ensurePiAgentSession(options, session);

  if (!agentSession) {
    return;
  }

  const timestamp = nowIso(options);
  await recordSessionLine(session, "system", logMessage, timestamp);
  session.conversation = [
    ...session.conversation,
    {
      id: `${session.id}-prompt-${session.conversation.length + 1}`,
      role: "user",
      status: "pending",
      title: "Prompt",
      body: prompt,
      timestamp,
    },
  ];

  runtime.promptQueue = runtime.promptQueue
    .catch(() => undefined)
    .then(async () => {
      if (!runtime.watchAbortController.signal.aborted && isActiveSession(session)) {
        await agentSession.prompt(prompt);
      }
    })
    .catch((error: unknown) => {
      const failedAt = nowIso(options);
      const message = error instanceof Error ? error.message : "Pi AgentSession failed.";
      void finishSession(
        session,
        session.status === "aborting" ? "aborted" : "failed",
        failedAt,
        session.status === "aborting" ? 0 : 1,
        `Pi AgentSession failed: ${message}`,
        session.status === "aborting" ? null : message,
      ).catch(() => undefined);
    });

  await Promise.resolve();
}

function createWatchEvaluator(options: PiRunnerServiceOptions): EvaluateWatchOnce {
  return options.evaluateWatchOnce ?? evaluateOnce;
}

async function runBabysitWatchLoop(
  options: PiRunnerServiceOptions,
  session: PiRunnerSessionSnapshot,
  pullRequest: PullRequestSummary,
): Promise<void> {
  const runtime = runtimes.get(session.id);

  if (!runtime) {
    return;
  }

  const evaluateWatch = createWatchEvaluator(options);
  const sleep = options.sleep ?? sleepWithAbort;
  const pollMilliseconds = options.watchPollMilliseconds ?? defaultWatchPollMilliseconds;
  const maxIterations = options.maxWatchIterations ?? Number.POSITIVE_INFINITY;
  const stateFile = getWatchStateFilePath(options.userDataPath, session.id);

  await recordSessionActivity(session, {
    timestamp: nowIso(options),
    kind: "system",
    status: "info",
    title: "PR watch started",
    summary: `Watching ${pullRequest.repository.nameWithOwner}#${pullRequest.number} every ${Math.round(
      pollMilliseconds / 1000,
    )} seconds.`,
    detail: `State file: ${stateFile}`,
    stream: "system",
  });

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (runtime.watchAbortController.signal.aborted || !isActiveSession(session)) {
      return;
    }

    let report: WatchReport;

    try {
      report = await evaluateWatch({
        selector: pullRequest.url,
        repository: pullRequest.repository.nameWithOwner,
        stateFile,
        pretty: false,
        noLock: true,
        retryLimit: DEFAULT_RETRY_LIMIT,
        maxIterations: 1,
      });
    } catch (error) {
      const failedAt = nowIso(options);
      const message = error instanceof Error ? error.message : "Could not evaluate PR watch state.";
      await finishSession(session, "failed", failedAt, 1, `PR watch failed: ${message}`, message);
      return;
    }

    await recordSessionActivity(session, createWatchDecisionEvent(report, nowIso(options)));

    if (report.decision.terminal) {
      await finishSession(
        session,
        "exited",
        nowIso(options),
        0,
        `PR watch stopped: ${report.decision.summary}`,
      );
      return;
    }

    if (report.decision.needsUser || watchActionRequiresUserApproval(report.decision.action)) {
      await finishSession(
        session,
        "exited",
        nowIso(options),
        0,
        `PR watch needs user input: ${report.decision.summary}`,
      );
      return;
    }

    if (shouldAskPiForReadOnlyDiagnosis(report.decision.action)) {
      const diagnosisPromptKey = getWatchDiagnosisPromptKey(report);
      if (runtime.promptedWatchKeys.has(diagnosisPromptKey)) {
        await recordSessionActivity(session, {
          timestamp: nowIso(options),
          kind: "system",
          status: "info",
          title: "PR watch diagnosis already queued",
          summary: "The same current-SHA failure was already sent to Pi for read-only diagnosis.",
          detail: null,
          stream: "system",
        });
      } else {
        runtime.promptedWatchKeys.add(diagnosisPromptKey);
        await queuePiPrompt(
          options,
          session,
          createPiWatchUpdatePrompt(report, session.localPath),
          `Sent PR-watch follow-up prompt for ${report.decision.action}.`,
        );
      }
    }

    if (iteration + 1 >= maxIterations) {
      await recordSessionActivity(session, {
        timestamp: nowIso(options),
        kind: "system",
        status: "info",
        title: "PR watch paused",
        summary: `Stopped after ${maxIterations} watch iteration${maxIterations === 1 ? "" : "s"}.`,
        detail: null,
        stream: "system",
      });
      return;
    }

    await sleep(pollMilliseconds, runtime.watchAbortController.signal);
  }
}

export function listPiRunnerSessions(): PiRunnerSessionSnapshot[] {
  return [...sessions.values()]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .map(snapshotSession);
}

export function resetPiRunnerSessionsForTests(): void {
  for (const runtime of runtimes.values()) {
    runtime.watchAbortController.abort();
    runtime.unsubscribe?.();
    runtime.agentSession?.dispose();
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
  session.status = "running";
  await recordSessionLine(
    session,
    "system",
    `Starting PR watch for ${pullRequest.repository.nameWithOwner}#${pullRequest.number}.`,
    startedAt,
  );

  const watchAbortController = new AbortController();

  runtimes.set(session.id, {
    promptedWatchKeys: new Set(),
    promptQueue: Promise.resolve(),
    watchAbortController,
  });

  void runBabysitWatchLoop(options, session, pullRequest).catch((error: unknown) => {
    const timestamp = nowIso(options);
    const message = error instanceof Error ? error.message : "PR watch loop failed.";
    void finishSession(
      session,
      "failed",
      timestamp,
      1,
      `PR watch loop failed: ${message}`,
      message,
    );
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
  runtime.watchAbortController.abort();

  if (!runtime.agentSession) {
    await finishSession(session, "aborted", session.updatedAt, 0, "PR watch stopped after abort.");
    return snapshotSession(session);
  }

  await runtime.agentSession.abort();

  return snapshotSession(session);
}
