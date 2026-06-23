import { Text, useApp } from "ink";
import { type ReactNode, useEffect, useState } from "react";
import { GitHubCliError } from "../github.js";
import { createSnapshot, type PullRequestSnapshot } from "../snapshot.js";
import { ErrorView } from "../ui/error-view.js";

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

export function SnapshotCommand({ selector }: SnapshotCommandProps): ReactNode {
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
