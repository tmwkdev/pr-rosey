import type { DependencyReadiness } from "./dependencies.js";

export const ipcChannels = {
  checkDependencies: "dependencies:check",
} as const;

export type PrRoseyApi = {
  dependencies: {
    check: () => Promise<DependencyReadiness>;
  };
};
