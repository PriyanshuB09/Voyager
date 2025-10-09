import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(path.dirname(fileURLToPath(import.meta.url)), "../electron/preload.ts"),
    },
  });

  const startUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : `file://${path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist/index.html")}`;
  win.loadURL(startUrl);
}

app.whenReady().then(createWindow);

