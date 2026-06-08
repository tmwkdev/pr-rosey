import type { PullRequestSummary } from "@/shared/pullRequests";

export type PiRunnerSessionStatus =
  | "starting"
  | "running"
  | "aborting"
  | "exited"
  | "failed"
  | "aborted";

export type PiRunnerLogStream = "system" | "stdout" | "stderr";

export type PiRunnerLogLine = {
  timestamp: string;
  stream: PiRunnerLogStream;
  message: string;
};

export type PiRunnerActivityKind =
  | "system"
  | "user-prompt"
  | "pi-response"
  | "tool-activity"
  | "important-output"
  | "error";

export type PiRunnerActivityStatus = "info" | "pending" | "success" | "failed";

export type PiRunnerActivityEvent = {
  timestamp: string;
  kind: PiRunnerActivityKind;
  status: PiRunnerActivityStatus;
  title: string;
  summary: string;
  detail: string | null;
  stream: PiRunnerLogStream;
};

export type PiRunnerConversationRole = "user" | "assistant";

export type PiRunnerConversationStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "failed"
  | "aborted";

export type PiRunnerConversationMessage = {
  id: string;
  role: PiRunnerConversationRole;
  status: PiRunnerConversationStatus;
  title: string;
  body: string;
  timestamp: string;
};

export type PiRunnerSessionSnapshot = {
  id: string;
  status: PiRunnerSessionStatus;
  repositoryNameWithOwner: string;
  pullRequestNumber: number;
  pullRequestUrl: string;
  localPath: string;
  pid: number | null;
  startedAt: string;
  updatedAt: string;
  exitedAt: string | null;
  exitCode: number | null;
  error: string | null;
  logFilePath: string;
  activityEvents: PiRunnerActivityEvent[];
  conversation: PiRunnerConversationMessage[];
  outputLines: PiRunnerLogLine[];
};

export type StartPiRepositoryVerificationInput = {
  pullRequest: PullRequestSummary;
};

export function piRunnerSessionKey(pullRequest: PullRequestSummary): string {
  return `${pullRequest.repository.nameWithOwner}#${pullRequest.number}`;
}

type JsonRecord = Record<string, unknown>;

const maxPiRunnerSummaryLength = 400;

function truncate(value: string, maxLength = maxPiRunnerSummaryLength): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function getNestedStringValue(record: JsonRecord, keys: string[]): string | null {
  const directValue = getStringValue(record, keys);

  if (directValue) {
    return directValue;
  }

  for (const value of Object.values(record)) {
    if (!isJsonRecord(value)) {
      continue;
    }

    const nestedValue = getStringValue(value, keys);

    if (nestedValue) {
      return nestedValue;
    }
  }

  return null;
}

function getChildRecord(record: JsonRecord, key: string): JsonRecord | null {
  const value = record[key];

  return isJsonRecord(value) ? value : null;
}

function appendDetailLine(lines: string[], label: string, value: string | null): void {
  if (!value) {
    return;
  }

  const line = `${label}: ${truncate(value)}`;

  if (!lines.includes(line)) {
    lines.push(line);
  }
}

function createJsonRecordDetail(record: JsonRecord): string | null {
  const lines: string[] = [];
  const input = getChildRecord(record, "input");
  const argumentsRecord = getChildRecord(record, "arguments");

  appendDetailLine(lines, "Type", getStringValue(record, ["type", "event", "kind"]));
  appendDetailLine(lines, "Role", getStringValue(record, ["role"]));
  appendDetailLine(
    lines,
    "Command",
    getStringValue(record, ["command", "name", "tool", "toolName"]),
  );
  appendDetailLine(lines, "Shell command", input ? getStringValue(input, ["command"]) : null);
  appendDetailLine(
    lines,
    "Shell command",
    argumentsRecord ? getStringValue(argumentsRecord, ["command"]) : null,
  );
  appendDetailLine(lines, "Error", getNestedStringValue(record, ["error", "errorMessage"]));

  if (record.success === true) {
    lines.push("Result: accepted");
  } else if (record.success === false) {
    lines.push("Result: failed");
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function getJsonRecordSummary(record: JsonRecord): string {
  const type = getStringValue(record, ["type", "event", "kind"]);
  const command = getStringValue(record, ["command", "name", "tool", "toolName"]);
  const input = getChildRecord(record, "input");
  const argumentsRecord = getChildRecord(record, "arguments");
  const shellCommand =
    (input ? getStringValue(input, ["command"]) : null) ??
    (argumentsRecord ? getStringValue(argumentsRecord, ["command"]) : null);

  if (command && shellCommand) {
    return `${command}: ${shellCommand}`;
  }

  if (command) {
    return `Requested ${command}.`;
  }

  if (type) {
    return `Pi ${type}.`;
  }

  return "Pi reported an update.";
}

function parseJsonRecord(message: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(message) as unknown;
    return isJsonRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createSystemActivityEvent(line: PiRunnerLogLine): PiRunnerActivityEvent {
  if (line.message.startsWith("Sent read-only repository verification prompt")) {
    return {
      timestamp: line.timestamp,
      kind: "user-prompt",
      status: "success",
      title: "Repository verification prompt",
      summary: line.message,
      detail: null,
      stream: line.stream,
    };
  }

  if (line.message.startsWith("Abort requested")) {
    return {
      timestamp: line.timestamp,
      kind: "system",
      status: "pending",
      title: "Stop requested",
      summary: line.message,
      detail: null,
      stream: line.stream,
    };
  }

  return {
    timestamp: line.timestamp,
    kind: "system",
    status: "info",
    title: "System",
    summary: line.message,
    detail: null,
    stream: line.stream,
  };
}

function createStdoutJsonActivityEvent(
  line: PiRunnerLogLine,
  record: JsonRecord,
): PiRunnerActivityEvent {
  const type = getStringValue(record, ["type", "event", "kind"])?.toLowerCase() ?? "stdout";
  const role = getStringValue(record, ["role"])?.toLowerCase();
  const command = getStringValue(record, ["command", "name", "tool", "toolName"]);
  const text = getNestedStringValue(record, ["message", "content", "text", "summary", "output"]);
  const error = getNestedStringValue(record, ["error", "errorMessage"]);
  const success = record.success === true;
  const failed = record.success === false || Boolean(error) || type.includes("error");
  const status: PiRunnerActivityStatus = failed ? "failed" : success ? "success" : "info";
  const detail = createJsonRecordDetail(record);
  const summary = text ?? getJsonRecordSummary(record);

  if (failed) {
    return {
      timestamp: line.timestamp,
      kind: "error",
      status: "failed",
      title: command ? `Pi error: ${command}` : "Pi error",
      summary: truncate(error ?? getJsonRecordSummary(record)),
      detail,
      stream: line.stream,
    };
  }

  if (type.includes("tool") || (command && command !== "prompt" && type !== "response")) {
    return {
      timestamp: line.timestamp,
      kind: "tool-activity",
      status,
      title: command ? `Tool activity: ${command}` : "Tool activity",
      summary: truncate(getJsonRecordSummary(record)),
      detail,
      stream: line.stream,
    };
  }

  if (role === "user" || type.includes("prompt") || command === "prompt") {
    return {
      timestamp: line.timestamp,
      kind: type === "response" ? "pi-response" : "user-prompt",
      status,
      title: type === "response" ? "Pi response" : "User prompt",
      summary:
        type === "response"
          ? `Pi response for prompt: ${success ? "accepted" : "received"}`
          : truncate(summary),
      detail,
      stream: line.stream,
    };
  }

  if (role === "assistant" || type.includes("response") || type.includes("assistant")) {
    return {
      timestamp: line.timestamp,
      kind: "pi-response",
      status,
      title: "Pi response",
      summary: truncate(summary),
      detail,
      stream: line.stream,
    };
  }

  return {
    timestamp: line.timestamp,
    kind: "important-output",
    status,
    title: typeof record.type === "string" ? `Pi ${record.type}` : "Pi output",
    summary: truncate(summary),
    detail,
    stream: line.stream,
  };
}

export function createPiRunnerActivityEvent(line: PiRunnerLogLine): PiRunnerActivityEvent {
  if (line.stream === "system") {
    return createSystemActivityEvent(line);
  }

  if (line.stream === "stderr") {
    return {
      timestamp: line.timestamp,
      kind: "error",
      status: "failed",
      title: "Error output",
      summary: truncate(line.message),
      detail: null,
      stream: line.stream,
    };
  }

  const parsed = parseJsonRecord(line.message);

  if (parsed) {
    return createStdoutJsonActivityEvent(line, parsed);
  }

  return {
    timestamp: line.timestamp,
    kind: "important-output",
    status: "info",
    title: "Output",
    summary: truncate(line.message),
    detail: null,
    stream: line.stream,
  };
}

export function summarizePiRunnerLogLine(line: PiRunnerLogLine): PiRunnerLogLine {
  if (line.stream !== "stdout") {
    return {
      ...line,
      message: truncate(line.message),
    };
  }

  const event = createPiRunnerActivityEvent(line);

  return {
    ...line,
    message: event.summary,
  };
}
