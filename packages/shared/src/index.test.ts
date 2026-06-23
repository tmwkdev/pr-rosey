import { describe, expect, it } from "vitest";
import { createGreeting } from "./index.js";

describe("createGreeting", () => {
    it("formats a hello-world greeting", () => {
        expect(createGreeting("world")).toBe("Hello, world!");
    });
});
