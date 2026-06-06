import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  type OpenDialogOptions,
  shell,
} from "electron";
import { checkDependencies } from "@/main/dependencyCheckService";
import {
  fetchAuthoredOpenPullRequests,
  fetchReviewRequestedOpenPullRequests,
} from "@/main/pullRequestService";
import {
  inspectLocalRepository,
  listRepositoryMappings,
  removeRepositoryMapping,
  saveRepositoryMapping,
} from "@/main/repositoryMappingService";
import { ipcChannels } from "@/shared/ipc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../..");
const preloadPath = path.join(__dirname, "../preload/index.cjs");
const appIconPath = path.join(appRoot, "assets/brand/pr-rosey-app-icon-transparent.png");

function getAppIconPath(): string | undefined {
  return fs.existsSync(appIconPath) ? appIconPath : undefined;
}

function openSettingsPage(): void {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

  targetWindow?.webContents.send(ipcChannels.openSettingsPage);
}

function createApplicationMenu(): Menu {
  const settingsMenuItem: MenuItemConstructorOptions = {
    label: "Settings...",
    accelerator: "CommandOrControl+,",
    click: openSettingsPage,
  };
  const appOrFileMenu: MenuItemConstructorOptions =
    process.platform === "darwin"
      ? {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            settingsMenuItem,
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }
      : {
          label: "File",
          submenu: [settingsMenuItem, { type: "separator" }, { role: "quit" }],
        };

  const template: MenuItemConstructorOptions[] = [
    appOrFileMenu,
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];

  return Menu.buildFromTemplate(template);
}

function createWindow(): void {
  const icon = getAppIconPath();
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: "pr-rosey",
    backgroundColor: "#fbfaf7",
    ...(icon ? { icon } : {}),
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

function repositoryMappingOptions() {
  return {
    userDataPath: app.getPath("userData"),
  };
}

ipcMain.handle(ipcChannels.checkDependencies, () => checkDependencies());
ipcMain.handle(ipcChannels.fetchPullRequests, () => fetchAuthoredOpenPullRequests());
ipcMain.handle(ipcChannels.fetchReviewRequestedPullRequests, () =>
  fetchReviewRequestedOpenPullRequests(),
);
ipcMain.handle(ipcChannels.listRepositoryMappings, () =>
  listRepositoryMappings(repositoryMappingOptions()),
);
ipcMain.handle(ipcChannels.chooseLocalRepository, async (event) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const options: OpenDialogOptions = {
    buttonLabel: "Use Repository",
    message: "Choose a local clone to connect to a GitHub repository.",
    properties: ["openDirectory"],
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  return inspectLocalRepository(repositoryMappingOptions(), result.filePaths[0]);
});
ipcMain.handle(ipcChannels.saveRepositoryMapping, (_event, input: unknown) => {
  if (!input || typeof input !== "object") {
    throw new Error("Repository mapping input is required.");
  }

  const mappingInput = input as {
    repositoryNameWithOwner?: unknown;
    localPath?: unknown;
  };

  if (
    typeof mappingInput.repositoryNameWithOwner !== "string" ||
    typeof mappingInput.localPath !== "string"
  ) {
    throw new Error("Repository mapping input must include owner/repo and local path.");
  }

  return saveRepositoryMapping(repositoryMappingOptions(), {
    repositoryNameWithOwner: mappingInput.repositoryNameWithOwner,
    localPath: mappingInput.localPath,
  });
});
ipcMain.handle(ipcChannels.removeRepositoryMapping, (_event, repositoryNameWithOwner: unknown) => {
  if (typeof repositoryNameWithOwner !== "string") {
    throw new Error("Repository mapping key must be owner/repo.");
  }

  return removeRepositoryMapping(repositoryMappingOptions(), repositoryNameWithOwner);
});
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

void app.whenReady().then(() => {
  const icon = getAppIconPath();
  if (process.platform === "darwin" && icon) {
    app.dock?.setIcon(icon);
  }

  Menu.setApplicationMenu(createApplicationMenu());
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
