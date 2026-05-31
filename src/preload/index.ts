import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels, type PrRoseyApi } from "../shared/ipc.js";

const api: PrRoseyApi = {
  dependencies: {
    check: () => ipcRenderer.invoke(ipcChannels.checkDependencies),
  },
  pullRequests: {
    fetchAuthoredOpen: () => ipcRenderer.invoke(ipcChannels.fetchPullRequests),
    openUrl: (url) => ipcRenderer.invoke(ipcChannels.openPullRequestUrl, url),
  },
};

contextBridge.exposeInMainWorld("prRosey", api);
