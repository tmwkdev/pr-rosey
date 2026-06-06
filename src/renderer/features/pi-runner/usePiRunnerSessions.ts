import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PiRunnerSessionSnapshot,
  StartPiRepositoryVerificationInput,
} from "@/shared/piRunner";
import type { PullRequestSummary } from "@/shared/pullRequests";

function isActiveSession(session: PiRunnerSessionSnapshot): boolean {
  return (
    session.status === "starting" || session.status === "running" || session.status === "aborting"
  );
}

export function usePiRunnerSessions() {
  const [sessions, setSessions] = useState<PiRunnerSessionSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startingPullRequestUrl, setStartingPullRequestUrl] = useState<string | null>(null);
  const [abortingSessionId, setAbortingSessionId] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await window.prRosey.piRunner.listSessions());
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : "Could not refresh Pi sessions.",
      );
    }
  }, []);

  const startRepositoryVerification = useCallback(async (pullRequest: PullRequestSummary) => {
    setStartingPullRequestUrl(pullRequest.url);
    setError(null);

    const input: StartPiRepositoryVerificationInput = { pullRequest };

    try {
      const session = await window.prRosey.piRunner.startRepositoryVerification(input);
      setSessions((currentSessions) => [
        session,
        ...currentSessions.filter((currentSession) => currentSession.id !== session.id),
      ]);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Could not start Pi repository verification.",
      );
    } finally {
      setStartingPullRequestUrl(null);
    }
  }, []);

  const abortSession = useCallback(async (sessionId: string) => {
    setAbortingSessionId(sessionId);
    setError(null);

    try {
      const session = await window.prRosey.piRunner.abortSession(sessionId);
      setSessions((currentSessions) =>
        currentSessions.map((currentSession) =>
          currentSession.id === session.id ? session : currentSession,
        ),
      );
    } catch (abortError) {
      setError(abortError instanceof Error ? abortError.message : "Could not abort Pi session.");
    } finally {
      setAbortingSessionId(null);
    }
  }, []);

  const hasActiveSession = useMemo(() => sessions.some(isActiveSession), [sessions]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!hasActiveSession) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshSessions();
    }, 1500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasActiveSession, refreshSessions]);

  return {
    abortingSessionId,
    abortSession,
    error,
    hasActiveSession,
    refreshSessions,
    sessions,
    startingPullRequestUrl,
    startRepositoryVerification,
  };
}
