import { describe, expect, it } from "vitest";
import { parseCommand } from "./parse-command.js";

describe("parseCommand", () => {
  it("shows usage when no command is provided", () => {
    expect(parseCommand([])).toEqual({
      kind: "usage",
      exitCode: 0,
    });
  });

  it("parses snapshot without a selector", () => {
    expect(parseCommand(["snapshot"])).toEqual({
      kind: "snapshot",
      selector: null,
    });
  });

  it("parses snapshot with a selector", () => {
    expect(parseCommand(["snapshot", "123"])).toEqual({
      kind: "snapshot",
      selector: "123",
    });
  });

  it("rejects unknown commands", () => {
    expect(parseCommand(["review"])).toEqual({
      kind: "usage",
      error: "Unknown command: review",
      exitCode: 1,
    });
  });

  it("rejects extra snapshot selectors", () => {
    expect(parseCommand(["snapshot", "123", "456"])).toEqual({
      kind: "usage",
      error: "snapshot accepts at most one PR selector.",
      exitCode: 1,
    });
  });
});
