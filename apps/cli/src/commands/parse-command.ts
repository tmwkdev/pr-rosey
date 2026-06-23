export type Command =
  | {
      readonly kind: "snapshot";
      readonly selector: string | null;
    }
  | {
      readonly kind: "usage";
      readonly error?: string;
      readonly exitCode: 0 | 1;
    };

export function parseCommand(args: readonly string[]): Command {
  const [command, ...rest] = args;

  if (command === "snapshot") {
    if (rest.length > 1) {
      return {
        kind: "usage",
        error: "snapshot accepts at most one PR selector.",
        exitCode: 1,
      };
    }

    return {
      kind: "snapshot",
      selector: rest[0] ?? null,
    };
  }

  return command === undefined
    ? {
        kind: "usage",
        exitCode: 0,
      }
    : {
        kind: "usage",
        error: `Unknown command: ${command}`,
        exitCode: 1,
      };
}
