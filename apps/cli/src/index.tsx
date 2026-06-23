#!/usr/bin/env node

import { useEffect, useState, type ReactNode } from "react";
import { Box, Text, render, useApp } from "ink";
import { GitHubCliError } from "./github.js";
import { createSnapshot, type PullRequestSnapshot } from "./snapshot.js";

const args = process.argv.slice(2);

const app = render(<Cli args={args} />, {
  stderr: process.stderr,
  stdout: process.stderr,
});

try {
  await app.waitUntilExit();
} catch (error) {
  process.exitCode = 1;
  console.error(error);
}

type Command =
  | {
      readonly kind: "snapshot";
      readonly selector: string | null;
    }
  | {
      readonly kind: "usage";
      readonly error?: string;
      readonly exitCode: 0 | 1;
    };

interface CliProps {
  readonly args: readonly string[];
}

function Cli({ args }: CliProps): ReactNode {
  const command = parseCommand(args);

  if (command.kind === "snapshot") {
    return <SnapshotCommand selector={command.selector} />;
  }

  return command.error === undefined ? (
    <UsageView exitCode={command.exitCode} />
  ) : (
    <UsageView error={command.error} exitCode={command.exitCode} />
  );
}

function parseCommand(args: readonly string[]): Command {
  const [command, ...rest] = args;

  if (command === "snapshot") {
    if (rest.length > 1) {
      return {
        kind: "usage",
        error: "snapshot accepts at most one PR selector.",
        exitCode: 1,
      };
    }

    return {
      kind: "snapshot",
      selector: rest[0] ?? null,
    };
  }

  return command === undefined
    ? {
        kind: "usage",
        exitCode: 0,
      }
    : {
        kind: "usage",
        error: `Unknown command: ${command}`,
        exitCode: 1,
      };
}

interface SnapshotCommandProps {
  readonly selector: string | null;
}

type SnapshotState =
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "done";
      readonly snapshot: PullRequestSnapshot;
    }
  | {
      readonly status: "github-error";
      readonly message: string;
      readonly causeText?: string;
    }
  | {
      readonly status: "unexpected-error";
      readonly error: unknown;
    };

function SnapshotCommand({ selector }: SnapshotCommandProps): ReactNode {
  const { exit, waitUntilRenderFlush } = useApp();
  const [state, setState] = useState<SnapshotState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const snapshot = await createSnapshot(selector);
        if (isMounted) {
          setState({ status: "done", snapshot });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof GitHubCliError) {
          setState(toGitHubErrorState(error));
          return;
        }

        setState({ status: "unexpected-error", error });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selector]);

  useEffect(() => {
    if (state.status === "loading") {
      return;
    }

    let isMounted = true;

    void (async () => {
      await waitUntilRenderFlush();

      if (!isMounted) {
        return;
      }

      if (state.status === "done") {
        process.stdout.write(`${JSON.stringify(state.snapshot, null, 2)}\n`);
        process.exitCode = 0;
        exit();
        return;
      }

      process.exitCode = 1;
      if (state.status === "unexpected-error") {
        exit(toError(state.error));
        return;
      }

      exit();
    })();

    return () => {
      isMounted = false;
    };
  }, [exit, state, waitUntilRenderFlush]);

  if (state.status === "loading") {
    return <Text color="cyan">Reading pull request snapshot...</Text>;
  }

  if (state.status === "github-error") {
    return state.causeText === undefined ? (
      <ErrorView message={state.message} />
    ) : (
      <ErrorView message={state.message} detail={state.causeText} />
    );
  }

  if (state.status === "unexpected-error") {
    return <ErrorView message={toError(state.error).message} />;
  }

  return null;
}

function toGitHubErrorState(error: GitHubCliError): SnapshotState {
  return error.causeText === undefined
    ? {
        status: "github-error",
        message: error.message,
      }
    : {
        status: "github-error",
        message: error.message,
        causeText: error.causeText,
      };
}

interface UsageViewProps {
  readonly error?: string;
  readonly exitCode: 0 | 1;
}

function UsageView({ error, exitCode }: UsageViewProps): ReactNode {
  const { exit, waitUntilRenderFlush } = useApp();

  useEffect(() => {
    process.exitCode = exitCode;

    void (async () => {
      await waitUntilRenderFlush();
      exit();
    })();
  }, [exit, exitCode, waitUntilRenderFlush]);

  return (
    <Box flexDirection="column">
      {error === undefined ? null : (
        <>
          <Text color="red">{error}</Text>
          <Text> </Text>
        </>
      )}
      <Text>{`Usage:
  pr-rosey snapshot [pr]

Commands:
  snapshot [pr]  Print a read-only JSON snapshot for the current or selected PR.

Examples:
  pr-rosey snapshot
  pr-rosey snapshot 123
  pr-rosey snapshot https://github.com/owner/repo/pull/123`}</Text>
    </Box>
  );
}

interface ErrorViewProps {
  readonly message: string;
  readonly detail?: string;
}

function ErrorView({ message, detail }: ErrorViewProps): ReactNode {
  return (
    <Box flexDirection="column">
      <Text color="red">{message}</Text>
      {detail === undefined ? null : <Text dimColor>{detail}</Text>}
    </Box>
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
