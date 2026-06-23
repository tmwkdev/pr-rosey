import { Box, Text } from "ink";
import type { ReactNode } from "react";

export interface ErrorViewProps {
  readonly message: string;
  readonly detail?: string;
}

export function ErrorView({ message, detail }: ErrorViewProps): ReactNode {
  return (
    <Box flexDirection="column">
      <Text color="red">{message}</Text>
      {detail === undefined ? null : <Text dimColor>{detail}</Text>}
    </Box>
  );
}
