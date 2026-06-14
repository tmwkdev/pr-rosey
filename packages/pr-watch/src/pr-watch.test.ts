import { execFile } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  acquireLock,
  type CliOptions,
  createEmptyState,
  decideNextAction,
  evaluateOnce,
  type PullRequestSnapshot,
  readState,
  type WatchReport,
} from "./index.ts";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "../fixtures");
const scriptPath = resolve(here, "cli.ts");

describe("pr-watch decision scenarios", () => {
  it.each([
    ["closed-pr.json", "stop_terminal"],
    ["pending-ci.json", "watch_wait"],
    ["failed-job-early.json", "surface_failed_job"],
    ["failed-branch-ci.json", "diagnose_branch_failure"],
    ["failed-flaky-ci.json", "recommend_rerun"],
    ["new-review-feedback.json", "report_human_feedback"],
    ["draft-pending-review.json", "ready_keep_watching"],
    ["non-actionable-comment.json", "report_human_feedback"],
    ["green-open-pr.json", "ready_keep_watching"],
  ] as const)("selects %s -> %s", async (fixtureName, expectedAction) => {
    const decision = decideNextAction(await readFixture(fixtureName), createEmptyState());

    expect(decision.action).toBe(expectedAction);
  });

  it("asks for help when retry budget is exhausted for the current SHA", async () => {
    const snapshot = await readFixture("exhausted-retry-budget.json");
    const decision = decideNextAction(snapshot, {
      ...createEmptyState(),
      retryCountBySha: {
        [snapshot.ci.currentSha]: 2,
      },
    });

    expect(decision.action).toBe("ask_user");
    expect(decision.needsUser).toBe(true);
    expect(decision.reasons).toContain("retry_budget_exhausted");
  });

  it("ignores stale failed checks from an older commit", async () => {
    const snapshot = await readFixture("green-open-pr.json");
    const decision = decideNextAction({
      ...snapshot,
      ci: {
        currentSha: snapshot.ci.currentSha,
        checks: [
          {
            name: "Vitest",
            result: "fail",
            workflow: "CI",
            headSha: "older-sha",
            failureCause: "branch",
          },
          ...snapshot.ci.checks,
        ],
      },
    });

    expect(decision.action).toBe("ready_keep_watching");
    expect(decision.failedChecks).toHaveLength(0);
  });

  it("treats current-SHA cancelled timeout checks as rerunnable failures", async () => {
    const snapshot = await readFixture("green-open-pr.json");
    const decision = decideNextAction({
      ...snapshot,
      ci: {
        currentSha: snapshot.ci.currentSha,
        checks: [
          {
            name: "Runner timeout",
            result: "cancelled",
            workflow: "CI",
            headSha: snapshot.ci.currentSha,
            summary: "Timed out waiting for a runner.",
          },
        ],
      },
    });

    expect(decision.action).toBe("recommend_rerun");
    expect(decision.failedChecks).toHaveLength(1);
  });

  it("emits structured JSON from the TypeScript CLI", async () => {
    const { stdout } = await execFileAsync("node", [
      scriptPath,
      "--fixture",
      resolve(fixtureDir, "failed-branch-ci.json"),
    ]);
    const report = JSON.parse(stdout) as WatchReport;

    expect(report.schemaVersion).toBe("pr-watch-report/v1");
    expect(report.snapshot.schemaVersion).toBe("pr-watch-snapshot/v1");
    expect(report.decision.action).toBe("diagnose_branch_failure");
    expect(report.decision.failedChecks[0]?.url).toContain("/actions/runs/");
  });

  it("creates missing lock directories and refuses a duplicate watcher", async () => {
    const tempRoot = await mkdtemp(resolve(tmpdir(), "pr-watch-lock-"));
    const options: CliOptions = {
      selector: "22",
      repository: "example/repo",
      stateFile: resolve(tempRoot, "watch-state.json"),
      pretty: false,
      noLock: false,
      retryLimit: 2,
      maxIterations: 1,
    };

    const release = await acquireLock(options);

    await expect(stat(resolve(tempRoot, "locks"))).resolves.toBeDefined();
    await expect(acquireLock(options)).rejects.toThrow("Another pr-watch session appears active");

    await release();
  });

  it("persists retry recommendation budget per SHA", async () => {
    const tempRoot = await mkdtemp(resolve(tmpdir(), "pr-watch-state-"));
    const stateFile = resolve(tempRoot, "watch-state.json");
    const options = fixtureOptions("failed-flaky-ci.json", stateFile);

    const firstReport = await evaluateOnce(options);
    const secondReport = await evaluateOnce(options);
    const thirdReport = await evaluateOnce(options);
    const state = await readState(stateFile);

    expect(firstReport.decision.action).toBe("recommend_rerun");
    expect(firstReport.decision.retry.used).toBe(0);
    expect(secondReport.decision.action).toBe("recommend_rerun");
    expect(secondReport.decision.retry.used).toBe(1);
    expect(thirdReport.decision.action).toBe("ask_user");
    expect(thirdReport.decision.reasons).toContain("retry_budget_exhausted");
    expect(state.retryCountBySha["sha-flaky"]).toBe(2);
  });

  it("persists surfaced feedback as seen", async () => {
    const tempRoot = await mkdtemp(resolve(tmpdir(), "pr-watch-feedback-"));
    const stateFile = resolve(tempRoot, "watch-state.json");
    const options = fixtureOptions("non-actionable-comment.json", stateFile);

    const firstReport = await evaluateOnce(options);
    const secondReport = await evaluateOnce(options);
    const state = await readState(stateFile);

    expect(firstReport.decision.action).toBe("report_human_feedback");
    expect(secondReport.decision.action).toBe("ready_keep_watching");
    expect(state.seenFeedbackIds).toEqual(["issue:200"]);
  });
});

async function readFixture(name: string): Promise<PullRequestSnapshot> {
  const raw = await readFile(resolve(fixtureDir, name), "utf8");
  return JSON.parse(raw) as PullRequestSnapshot;
}

function fixtureOptions(fixtureName: string, stateFile: string): CliOptions {
  return {
    fixturePath: resolve(fixtureDir, fixtureName),
    stateFile,
    pretty: false,
    noLock: true,
    retryLimit: 2,
    maxIterations: 1,
  };
}
