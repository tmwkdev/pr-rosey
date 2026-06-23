#!/usr/bin/env node

import { GitHubCliError } from "./github.js";
import { createSnapshot } from "./snapshot.js";

const args = process.argv.slice(2);

await main(args);

async function main(args: readonly string[]): Promise<void> {
  const [command, ...rest] = args;

  if (command === "snapshot") {
    await runSnapshot(rest);
    return;
  }

  printUsage(command === undefined ? undefined : `Unknown command: ${command}`);
  process.exitCode = command === undefined ? 0 : 1;
}

async function runSnapshot(args: readonly string[]): Promise<void> {
  if (args.length > 1) {
    printUsage("snapshot accepts at most one PR selector.");
    process.exitCode = 1;
    return;
  }

  const selector = args[0] ?? null;

  try {
    const snapshot = await createSnapshot(selector);
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (error) {
    process.exitCode = 1;
    if (error instanceof GitHubCliError) {
      console.error(error.message);
      if (error.causeText !== undefined) {
        console.error(error.causeText);
      }
      return;
    }

    throw error;
  }
}

function printUsage(error?: string): void {
  if (error !== undefined) {
    console.error(error);
    console.error("");
  }

  console.error(`Usage:
  pr-rosey snapshot [pr]

Commands:
  snapshot [pr]  Print a read-only JSON snapshot for the current or selected PR.

Examples:
  pr-rosey snapshot
  pr-rosey snapshot 123
  pr-rosey snapshot https://github.com/owner/repo/pull/123`);
}
