import { REPORT_SCHEMA } from "./constants.ts";
import { decideNextAction } from "./decision.ts";
import { readSnapshotFixture } from "./fixtures.ts";
import { collectFromGitHub } from "./githubClient.ts";
import { advanceStateAfterDecision, readState, writeState } from "./state.ts";
import type { CliOptions, WatchReport } from "./types.ts";

export async function evaluateOnce(options: CliOptions): Promise<WatchReport> {
  const state = await readState(options.stateFile);
  const snapshot = options.fixturePath
    ? await readSnapshotFixture(options.fixturePath)
    : await collectFromGitHub({ selector: options.selector, repository: options.repository });
  const decision = decideNextAction(snapshot, state, options.retryLimit);
  const nextState = advanceStateAfterDecision(state, snapshot, decision);
  if (JSON.stringify(nextState) !== JSON.stringify(state)) {
    await writeState(options.stateFile, nextState);
  }

  return {
    schemaVersion: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    target: {
      selector: options.selector ?? "current-branch",
      repository: options.repository ?? snapshot.repository,
      stateFile: options.stateFile,
    },
    snapshot,
    decision,
  };
}
