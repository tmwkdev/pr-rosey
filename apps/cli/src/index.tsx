#!/usr/bin/env node

import { render } from "ink";
import { Cli } from "./app.js";

const app = render(<Cli args={process.argv.slice(2)} />, {
  stderr: process.stderr,
  stdout: process.stderr,
});

try {
  await app.waitUntilExit();
} catch (error) {
  process.exitCode = 1;
  console.error(error);
}
