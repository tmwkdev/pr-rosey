import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  inspectLocalRepository,
  listRepositoryMappings,
  type RepositoryMappingServiceOptions,
} from "@/main/repositoryMappingService";
import type {
  PiRunnerLogLine,
  PiRunnerLogStream,
  PiRunnerSessionSnapshot,
} from "@/shared/piRunner";
import type { PullRequestSummary } from "@/shared/pullRequests";
import { type RepositoryMapping, repositoryMappingKey } from "@/shared/repositoryMappings";

type PiRunnerProcess = {
  pid?: number;
  stderr: {
    on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  };
  stdin: {
    write(chunk: string): unknown;
  };
  stdout: {
    on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  };
  kill(signal?: NodeJS.Signals): boolean;
  on(event: "close", listener: (exitCode: number | null) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
};

type SpawnPiProcess = (
  command: string,
  args: string[],
  options: { cwd: string },
) => PiRunnerProcess;

export type PiRunnerServiceOptions = RepositoryMappingServiceOptions & {
  createId?: () => string;
  spawnProcess?: SpawnPiProcess;
};

const sessions = new Map<string, PiRunnerSessionSnapshot>();
const processes = new Map<string, PiRunnerProcess>();
const maxVisibleOutputLines = 40;

function nowIso(options: PiRunnerServiceOptions): string {
  return options.now?.() ?? new Date().toISOString();
}

function getSpawnProcess(options: PiRunnerServiceOptions): SpawnPiProcess {
  return (
    options.spawnProcess ??
    ((command, args, spawnOptions) =>
      spawn(command, args, {
        cwd: spawnOptions.cwd,
        stdio: "pipe",
      }))
  );
}

function getSessionId(options: PiRunnerServiceOptions): string {
  return options.createId?.() ?? randomUUID();
}

function getLogFilePath(userDataPath: string, sessionId: string): string {
  return path.join(userDataPath, "pi-runner-logs", `${sessionId}.jsonl`);
}

function isActiveSession(session: PiRunnerSessionSnapshot): boolean {
  return (
    session.status === "starting" || session.status === "running" || session.status === "aborting"
  );
}

function snapshotSession(session: PiRunnerSessionSnapshot): PiRunnerSessionSnapshot {
  return {
    ...session,
    outputLines: [...session.outputLines],
  };
}

async function recordSessionLine(
  session: PiRunnerSessionSnapshot,
  stream: PiRunnerLogStream,
  message: string,
  timestamp: string,
): Promise<void> {
  const line: PiRunnerLogLine = { timestamp, stream, message };
  session.outputLines = [...session.outputLines, line].slice(-maxVisibleOutputLines);
  session.updatedAt = timestamp;

  await appendFile(session.logFilePath, `${JSON.stringify(line)}\n`, "utf8");
}

function recordSessionLineAsync(
  options: PiRunnerServiceOptions,
  session: PiRunnerSessionSnapshot,
  stream: PiRunnerLogStream,
  message: string,
): void {
  void recordSessionLine(session, stream, message, nowIso(options)).catch(() => undefined);
}

function createLineCollector(onLine: (line: string) => void) {
  let buffer = "";

  return {
    push(chunk: Buffer | string) {
      buffer += chunk.toString();

      let lineBreakIndex = buffer.indexOf("\n");

      while (lineBreakIndex !== -1) {
        const line = buffer.slice(0, lineBreakIndex).replace(/\r$/, "");
        buffer = buffer.slice(lineBreakIndex + 1);

        if (line.trim()) {
          onLine(line);
        }

        lineBreakIndex = buffer.indexOf("\n");
      }
    },
    flush() {
      const line = buffer.replace(/\r$/, "");
      buffer = "";

      if (line.trim()) {
        onLine(line);
      }
    },
  };
}

function truncate(value: string): string {
  return value.length > 400 ? `${value.slice(0, 397)}...` : value;
}

function summarizePiStdoutLine(line: string): string {
  try {
    const parsed = JSON.parse(line) as {
      command?: unknown;
      error?: unknown;
      success?: unknown;
      type?: unknown;
    };

    if (parsed.type === "response" && typeof parsed.command === "string") {
      return `Pi response for ${parsed.command}: ${
        parsed.success === true ? "accepted" : "failed"
      }${typeof parsed.error === "string" ? ` (${parsed.error})` : ""}`;
    }

    if (typeof parsed.type === "string") {
      return `Pi ${parsed.type}: ${truncate(line)}`;
    }
  } catch {
    return truncate(line);
  }

  return truncate(line);
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

export function createPiRepositoryVerificationPrompt(
  pullRequest: PullRequestSummary,
  localPath: string,
): string {
  return [
    "You are being launched by pr-rosey for a read-only repository verification smoke test.",
    `Expected repository: ${pullRequest.repository.nameWithOwner}`,
    `Pull request: ${pullRequest.url}`,
    `Working directory: ${localPath}`,
    "Verify that your current working directory is inside this repository.",
    "Use only read-only commands such as pwd, git rev-parse --show-toplevel, and git remote get-url origin.",
    "Do not edit files, commit, push, merge, comment on GitHub, rerun CI, or start follow-up work.",
    "Reply with VERIFIED plus the repository root and origin remote if they match; otherwise explain the mismatch.",
  ].join("\n");
}

export function listPiRunnerSessions(): PiRunnerSessionSnapshot[] {
  return [...sessions.values()]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .map(snapshotSession);
}

export function resetPiRunnerSessionsForTests(): void {
  for (const childProcess of processes.values()) {
    childProcess.kill("SIGTERM");
  }

  processes.clear();
  sessions.clear();
}

export async function startPiRepositoryVerification(
  options: PiRunnerServiceOptions,
  pullRequest: PullRequestSummary,
): Promise<PiRunnerSessionSnapshot> {
  if ([...sessions.values()].some(isActiveSession)) {
    throw new Error("A Pi verification session is already running.");
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
    outputLines: [],
  };

  sessions.set(session.id, session);
  await recordSessionLine(
    session,
    "system",
    `Starting pi --mode rpc --no-session in ${inspection.localPath}.`,
    startedAt,
  );

  const childProcess = getSpawnProcess(options)(
    "pi",
    [
      "--mode",
      "rpc",
      "--no-session",
      "--name",
      `pr-rosey ${pullRequest.repository.nameWithOwner}#${pullRequest.number}`,
    ],
    { cwd: inspection.localPath },
  );
  const stdoutCollector = createLineCollector((line) => {
    recordSessionLineAsync(options, session, "stdout", summarizePiStdoutLine(line));
  });
  const stderrCollector = createLineCollector((line) => {
    recordSessionLineAsync(options, session, "stderr", truncate(line));
  });

  processes.set(session.id, childProcess);
  session.pid = childProcess.pid ?? null;
  session.status = "running";

  childProcess.stdout.on("data", (chunk) => {
    stdoutCollector.push(chunk);
  });
  childProcess.stderr.on("data", (chunk) => {
    stderrCollector.push(chunk);
  });
  childProcess.on("error", (error) => {
    session.status = "failed";
    session.error = error.message;
    session.exitedAt = nowIso(options);
    processes.delete(session.id);
    recordSessionLineAsync(options, session, "system", `Pi process failed: ${error.message}`);
  });
  childProcess.on("close", (exitCode) => {
    stdoutCollector.flush();
    stderrCollector.flush();

    if (session.status === "aborting") {
      session.status = "aborted";
    } else if (session.status !== "failed") {
      session.status = "exited";
    }

    session.exitCode = exitCode;
    session.exitedAt = nowIso(options);
    session.updatedAt = session.exitedAt;
    processes.delete(session.id);
    recordSessionLineAsync(options, session, "system", `Pi process exited with code ${exitCode}.`);
  });

  const promptCommand = {
    id: `${session.id}-verify`,
    type: "prompt",
    message: createPiRepositoryVerificationPrompt(pullRequest, inspection.localPath),
  };

  childProcess.stdin.write(`${JSON.stringify(promptCommand)}\n`);
  await recordSessionLine(
    session,
    "system",
    `Sent read-only repository verification prompt for ${pullRequest.repository.nameWithOwner}#${pullRequest.number}.`,
    nowIso(options),
  );

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

  const childProcess = processes.get(sessionId);

  if (!childProcess || !isActiveSession(session)) {
    return snapshotSession(session);
  }

  session.status = "aborting";
  session.updatedAt = nowIso(options);
  await recordSessionLine(session, "system", "Abort requested by user.", session.updatedAt);
  childProcess.kill("SIGTERM");

  return snapshotSession(session);
}
