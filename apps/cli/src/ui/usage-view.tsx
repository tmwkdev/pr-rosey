import { Box, Text, useApp } from "ink";
import { type ReactNode, useEffect } from "react";

export interface UsageViewProps {
  readonly error?: string;
  readonly exitCode: 0 | 1;
}

export function UsageView({ error, exitCode }: UsageViewProps): ReactNode {
  const { exit, waitUntilRenderFlush } = useApp();

  useEffect(() => {
    process.exitCode = exitCode;

    void (async () => {
      await waitUntilRenderFlush();
      exit();
    })();
  }, [exit, exitCode, waitUntilRenderFlush]);

  return (
    <Box flexDirection="column">
      {error === undefined ? null : (
        <>
          <Text color="red">{error}</Text>
          <Text> </Text>
        </>
      )}
      <Text>{`Usage:
  pr-rosey snapshot [pr]

Commands:
  snapshot [pr]  Print a read-only JSON snapshot for the current or selected PR.

Examples:
  pr-rosey snapshot
  pr-rosey snapshot 123
  pr-rosey snapshot https://github.com/owner/repo/pull/123`}</Text>
    </Box>
  );
}
