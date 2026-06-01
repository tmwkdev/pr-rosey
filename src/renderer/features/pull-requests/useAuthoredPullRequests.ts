import { useCallback, useEffect, useState } from "react";
import type { PullRequestDiscovery, PullRequestSummary } from "@/shared/pullRequests";

export function useAuthoredPullRequests() {
  const [discovery, setDiscovery] = useState<PullRequestDiscovery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openingUrl, setOpeningUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const result = await window.prRosey.pullRequests.fetchAuthoredOpen();
      setDiscovery(result);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not fetch authored pull requests from GitHub.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const openPullRequest = useCallback(async (pullRequest: PullRequestSummary) => {
    setOpeningUrl(pullRequest.url);
    setError(null);

    try {
      await window.prRosey.pullRequests.openUrl(pullRequest.url);
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "Could not open the pull request URL.",
      );
    } finally {
      setOpeningUrl(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    discovery,
    error,
    isRefreshing,
    openingUrl,
    openPullRequest,
    refresh,
  };
}
