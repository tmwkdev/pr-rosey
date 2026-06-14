export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export function requiredString(value: string | undefined | null, field: string): string {
  if (!value) {
    throw new Error(`GitHub response is missing ${field}.`);
  }
  return value;
}

export function requiredNumber(value: number | undefined | null, field: string): number {
  if (typeof value !== "number") {
    throw new Error(`GitHub response is missing ${field}.`);
  }
  return value;
}
