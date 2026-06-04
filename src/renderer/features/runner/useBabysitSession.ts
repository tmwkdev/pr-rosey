import { useCallback, useEffect, useState } from "react";
import type { PullRequestSummary } from "@/shared/pullRequests";
import type { PiRunnerReadiness, RunnerSessionState } from "@/shared/runner";

const repositoryPathStoragePrefix = "pr-rosey:repo-path:";

function getRepositoryPathStorageKey(repository: string): string {
  return `${repositoryPathStoragePrefix}${repository}`;
}

export function useBabysitSession() {
  const [readiness, setReadiness] = useState<PiRunnerReadiness | null>(null);
  const [session, setSession] = useState<RunnerSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);
  const [startingPullRequestUrl, setStartingPullRequestUrl] = useState<string | null>(null);
  const [isAborting, setIsAborting] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const result = await window.prRosey.runner.getCurrentSession();
      setSession(result.session);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not read Pi session.");
    }
  }, []);

  const checkReadiness = useCallback(async () => {
    setIsCheckingReadiness(true);
    setError(null);

    try {
      setReadiness(await window.prRosey.runner.checkPiReadiness());
    } catch (readinessError) {
      setError(
        readinessError instanceof Error
          ? readinessError.message
          : "Could not check Pi runner readiness.",
      );
    } finally {
      setIsCheckingReadiness(false);
    }
  }, []);

  const startBabysit = useCallback(async (pullRequest: PullRequestSummary) => {
    const repository = pullRequest.repository.nameWithOwner;
    const storageKey = getRepositoryPathStorageKey(repository);
    const existingPath = window.localStorage.getItem(storageKey) ?? "";
    const sourceRepoRoot = window.prompt(`Local path for ${repository}`, existingPath);

    if (!sourceRepoRoot) {
      return;
    }

    setStartingPullRequestUrl(pullRequest.url);
    setError(null);

    try {
      window.localStorage.setItem(storageKey, sourceRepoRoot);
      const result = await window.prRosey.runner.startBabysit({
        pullRequest,
        sourceRepoRoot,
      });
      setSession(result.session);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start Pi babysit.");
    } finally {
      setStartingPullRequestUrl(null);
    }
  }, []);

  const abortSession = useCallback(async () => {
    setIsAborting(true);
    setError(null);

    try {
      setSession(await window.prRosey.runner.abort());
    } catch (abortError) {
      setError(abortError instanceof Error ? abortError.message : "Could not abort Pi babysit.");
    } finally {
      setIsAborting(false);
    }
  }, []);

  useEffect(() => {
    void checkReadiness();
    void refreshSession();
  }, [checkReadiness, refreshSession]);

  useEffect(() => {
    if (!session || !["starting", "running", "aborting"].includes(session.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshSession();
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [refreshSession, session]);

  return {
    readiness,
    session,
    error,
    isCheckingReadiness,
    startingPullRequestUrl,
    isAborting,
    checkReadiness,
    startBabysit,
    abortSession,
  };
}
