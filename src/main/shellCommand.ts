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

export function runShellCommand(command: string, args: string[] = []): Promise<ShellCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15_000 }, (error, stdout, stderr) => {
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
    });
  });
}
