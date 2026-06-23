import { app, BrowserWindow, nativeImage, nativeTheme, ipcMain, dialog } from 'electron';
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  let iconPath;

  if (process.platform === 'win32') {
    iconPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons/Group 1.ico');
  } else if (process.platform === 'darwin') { // macOS
    iconPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons/icon.icns');
  } else { // Linux
    iconPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons/icon.png');
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons/Group 1.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    // frame: false,
    backgroundColor: '#dfd9d9',
    accentColor: '#969696',
    // expose window controls in Windows/Linux
    ...(process.platform !== 'darwin' ? {titleBarOverlay: {color: '#EDEDED', symbolColor: '#141414', height: 40}} : {})
  });

  // win.webContents.openDevTools();

  const startUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : `file://${path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist/index.html")}`;
  win.loadURL(startUrl);
}

nativeTheme.themeSource = 'dark';

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
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

ipcMain.handle(
  "fs:write-text-file",
  async (_event, { folder, fileName, text }) => {
    await fs.promises.writeFile(
      path.join(folder, fileName),
      text,
      "utf8"
    );
  }
);

ipcMain.handle(
  "fs:read-text-file",
  async (_event, { folder, fileName }) => {
    try {
      return await fs.promises.readFile(
        path.join(folder, fileName),
        "utf8"
      );
    } catch {
      return null;
    }
  }
);