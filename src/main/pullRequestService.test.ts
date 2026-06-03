import { describe, expect, it } from "vitest";
import {
  createAuthoredOpenPullRequestsSearchQuery,
  createDirectReviewRequestedOpenPullRequestsSearchQuery,
} from "@/main/pullRequestService";

describe("pull request service search queries", () => {
  it("searches authored pull requests for the authenticated user login", () => {
    expect(createAuthoredOpenPullRequestsSearchQuery("octocat")).toBe(
      "is:pr is:open author:octocat sort:updated-desc",
    );
  });

  it("searches direct review requests without including team-requested reviews", () => {
    const searchQuery = createDirectReviewRequestedOpenPullRequestsSearchQuery();

    expect(searchQuery).toBe("is:pr is:open user-review-requested:@me sort:updated-desc");
    expect(searchQuery).not.toMatch(/(^|\s)review-requested:/);
    expect(searchQuery).not.toContain("team-review-requested:");
  });
});
