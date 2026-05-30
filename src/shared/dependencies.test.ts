import { describe, expect, it } from "vitest";
import { createLoadingDependencies, dependencyIds, statusLabels } from "./dependencies.js";

describe("dependency shared types", () => {
  it("creates a loading row for every dependency", () => {
    const rows = createLoadingDependencies();

    expect(rows.map((row) => row.id)).toEqual(dependencyIds);
    expect(rows.every((row) => row.status === "loading")).toBe(true);
  });

  it("has a human label for every status", () => {
    expect(statusLabels.ready).toBe("Ready");
    expect(statusLabels.missing).toBe("Missing");
    expect(statusLabels.error).toBe("Error");
  });
});
