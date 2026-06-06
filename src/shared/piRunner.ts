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
  outputLines: PiRunnerLogLine[];
};

export type StartPiRepositoryVerificationInput = {
  pullRequest: PullRequestSummary;
};

export function piRunnerSessionKey(pullRequest: PullRequestSummary): string {
  return `${pullRequest.repository.nameWithOwner}#${pullRequest.number}`;
}
