import type {
  DependencyCheckResult,
  DependencyId,
  DependencyReadiness,
} from "../shared/dependencies.js";
import { dependencyLabels } from "../shared/dependencies.js";
import { runShellCommand, type ShellCommandError } from "./shellCommand.js";

function isMissingCommand(error: ShellCommandError): boolean {
  return error.code === "ENOENT";
}

function nowIso(): string {
  return new Date().toISOString();
}

function readyResult(id: DependencyId, message: string, checkedAt: string): DependencyCheckResult {
  return {
    id,
    label: dependencyLabels[id],
    status: "ready",
    message,
    checkedAt,
  };
}

function missingResult(
  id: DependencyId,
  message: string,
  checkedAt: string,
): DependencyCheckResult {
  return {
    id,
    label: dependencyLabels[id],
    status: "missing",
    message,
    checkedAt,
  };
}

function errorResult(id: DependencyId, message: string, checkedAt: string): DependencyCheckResult {
  return {
    id,
    label: dependencyLabels[id],
    status: "error",
    message,
    checkedAt,
  };
}

async function checkGitHubCli(checkedAt: string): Promise<DependencyCheckResult> {
  try {
    await runShellCommand("gh", ["--version"]);
    return readyResult("gh", "GitHub CLI is installed.", checkedAt);
  } catch (error) {
    const shellError = error as ShellCommandError;

    if (isMissingCommand(shellError)) {
      return missingResult(
        "gh",
        "GitHub CLI was not found. Install gh and authenticate before using pr-rosey.",
        checkedAt,
      );
    }

    return errorResult("gh", "GitHub CLI could not be checked.", checkedAt);
  }
}

async function checkGitHubAuth(checkedAt: string): Promise<DependencyCheckResult> {
  try {
    await runShellCommand("gh", ["auth", "status"]);
    return readyResult("ghAuth", "GitHub CLI authentication is ready.", checkedAt);
  } catch (error) {
    const shellError = error as ShellCommandError;

    if (isMissingCommand(shellError)) {
      return missingResult(
        "ghAuth",
        "GitHub CLI was not found. Install gh and authenticate before using pr-rosey.",
        checkedAt,
      );
    }

    return errorResult(
      "ghAuth",
      "GitHub CLI is installed, but authentication failed. Run gh auth login.",
      checkedAt,
    );
  }
}

async function checkGit(checkedAt: string): Promise<DependencyCheckResult> {
  try {
    await runShellCommand("git", ["--version"]);
    return readyResult("git", "Git is installed.", checkedAt);
  } catch (error) {
    const shellError = error as ShellCommandError;

    if (isMissingCommand(shellError)) {
      return missingResult(
        "git",
        "Git was not found. Install git before using pr-rosey.",
        checkedAt,
      );
    }

    return errorResult("git", "Git could not be checked.", checkedAt);
  }
}

export async function checkDependencies(): Promise<DependencyReadiness> {
  const checkedAt = nowIso();
  const dependencies = await Promise.all([
    checkGitHubCli(checkedAt),
    checkGitHubAuth(checkedAt),
    checkGit(checkedAt),
  ]);

  return {
    checkedAt,
    dependencies,
  };
}
