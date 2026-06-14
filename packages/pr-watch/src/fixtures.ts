import { readFile } from "node:fs/promises";
import { SNAPSHOT_SCHEMA } from "./constants.ts";
import type { PullRequestSnapshot } from "./types.ts";

export async function readSnapshotFixture(path: string): Promise<PullRequestSnapshot> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as PullRequestSnapshot;
  if (parsed.schemaVersion !== SNAPSHOT_SCHEMA) {
    throw new Error(`Fixture ${path} is not a ${SNAPSHOT_SCHEMA} snapshot.`);
  }
  return parsed;
}
