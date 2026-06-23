import { describe, expect, it } from "vitest";
import { createGreeting } from "./greeting.js";

describe("createGreeting", () => {
  it("formats a hello-world greeting", () => {
    expect(createGreeting("world")).toBe("Hello, world!");
  });
});
