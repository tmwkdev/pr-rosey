import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isNodeError } from "./errors.ts";
import type { CliOptions } from "./types.ts";

export async function acquireLock(options: CliOptions): Promise<() => Promise<void>> {
  if (options.fixturePath) {
    return async () => undefined;
  }

  const key = lockKey(options.repository ?? "current-repo", options.selector ?? "current-branch");
  const lockRoot = resolve(dirname(options.stateFile), "locks");
  const lockPath = resolve(lockRoot, key);
  await mkdir(lockRoot, { recursive: true });
  try {
    await mkdir(lockPath, { recursive: false });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error(
        `Another pr-watch session appears active for ${key}. Remove ${lockPath} if it is stale.`,
      );
    }
    throw error;
  }

  await writeFile(
    resolve(lockPath, "owner.json"),
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  return async () => {
    await rm(lockPath, { recursive: true, force: true });
  };
}

function lockKey(repository: string, selector: string): string {
  return `${repository}--${selector}`.replace(/[^a-zA-Z0-9_.-]+/g, "_");
}
