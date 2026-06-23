import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class GitHubCliError extends Error {
  public constructor(
    message: string,
    public readonly causeText?: string,
  ) {
    super(message);
    this.name = "GitHubCliError";
  }
}

export interface GhJsonOptions {
  readonly successExitCodes?: readonly number[];
}

export async function runGhJson(
  args: readonly string[],
  options: GhJsonOptions = {},
): Promise<unknown> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("gh", args, {
      maxBuffer: 20 * 1024 * 1024,
    }));
  } catch (error) {
    const exitCode = getNumberProperty(error, "code");
    const errorStdout = getStringProperty(error, "stdout");
    if (
      exitCode !== null &&
      options.successExitCodes?.includes(exitCode) === true &&
      errorStdout.trim().length > 0
    ) {
      return parseGhJson(args, errorStdout);
    }

    const causeText = getErrorText(error);
    throw new GitHubCliError(`GitHub CLI command failed: gh ${args.join(" ")}`, causeText);
  }

  return parseGhJson(args, stdout);
}

function parseGhJson(args: readonly string[], stdout: string): unknown {
  try {
    return JSON.parse(stdout) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new GitHubCliError(`GitHub CLI returned invalid JSON for: gh ${args.join(" ")}`, detail);
  }
}

function getNumberProperty(value: unknown, key: string): number | null {
  if (!isObject(value)) {
    return null;
  }

  const property = (value as Record<string, unknown>)[key];
  return typeof property === "number" && Number.isFinite(property) ? property : null;
}

function getErrorText(error: unknown): string | undefined {
  if (!isObject(error)) {
    return String(error);
  }

  const stderr = getStringProperty(error, "stderr");
  if (stderr.trim().length > 0) {
    return stderr.trim();
  }

  const message = getStringProperty(error, "message");
  return message.trim().length > 0 ? message.trim() : undefined;
}

function getStringProperty(value: unknown, key: string): string {
  if (!isObject(value)) {
    return "";
  }

  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : "";
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
