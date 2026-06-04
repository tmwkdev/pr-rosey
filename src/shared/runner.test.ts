import { describe, expect, it } from "vitest";
import { getPiSessionIdFromEvent, summarizePiJsonEvent } from "@/shared/runner";

describe("Pi RPC event helpers", () => {
  it("summarizes assistant output events", () => {
    const event = summarizePiJsonEvent(
      JSON.stringify({ type: "assistant", message: "Inspecting failing tests" }),
      "2026-06-04T12:00:00.000Z",
      "event-1",
    );

    expect(event).toMatchObject({
      id: "event-1",
      kind: "output",
      label: "Runner output",
      message: "Inspecting failing tests",
    });
  });

  it("summarizes tool activity events", () => {
    const event = summarizePiJsonEvent(
      JSON.stringify({ type: "tool_call", name: "npm test", message: "started" }),
      "2026-06-04T12:00:00.000Z",
      "event-2",
    );

    expect(event).toMatchObject({
      kind: "tool",
      label: "npm test",
      message: "started",
    });
  });

  it("extracts runner session ids from session events", () => {
    expect(getPiSessionIdFromEvent(JSON.stringify({ type: "session_started", id: "pi-123" }))).toBe(
      "pi-123",
    );
  });

  it("extracts runner session ids from Pi get_state responses", () => {
    const rawEvent = JSON.stringify({
      type: "response",
      command: "get_state",
      success: true,
      data: {
        sessionId: "019e92c2-8304-74de-a904-3792e8febfb8",
      },
    });

    expect(getPiSessionIdFromEvent(rawEvent)).toBe("019e92c2-8304-74de-a904-3792e8febfb8");
    expect(summarizePiJsonEvent(rawEvent, "2026-06-04T12:00:00.000Z", "event-3")).toMatchObject({
      kind: "session",
      label: "Pi get_state",
      message: "019e92c2-8304-74de-a904-3792e8febfb8",
    });
  });

  it("summarizes Pi message_update deltas without dumping nested payloads", () => {
    const event = summarizePiJsonEvent(
      JSON.stringify({
        type: "message_update",
        assistantMessageEvent: {
          type: "text_delta",
          delta: "pr-rosey smoke ok",
          partial: {
            content: [
              {
                type: "text",
                text: "pr-rosey smoke ok",
              },
            ],
          },
        },
      }),
      "2026-06-04T12:00:00.000Z",
      "event-4",
    );

    expect(event).toMatchObject({
      kind: "output",
      label: "Runner output",
      message: "pr-rosey smoke ok",
    });
  });

  it("keeps whitespace-only Pi message_update deltas out of raw JSON fallback", () => {
    const event = summarizePiJsonEvent(
      JSON.stringify({
        type: "message_update",
        assistantMessageEvent: {
          type: "text_delta",
          delta: " \n",
          partial: {
            content: [
              {
                type: "text",
                text: " \n",
              },
            ],
          },
        },
      }),
      "2026-06-04T12:00:00.000Z",
      "event-5",
    );

    expect(event).toMatchObject({
      kind: "output",
      label: "Runner output",
      message: " \n",
    });
  });

  it("keeps unparseable JSONL visible instead of throwing", () => {
    const event = summarizePiJsonEvent("not-json", "2026-06-04T12:00:00.000Z", "event-3");

    expect(event).toMatchObject({
      kind: "event",
      label: "Unparsed event",
      message: "not-json",
    });
  });
});
