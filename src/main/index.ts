import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { checkDependencies } from "@/main/dependencyCheckService";
import { checkPiRunnerReadiness } from "@/main/piReadinessService";
import {
  createPiRunnerSessionService,
  type PiRunnerSessionService,
} from "@/main/piRunnerSessionService";
import {
  fetchAuthoredOpenPullRequests,
  fetchReviewRequestedOpenPullRequests,
} from "@/main/pullRequestService";
import { ipcChannels } from "@/shared/ipc";
import type { BabysitStartRequest } from "@/shared/runner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../..");
const preloadPath = path.join(__dirname, "../preload/index.cjs");
let runnerSessionService: PiRunnerSessionService | null = null;

function getRunnerSessionService(): PiRunnerSessionService {
  if (!runnerSessionService) {
    const userDataPath = app.getPath("userData");
    runnerSessionService = createPiRunnerSessionService({
      managedWorktreeRoot: path.join(userDataPath, "managed-worktrees"),
      sessionLogRoot: path.join(userDataPath, "runner-sessions"),
    });
  }

  return runnerSessionService;
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: "pr-rosey",
    backgroundColor: "#fbfaf7",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  void mainWindow.loadFile(path.join(appRoot, "out/renderer/index.html"));
}

ipcMain.handle(ipcChannels.checkDependencies, () => checkDependencies());
ipcMain.handle(ipcChannels.fetchPullRequests, () => fetchAuthoredOpenPullRequests());
ipcMain.handle(ipcChannels.fetchReviewRequestedPullRequests, () =>
  fetchReviewRequestedOpenPullRequests(),
);
ipcMain.handle(ipcChannels.openPullRequestUrl, async (_event, url: unknown) => {
  if (typeof url !== "string") {
    throw new Error("Pull request URL must be a string.");
  }

  const parsedUrl = new URL(url);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Pull request URL must use http or https.");
  }

  await shell.openExternal(parsedUrl.toString());
});
ipcMain.handle(ipcChannels.checkPiRunnerReadiness, () => checkPiRunnerReadiness());
ipcMain.handle(ipcChannels.startBabysitSession, (_event, request: unknown) => {
  assertBabysitStartRequest(request);
  return getRunnerSessionService().startBabysit(request);
});
ipcMain.handle(ipcChannels.abortBabysitSession, () =>
  getRunnerSessionService().abortCurrentSession(),
);
ipcMain.handle(ipcChannels.getBabysitSession, () => ({
  session: getRunnerSessionService().getCurrentSession(),
}));

void app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function assertBabysitStartRequest(request: unknown): asserts request is BabysitStartRequest {
  if (!request || typeof request !== "object") {
    throw new Error("Babysit start request must be an object.");
  }

  const candidate = request as Partial<BabysitStartRequest>;

  if (typeof candidate.sourceRepoRoot !== "string" || candidate.sourceRepoRoot.length === 0) {
    throw new Error("Babysit start request must include a local repository path.");
  }

  if (!candidate.pullRequest || typeof candidate.pullRequest !== "object") {
    throw new Error("Babysit start request must include a pull request.");
  }
}
