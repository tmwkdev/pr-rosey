import { pathToFileURL } from "node:url";
import { runPrWatchCli } from "../../../packages/pr-watch/src/cli.ts";

export * from "../../../packages/pr-watch/src/index.ts";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runPrWatchCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
