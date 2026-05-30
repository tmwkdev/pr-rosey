/// <reference types="vite/client" />

import type { PrRoseyApi } from "../shared/ipc";

declare global {
  interface Window {
    prRosey: PrRoseyApi;
  }
}
