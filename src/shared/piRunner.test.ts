import { describe, expect, it } from "vitest";
import { createPiRunnerActivityEvent, summarizePiRunnerLogLine } from "@/shared/piRunner";

const timestamp = "2026-06-06T12:00:00.000Z";

describe("pi runner shared helpers", () => {
  it("normalizes prompt response JSONL into a Pi response event", () => {
    const line = {
      timestamp,
      stream: "stdout" as const,
      message: '{"type":"response","command":"prompt","success":true}',
    };

    expect(createPiRunnerActivityEvent(line)).toMatchObject({
      kind: "pi-response",
      status: "success",
      title: "Pi response",
      summary: "Pi response for prompt: accepted",
      stream: "stdout",
    });
    expect(summarizePiRunnerLogLine(line).message).toBe("Pi response for prompt: accepted");
  });

  it("normalizes tool-shaped JSONL into human-readable tool activity", () => {
    const event = createPiRunnerActivityEvent({
      timestamp,
      stream: "stdout",
      message: '{"type":"tool_call","name":"shell","input":{"command":"pwd"}}',
    });

    expect(event).toMatchObject({
      kind: "tool-activity",
      title: "Tool activity: shell",
      summary: "shell: pwd",
      stream: "stdout",
    });
    expect(event.detail).toContain("Type: tool_call");
    expect(event.detail).toContain("Command: shell");
    expect(event.detail).toContain("Shell command: pwd");
    expect(event.detail).not.toContain('{"type"');
  });

  it("does not surface successful tool result file contents in JSONL activity", () => {
    const event = createPiRunnerActivityEvent({
      timestamp,
      stream: "stdout",
      message:
        '{"type":"tool_result","toolName":"read","content":[{"type":"text","text":"secret file contents"}]}',
    });

    expect(event).toMatchObject({
      kind: "tool-activity",
      title: "Tool activity: read",
      summary: "Requested read.",
      stream: "stdout",
    });
    expect(event.summary).not.toContain("secret file contents");
    expect(event.detail).not.toContain("secret file contents");
  });

  it("keeps unrecognized stdout and stderr visible as bounded summaries", () => {
    expect(
      createPiRunnerActivityEvent({
        timestamp,
        stream: "stdout",
        message: "plain output",
      }),
    ).toMatchObject({
      kind: "important-output",
      summary: "plain output",
    });

    expect(
      createPiRunnerActivityEvent({
        timestamp,
        stream: "stderr",
        message: "plain error",
      }),
    ).toMatchObject({
      kind: "error",
      summary: "plain error",
    });
  });

  it("normalizes system prompt dispatch into a user prompt event", () => {
    expect(
      createPiRunnerActivityEvent({
        timestamp,
        stream: "system",
        message: "Sent read-only babysit prompt for owner/repo#12.",
      }),
    ).toMatchObject({
      kind: "user-prompt",
      title: "Babysit prompt",
    });
  });
});
