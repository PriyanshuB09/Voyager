import { app, BrowserWindow, nativeTheme, ipcMain, dialog } from "electron";
import type { IpcMainInvokeEvent } from "electron";
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
  const preloadPath = path.join(__dirname, "../preload/preload.cjs");

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 620,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
    titleBarStyle: "hidden",
    backgroundColor: "#17181C",
    accentColor: "#8AA4FF",
    ...(process.platform !== "darwin"
      ? {
          titleBarOverlay: {
            color: "#202228",
            symbolColor: "#F2F3F5",
            height: 56,
          },
        }
      : {}),
  });

  win.webContents.on("preload-error", (_event, failedPath, error) => {
    console.error(`Failed to load Electron preload at ${failedPath}:`, error);
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, targetUrl) => {
    if (targetUrl !== win.webContents.getURL()) event.preventDefault();
  });

  win.once("ready-to-show", () => win.show());

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function assertTrustedRenderer(event: IpcMainInvokeEvent) {
  const senderUrl = event.senderFrame?.url;
  if (!senderUrl) throw new Error("Rejected IPC from an unidentified renderer frame.");
  try {
    const parsed = new URL(senderUrl);
    const rendererFile = path.resolve(__dirname, "../renderer/index.html");
    if (parsed.protocol === "file:" && path.resolve(fileURLToPath(parsed)) === rendererFile) return;
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
      const developmentOrigin = new URL(process.env.ELECTRON_RENDERER_URL).origin;
      if (parsed.origin === developmentOrigin) return;
    }
  } catch {
    // Avoid echoing an untrusted URL in the renderer-facing error.
  }
  throw new Error("Rejected IPC from an untrusted renderer.");
}

function payloadString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object") throw new Error("Invalid IPC payload.");
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string.`);
  return value;
}

nativeTheme.themeSource = "dark";

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

ipcMain.handle("dialog:pick-directory", async (event) => {
  assertTrustedRenderer(event);
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("fs:make-directory", async (event, payload: unknown) => {
  assertTrustedRenderer(event);
  const folder = payloadString(payload, "folder");
  assertNonEmptyString(folder, "folder");

  const resolvedFolder = path.resolve(folder);
  await fs.promises.mkdir(resolvedFolder, { recursive: true });

  return true;
});

ipcMain.handle("fs:write-text-file", async (event, payload: unknown) => {
  assertTrustedRenderer(event);
  const folder = payloadString(payload, "folder");
  const fileName = payloadString(payload, "fileName");
  const text = payloadString(payload, "text");
  assertNonEmptyString(text, "text");
  if (text.length > 16 * 1024 * 1024) throw new Error("Refusing to write a text file larger than 16 MiB.");

  const { resolvedFolder, resolvedFile } = resolveSafeFilePath(folder, fileName);

  await fs.promises.mkdir(resolvedFolder, { recursive: true });
  await fs.promises.writeFile(resolvedFile, text, "utf8");

  return true;
});

ipcMain.handle("fs:read-text-file", async (event, payload: unknown) => {
  assertTrustedRenderer(event);
  const folder = payloadString(payload, "folder");
  const fileName = payloadString(payload, "fileName");
  try {
    const { resolvedFile } = resolveSafeFilePath(folder, fileName);
    return await fs.promises.readFile(resolvedFile, "utf8");
  } catch {
    return null;
  }
});

ipcMain.handle("fs:delete-text-file", async (event, payload: unknown) => {
  assertTrustedRenderer(event);
  const folder = payloadString(payload, "folder");
  const fileName = payloadString(payload, "fileName");
  const { resolvedFile } = resolveSafeFilePath(folder, fileName);

  await fs.promises.rm(resolvedFile, {
    force: true,
  });

  return true;
});
