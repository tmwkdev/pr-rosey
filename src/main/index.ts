import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  shell,
} from "electron";
import { checkDependencies } from "@/main/dependencyCheckService";
import {
  fetchAuthoredOpenPullRequests,
  fetchReviewRequestedOpenPullRequests,
} from "@/main/pullRequestService";
import { ipcChannels } from "@/shared/ipc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../..");
const preloadPath = path.join(__dirname, "../preload/index.cjs");

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

void app.whenReady().then(() => {
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
