import { formatCiStatusSummary, type PullRequestSummary } from "@/shared/pullRequests";

export type RunnerReadinessStatus = "ready" | "missing" | "error";

export type RunnerAuthSource = "environment" | "auth-file" | "command" | "unknown";

export type PiRunnerReadiness = {
  checkedAt: string;
  installed: {
    status: RunnerReadinessStatus;
    version: string | null;
    message: string;
  };
  auth: {
    status: RunnerReadinessStatus;
    source: RunnerAuthSource;
    label: string | null;
    message: string;
  };
  model: {
    status: RunnerReadinessStatus;
    label: string | null;
    message: string;
  };
};

export type ManagedWorktree = {
  kind: "local-worktree";
  repository: string;
  pullRequestNumber: number;
  sourceRepoRoot: string;
  worktreePath: string;
  headRefName: string;
  headSha: string | null;
};

export type BabysitStartRequest = {
  pullRequest: PullRequestSummary;
  sourceRepoRoot: string;
};

export type RunnerSessionStatus =
  | "starting"
  | "running"
  | "aborting"
  | "aborted"
  | "exited"
  | "failed";

export type RunnerEventKind = "session" | "output" | "tool" | "error" | "event";

export type RunnerEventSummary = {
  id: string;
  timestamp: string;
  kind: RunnerEventKind;
  label: string;
  message: string;
};

export type RunnerSessionState = {
  id: string;
  runner: "pi-rpc";
  status: RunnerSessionStatus;
  startedAt: string;
  updatedAt: string;
  exitedAt: string | null;
  pullRequest: {
    repository: string;
    number: number;
    title: string;
    url: string;
    headRefName: string;
  };
  worktree: ManagedWorktree | null;
  runnerSessionId: string | null;
  logDirectory: string;
  exitCode: number | null;
  error: string | null;
  events: RunnerEventSummary[];
};

export type RunnerSessionStartResult = {
  session: RunnerSessionState;
};

export type RunnerSessionReadResult = {
  session: RunnerSessionState | null;
};

type JsonObject = Record<string, unknown>;

export function createBabysitPrompt(
  pullRequest: PullRequestSummary,
  worktree: ManagedWorktree,
): string {
  return [
    "You are running inside a pr-rosey managed worktree for one pull request.",
    "",
    `Pull request: ${pullRequest.url}`,
    `Repository: ${pullRequest.repository.nameWithOwner}`,
    `PR number: #${pullRequest.number}`,
    `Branch: ${pullRequest.headRefName}`,
    `Worktree: ${worktree.worktreePath}`,
    `CI: ${formatCiStatusSummary(pullRequest.ciStatus)}`,
    "",
    "Inspect the PR and babysit the next useful fix. Do not push, merge, rerun CI, post PR comments, or resolve review threads.",
    "Keep work inside the managed worktree and report any action that needs user approval.",
  ].join("\n");
}

export function summarizePiJsonEvent(
  rawLine: string,
  timestamp: string,
  fallbackId: string,
): RunnerEventSummary {
  const trimmedLine = rawLine.trim();

  if (!trimmedLine) {
    return {
      id: fallbackId,
      timestamp,
      kind: "event",
      label: "Empty event",
      message: "",
    };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(trimmedLine);
  } catch {
    return {
      id: fallbackId,
      timestamp,
      kind: "event",
      label: "Unparsed event",
      message: trimmedLine,
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      id: fallbackId,
      timestamp,
      kind: "event",
      label: "Event",
      message: String(payload),
    };
  }

  const event = payload as JsonObject;
  const type = stringValue(event.type) ?? stringValue(event.event) ?? stringValue(event.kind);
  const message =
    getPiMessageText(event) ??
    stringValue(event.message) ??
    stringValue(event.text) ??
    stringValue(event.content) ??
    stringValue(event.delta) ??
    compactJson(event);

  if (matchesAny(type, ["error", "failed", "failure"])) {
    return {
      id: fallbackId,
      timestamp,
      kind: "error",
      label: "Runner error",
      message,
    };
  }

  if (matchesAny(type, ["tool", "tool_call", "tool_result", "command"])) {
    return {
      id: fallbackId,
      timestamp,
      kind: "tool",
      label: stringValue(event.name) ?? stringValue(event.tool) ?? "Tool activity",
      message,
    };
  }

  if (matchesAny(type, ["session", "session_started", "session.created"])) {
    return {
      id: fallbackId,
      timestamp,
      kind: "session",
      label: "Runner session",
      message: stringValue(event.id) ?? stringValue(event.sessionId) ?? message,
    };
  }

  if (type === "response") {
    const command = stringValue(event.command);
    const sessionId = getPiSessionIdFromResponse(event);

    return {
      id: fallbackId,
      timestamp,
      kind: command === "get_state" ? "session" : "event",
      label: command ? `Pi ${command}` : "Pi response",
      message: sessionId ?? (event.success === true ? "ok" : message),
    };
  }

  if (matchesAny(type, ["assistant", "output", "message", "content", "delta", "message_update"])) {
    return {
      id: fallbackId,
      timestamp,
      kind: "output",
      label: "Runner output",
      message,
    };
  }

  return {
    id: fallbackId,
    timestamp,
    kind: "event",
    label: type ? `Pi event: ${type}` : "Pi event",
    message,
  };
}

export function getPiSessionIdFromEvent(rawLine: string): string | null {
  try {
    const payload = JSON.parse(rawLine) as JsonObject;
    const type =
      stringValue(payload.type) ?? stringValue(payload.event) ?? stringValue(payload.kind);
    const responseSessionId = getPiSessionIdFromResponse(payload);

    if (responseSessionId) {
      return responseSessionId;
    }

    if (!matchesAny(type, ["session", "session_started", "session.created"])) {
      return null;
    }

    return stringValue(payload.id) ?? stringValue(payload.sessionId);
  } catch {
    return null;
  }
}

function getPiSessionIdFromResponse(event: JsonObject): string | null {
  if (stringValue(event.type) !== "response" || stringValue(event.command) !== "get_state") {
    return null;
  }

  const data = event.data;

  if (!data || typeof data !== "object") {
    return null;
  }

  return stringValue((data as JsonObject).sessionId);
}

function getPiMessageText(event: JsonObject): string | null {
  const assistantMessageEvent = event.assistantMessageEvent;

  if (assistantMessageEvent && typeof assistantMessageEvent === "object") {
    const assistantEvent = assistantMessageEvent as JsonObject;
    return (
      rawStringValue(assistantEvent.delta) ??
      rawStringValue(assistantEvent.content) ??
      getTextFromPiMessage(assistantEvent.partial)
    );
  }

  return getTextFromPiMessage(event.message);
}

function getTextFromPiMessage(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const content = (message as JsonObject).content;

  if (!Array.isArray(content)) {
    return null;
  }

  const textParts = content
    .map((part) => {
      if (!part || typeof part !== "object") {
        return null;
      }

      return rawStringValue((part as JsonObject).text);
    })
    .filter((part): part is string => part !== null);

  return textParts.length > 0 ? textParts.join("") : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function rawStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function matchesAny(value: string | null | undefined, candidates: string[]): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  return candidates.some((candidate) => normalizedValue.includes(candidate));
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
