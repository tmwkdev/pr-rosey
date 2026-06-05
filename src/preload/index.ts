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
  navigation: {
    onOpenSettingsPage: (listener) => {
      const handler = () => listener();

      ipcRenderer.on(ipcChannels.openSettingsPage, handler);

      return () => {
        ipcRenderer.removeListener(ipcChannels.openSettingsPage, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld("prRosey", api);
