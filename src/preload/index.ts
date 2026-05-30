import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels, type PrRoseyApi } from "../shared/ipc.js";

const api: PrRoseyApi = {
  dependencies: {
    check: () => ipcRenderer.invoke(ipcChannels.checkDependencies),
  },
};

contextBridge.exposeInMainWorld("prRosey", api);
