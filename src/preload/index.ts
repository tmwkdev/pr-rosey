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
  repositoryMappings: {
    chooseLocalRepository: () => ipcRenderer.invoke(ipcChannels.chooseLocalRepository),
    list: () => ipcRenderer.invoke(ipcChannels.listRepositoryMappings),
    remove: (repositoryNameWithOwner) =>
      ipcRenderer.invoke(ipcChannels.removeRepositoryMapping, repositoryNameWithOwner),
    save: (input) => ipcRenderer.invoke(ipcChannels.saveRepositoryMapping, input),
  },
  piRunner: {
    abortSession: (sessionId) => ipcRenderer.invoke(ipcChannels.abortPiRunnerSession, sessionId),
    listSessions: () => ipcRenderer.invoke(ipcChannels.listPiRunnerSessions),
    startRepositoryVerification: (input) =>
      ipcRenderer.invoke(ipcChannels.startPiRepositoryVerification, input),
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
