import { execFile } from "node:child_process";

export type ShellCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ShellCommandError = Error & {
  code?: string | number;
  stdout?: string;
  stderr?: string;
};

export type ShellCommandOptions = {
  cwd?: string;
  timeoutMs?: number;
};

export function runShellCommand(
  command: string,
  args: string[] = [],
  options: ShellCommandOptions = {},
): Promise<ShellCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd: options.cwd, timeout: options.timeoutMs ?? 15_000 },
      (error, stdout, stderr) => {
        if (error) {
          const shellError = error as ShellCommandError;
          shellError.stdout = stdout;
          shellError.stderr = stderr;
          reject(shellError);
          return;
        }

        resolve({
          exitCode: 0,
          stdout,
          stderr,
        });
      },
    );
  });
}
