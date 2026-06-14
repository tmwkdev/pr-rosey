import {
  formatCiStatusSummary,
  type PullRequestCiStatus,
} from "@pr-rosey/desktop/shared/pullRequests";
import { describe, expect, it } from "vitest";

function createCiStatus(overrides: Partial<PullRequestCiStatus>): PullRequestCiStatus {
  return {
    state: "passing",
    commitOid: "abc123",
    totalCount: 1,
    passingCount: 1,
    failingCount: 0,
    pendingCount: 0,
    skippedCount: 0,
    unknownCount: 0,
    checks: [],
    isIncomplete: false,
    ...overrides,
  };
}

describe("pull request CI helpers", () => {
  it("summarizes check counts in the most actionable order", () => {
    const summary = formatCiStatusSummary(
      createCiStatus({
        state: "failing",
        totalCount: 4,
        passingCount: 2,
        failingCount: 1,
        pendingCount: 1,
      }),
    );

    expect(summary).toBe("1 failing, 1 pending, 2 passing");
  });

  it("labels no-check and unknown states without relying on counts", () => {
    expect(formatCiStatusSummary(createCiStatus({ state: "no-checks", totalCount: 0 }))).toBe(
      "No CI checks found",
    );
    expect(formatCiStatusSummary(createCiStatus({ state: "unknown", totalCount: 0 }))).toBe(
      "CI status unavailable",
    );
  });

  it("marks summaries when not every check was returned", () => {
    expect(formatCiStatusSummary(createCiStatus({ isIncomplete: true }))).toBe(
      "1 passing, more checks on GitHub",
    );
  });
});
