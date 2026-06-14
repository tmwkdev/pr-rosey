#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DEFAULT_RETRY_LIMIT, DEFAULT_STATE_FILE } from "./constants.ts";
import { acquireLock } from "./lock.ts";
import type { CliOptions, WatchReport } from "./types.ts";
import { evaluateOnce } from "./watch.ts";

export async function runPrWatchCli(args = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  const releaseLock = options.noLock ? async () => undefined : await acquireLock(options);

  try {
    let lastReport: WatchReport | undefined;
    for (let index = 0; index < options.maxIterations; index += 1) {
      lastReport = await evaluateOnce(options);
      process.stdout.write(`${formatReport(lastReport, options.pretty)}\n`);

      if (lastReport.decision.terminal || lastReport.decision.needsUser || !options.pollSeconds) {
        break;
      }

      await sleep(options.pollSeconds * 1000);
    }

    if (!lastReport) {
      throw new Error("No watch report was produced.");
    }
  } finally {
    await releaseLock();
  }
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    stateFile: DEFAULT_STATE_FILE,
    pretty: false,
    noLock: false,
    retryLimit: DEFAULT_RETRY_LIMIT,
    maxIterations: 1,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--pr") {
      index += 1;
      options.selector = requireValue(args, index, arg);
    } else if (arg === "--repo") {
      index += 1;
      options.repository = requireValue(args, index, arg);
    } else if (arg === "--fixture") {
      index += 1;
      options.fixturePath = requireValue(args, index, arg);
    } else if (arg === "--state-file") {
      index += 1;
      options.stateFile = requireValue(args, index, arg);
    } else if (arg === "--retry-limit") {
      index += 1;
      options.retryLimit = Number.parseInt(requireValue(args, index, arg), 10);
    } else if (arg === "--poll-seconds") {
      index += 1;
      options.pollSeconds = Number.parseInt(requireValue(args, index, arg), 10);
    } else if (arg === "--max-iterations") {
      index += 1;
      options.maxIterations = Number.parseInt(requireValue(args, index, arg), 10);
    } else if (arg === "--pretty") {
      options.pretty = true;
    } else if (arg === "--no-lock") {
      options.noLock = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(helpText());
      process.exit(0);
    } else if (!arg.startsWith("-") && !options.selector) {
      options.selector = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.retryLimit) || options.retryLimit < 0) {
    throw new Error("--retry-limit must be a non-negative integer.");
  }
  if (
    options.pollSeconds !== undefined &&
    (!Number.isInteger(options.pollSeconds) || options.pollSeconds < 5)
  ) {
    throw new Error("--poll-seconds must be an integer of at least 5.");
  }
  if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1) {
    throw new Error("--max-iterations must be a positive integer.");
  }

  return options;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function formatReport(report: WatchReport, pretty: boolean): string {
  return JSON.stringify(report, null, pretty ? 2 : 0);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, milliseconds);
  });
}

function helpText(): string {
  return `Usage: node packages/pr-watch/src/cli.ts [<pr-url|number|branch>] [options]

Options:
  --pr <target>             Pull request URL, number, or branch. Defaults to current branch.
  --repo <owner/repo>       Repository for a numeric PR selector or current-branch lookup.
  --fixture <path>          Read a snapshot fixture instead of calling gh.
  --state-file <path>       Local state JSON path. Default: ${DEFAULT_STATE_FILE}
  --retry-limit <count>     Retry budget per head SHA. Default: ${DEFAULT_RETRY_LIMIT}
  --poll-seconds <seconds>  Re-run until terminal/user-blocked, waiting at least 5 seconds.
  --max-iterations <count>  Limit polling iterations. Default: 1
  --pretty                 Pretty-print JSON.
  --no-lock                Skip local concurrent-watch lock protection.
`;
}

if (isCliEntrypoint()) {
  runPrWatchCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

function isCliEntrypoint(): boolean {
  const entrypointPath = process.argv[1];
  return entrypointPath
    ? import.meta.url === pathToFileURL(realpathSync(entrypointPath)).href
    : false;
}
