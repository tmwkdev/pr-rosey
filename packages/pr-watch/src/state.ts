import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DEFAULT_STATE_FILE, STATE_SCHEMA } from "./constants.ts";
import { isNodeError } from "./errors.ts";
import type { PullRequestSnapshot, WatchDecision, WatchState } from "./types.ts";

export function createEmptyState(): WatchState {
  return {
    schemaVersion: STATE_SCHEMA,
    seenFeedbackIds: [],
    retryCountBySha: {},
    activeWatches: {},
  };
}

export async function readState(path = DEFAULT_STATE_FILE): Promise<WatchState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<WatchState>;
    return {
      schemaVersion: STATE_SCHEMA,
      seenFeedbackIds: Array.isArray(parsed.seenFeedbackIds) ? parsed.seenFeedbackIds : [],
      retryCountBySha:
        parsed.retryCountBySha && typeof parsed.retryCountBySha === "object"
          ? parsed.retryCountBySha
          : {},
      activeWatches:
        parsed.activeWatches && typeof parsed.activeWatches === "object"
          ? parsed.activeWatches
          : {},
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return createEmptyState();
    }
    throw error;
  }
}

export async function writeState(path: string, state: WatchState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function advanceStateAfterDecision(
  state: WatchState,
  snapshot: PullRequestSnapshot,
  decision: WatchDecision,
): WatchState {
  const seenFeedbackIds = new Set(state.seenFeedbackIds);
  for (const item of decision.feedback) {
    if (!item.pending) {
      seenFeedbackIds.add(item.id);
    }
  }

  const retryCountBySha = { ...state.retryCountBySha };
  if (decision.action === "recommend_rerun") {
    retryCountBySha[snapshot.ci.currentSha] = (retryCountBySha[snapshot.ci.currentSha] ?? 0) + 1;
  }

  return {
    schemaVersion: STATE_SCHEMA,
    seenFeedbackIds: [...seenFeedbackIds].sort(),
    retryCountBySha,
    activeWatches: { ...state.activeWatches },
  };
}
