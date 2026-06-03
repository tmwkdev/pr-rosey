import { useCallback, useEffect, useState } from "react";
import type { PullRequestDiscovery, PullRequestSummary } from "@/shared/pullRequests";

type PullRequestFetcher = () => Promise<PullRequestDiscovery>;

function usePullRequestDiscovery(
  fetchPullRequests: PullRequestFetcher,
  fallbackErrorMessage: string,
) {
  const [discovery, setDiscovery] = useState<PullRequestDiscovery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openingUrl, setOpeningUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const result = await fetchPullRequests();
      setDiscovery(result);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : fallbackErrorMessage);
    } finally {
      setIsRefreshing(false);
    }
  }, [fallbackErrorMessage, fetchPullRequests]);

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

const fetchAuthoredOpenPullRequests = () => window.prRosey.pullRequests.fetchAuthoredOpen();

const fetchReviewRequestedOpenPullRequests = () =>
  window.prRosey.pullRequests.fetchReviewRequestedOpen();

export function useAuthoredPullRequests() {
  return usePullRequestDiscovery(
    fetchAuthoredOpenPullRequests,
    "Could not fetch authored pull requests from GitHub.",
  );
}

export function useReviewRequestedPullRequests() {
  return usePullRequestDiscovery(
    fetchReviewRequestedOpenPullRequests,
    "Could not fetch review-requested pull requests from GitHub.",
  );
}
