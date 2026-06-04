import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { runShellCommand, type ShellCommandError } from "@/main/shellCommand";
import type { PiRunnerReadiness, RunnerAuthSource } from "@/shared/runner";

const authEnvironmentVariables = [
  "PI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
] as const;

const modelEnvironmentVariables = ["PI_MODEL", "OPENAI_MODEL", "ANTHROPIC_MODEL"] as const;

const authFileCandidates = [
  ".pi/auth.json",
  ".pi/config.json",
  ".config/pi/auth.json",
  ".config/pi/config.json",
] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function isMissingCommand(error: ShellCommandError): boolean {
  return error.code === "ENOENT";
}

function firstConfiguredEnvironmentVariable(candidates: readonly string[]): string | null {
  return candidates.find((name) => Boolean(process.env[name])) ?? null;
}

function firstExistingAuthFile(): string | null {
  return (
    authFileCandidates
      .map((candidate) => path.join(homedir(), candidate))
      .find((candidate) => existsSync(candidate)) ?? null
  );
}

async function checkPiInstall(): Promise<PiRunnerReadiness["installed"]> {
  try {
    const result = await runShellCommand("pi", ["--version"], { timeoutMs: 5_000 });
    const version = result.stdout.trim() || result.stderr.trim() || null;

    return {
      status: "ready",
      version,
      message: version ? `Pi is installed: ${version}.` : "Pi is installed.",
    };
  } catch (error) {
    const shellError = error as ShellCommandError;

    if (isMissingCommand(shellError)) {
      return {
        status: "missing",
        version: null,
        message: "Pi was not found. Install Pi and authenticate it before starting babysit.",
      };
    }

    return {
      status: "error",
      version: null,
      message: "Pi could not be checked.",
    };
  }
}

function checkPiAuth(): PiRunnerReadiness["auth"] {
  const environmentVariable = firstConfiguredEnvironmentVariable(authEnvironmentVariables);

  if (environmentVariable) {
    return readyAuth(
      "environment",
      environmentVariable,
      "Pi auth appears configured in the environment.",
    );
  }

  const authFile = firstExistingAuthFile();

  if (authFile) {
    return readyAuth(
      "auth-file",
      path.basename(authFile),
      "Pi auth appears configured in a local auth file.",
    );
  }

  return {
    status: "missing",
    source: "unknown",
    label: null,
    message: "Pi auth was not detected. Authenticate Pi before starting babysit.",
  };
}

function checkPiModel(): PiRunnerReadiness["model"] {
  const modelVariable = firstConfiguredEnvironmentVariable(modelEnvironmentVariables);

  if (modelVariable) {
    return {
      status: "ready",
      label: modelVariable,
      message: "A runner model appears configured in the environment.",
    };
  }

  return {
    status: "error",
    label: null,
    message: "A Pi model was not detected. Configure Pi's default model before starting babysit.",
  };
}

function readyAuth(
  source: RunnerAuthSource,
  label: string,
  message: string,
): PiRunnerReadiness["auth"] {
  return {
    status: "ready",
    source,
    label,
    message,
  };
}

export async function checkPiRunnerReadiness(): Promise<PiRunnerReadiness> {
  return {
    checkedAt: nowIso(),
    installed: await checkPiInstall(),
    auth: checkPiAuth(),
    model: checkPiModel(),
  };
}
