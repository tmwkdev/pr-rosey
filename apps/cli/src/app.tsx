import type { ReactNode } from "react";
import { parseCommand } from "./commands/parse-command.js";
import { SnapshotCommand } from "./commands/snapshot-command.js";
import { UsageView } from "./ui/usage-view.js";

export interface CliProps {
  readonly args: readonly string[];
}

export function Cli({ args }: CliProps): ReactNode {
  const command = parseCommand(args);

  if (command.kind === "snapshot") {
    return <SnapshotCommand selector={command.selector} />;
  }

  return command.error === undefined ? (
    <UsageView exitCode={command.exitCode} />
  ) : (
    <UsageView error={command.error} exitCode={command.exitCode} />
  );
}
