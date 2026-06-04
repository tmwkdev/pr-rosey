import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels, type PrRoseyApi } from "@/shared/ipc";

const api: PrRoseyApi = {
  dependencies: {
    check: () => ipcRenderer.invoke(ipcChannels.checkDependencies),
  },
  pullRequests: {
    fetchAuthoredOpen: () => ipcRenderer.invoke(ipcChannels.fetchPullRequests),
    fetchReviewRequestedOpen: () =>
      ipcRenderer.invoke(ipcChannels.fetchReviewRequestedPullRequests),
    openUrl: (url) => ipcRenderer.invoke(ipcChannels.openPullRequestUrl, url),
  },
  runner: {
    checkPiReadiness: () => ipcRenderer.invoke(ipcChannels.checkPiRunnerReadiness),
    startBabysit: (request) => ipcRenderer.invoke(ipcChannels.startBabysitSession, request),
    abort: () => ipcRenderer.invoke(ipcChannels.abortBabysitSession),
    getCurrentSession: () => ipcRenderer.invoke(ipcChannels.getBabysitSession),
  },
};

contextBridge.exposeInMainWorld("prRosey", api);
