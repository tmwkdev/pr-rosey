import { describe, expect, it } from "vitest";
import { normalizeSnapshot } from "./snapshot.js";

describe("normalizeSnapshot", () => {
  it("extracts failed check run ids and prioritizes review feedback", () => {
    const snapshot = normalizeSnapshot({
      generatedAt: "2026-06-22T12:00:00.000Z",
      selector: "123",
      rawPr: {
        number: 123,
        title: "Add snapshot command",
        url: "https://github.com/example/repo/pull/123",
        state: "OPEN",
        headRefName: "feature/snapshot",
        headRefOid: "abc123",
        baseRefName: "main",
        isDraft: false,
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        reviewDecision: "CHANGES_REQUESTED",
      },
      rawChecks: [
        {
          name: "test",
          workflow: "CI",
          state: "FAILED",
          bucket: "fail",
          link: "https://github.com/example/repo/actions/runs/987654321/job/1",
          description: "Tests failed",
          startedAt: "2026-06-22T11:00:00Z",
          completedAt: "2026-06-22T11:05:00Z",
        },
      ],
      rawReviews: {
        comments: [{ id: 1 }],
        reviews: [{ id: 2 }],
        latestReviews: [{ id: 3 }],
        reviewDecision: "CHANGES_REQUESTED",
      },
    });

    expect(snapshot.source.selector).toBe("123");
    expect(snapshot.pr.number).toBe(123);
    expect(snapshot.checks.total).toBe(1);
    expect(snapshot.checks.failing[0]?.runId).toBe("987654321");
    expect(snapshot.reviews.hasActionableFeedback).toBe(true);
    expect(snapshot.nextAction.kind).toBe("inspect_review_feedback");
  });

  it("waits when checks are pending", () => {
    const snapshot = normalizeSnapshot({
      generatedAt: "2026-06-22T12:00:00.000Z",
      selector: null,
      rawPr: {
        state: "OPEN",
        reviewDecision: "",
      },
      rawChecks: [
        {
          name: "build",
          bucket: "pending",
        },
      ],
      rawReviews: {
        reviewDecision: "",
      },
    });

    expect(snapshot.nextAction).toEqual({
      kind: "wait_for_checks",
      reason: "1 check(s) are still pending.",
    });
  });

  it("marks a clean open pull request ready", () => {
    const snapshot = normalizeSnapshot({
      generatedAt: "2026-06-22T12:00:00.000Z",
      selector: null,
      rawPr: {
        state: "OPEN",
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        reviewDecision: "APPROVED",
      },
      rawChecks: [
        {
          name: "build",
          bucket: "pass",
        },
      ],
      rawReviews: {
        reviewDecision: "APPROVED",
      },
    });

    expect(snapshot.nextAction.kind).toBe("ready");
  });

  it("marks merged and closed pull requests done", () => {
    const snapshot = normalizeSnapshot({
      generatedAt: "2026-06-22T12:00:00.000Z",
      selector: null,
      rawPr: {
        state: "MERGED",
      },
      rawChecks: [],
      rawReviews: {},
    });

    expect(snapshot.nextAction).toEqual({
      kind: "done",
      reason: "Pull request is merged.",
    });
  });

  it("flags merge conflicts after checks and review feedback are clear", () => {
    const snapshot = normalizeSnapshot({
      generatedAt: "2026-06-22T12:00:00.000Z",
      selector: null,
      rawPr: {
        state: "OPEN",
        mergeable: "CONFLICTING",
        mergeStateStatus: "DIRTY",
      },
      rawChecks: [],
      rawReviews: {},
    });

    expect(snapshot.nextAction.kind).toBe("resolve_merge_conflict");
  });
});
