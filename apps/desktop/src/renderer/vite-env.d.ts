/// <reference types="vite/client" />

import type { PrRoseyApi } from "@pr-rosey/desktop/shared/ipc";

declare global {
  interface Window {
    prRosey: PrRoseyApi;
  }
}
