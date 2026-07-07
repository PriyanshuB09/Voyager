import { app, BrowserWindow, nativeTheme, ipcMain, dialog } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assertNonEmptyString(value: string, name: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function assertSafeFileName(fileName: string) {
  assertNonEmptyString(fileName, "fileName");

  if (
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    path.isAbsolute(fileName)
  ) {
    throw new Error(`Unsafe file name: ${fileName}`);
  }
}

function resolveSafeFilePath(folder: string, fileName: string) {
  assertNonEmptyString(folder, "folder");
  assertSafeFileName(fileName);

  const resolvedFolder = path.resolve(folder);
  const resolvedFile = path.resolve(resolvedFolder, fileName);

  if (
    resolvedFile !== resolvedFolder &&
    !resolvedFile.startsWith(resolvedFolder + path.sep)
  ) {
    throw new Error("Resolved file path escaped the target folder.");
  }

  return {
    resolvedFolder,
    resolvedFile,
  };
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "../../electron/Group 1.png");

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hidden",
    backgroundColor: "#090D14",
    accentColor: "#969696",
    ...(process.platform !== "darwin"
      ? {
          titleBarOverlay: {
            color: "#090D14",
            symbolColor: "#EDEDED",
            height: 39,
          },
        }
      : {}),
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

nativeTheme.themeSource = "light";

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("dialog:pick-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("fs:make-directory", async (_event, { folder }) => {
  assertNonEmptyString(folder, "folder");

  const resolvedFolder = path.resolve(folder);
  await fs.promises.mkdir(resolvedFolder, { recursive: true });

  return true;
});

ipcMain.handle("fs:write-text-file", async (_event, { folder, fileName, text }) => {
  assertNonEmptyString(text, "text");

  const { resolvedFolder, resolvedFile } = resolveSafeFilePath(folder, fileName);

  await fs.promises.mkdir(resolvedFolder, { recursive: true });
  await fs.promises.writeFile(resolvedFile, text, "utf8");

  return true;
});

ipcMain.handle("fs:read-text-file", async (_event, { folder, fileName }) => {
  try {
    const { resolvedFile } = resolveSafeFilePath(folder, fileName);
    return await fs.promises.readFile(resolvedFile, "utf8");
  } catch {
    return null;
  }
});

ipcMain.handle("fs:delete-text-file", async (_event, { folder, fileName }) => {
  const { resolvedFile } = resolveSafeFilePath(folder, fileName);

  await fs.promises.rm(resolvedFile, {
    force: true,
  });

  return true;
});
