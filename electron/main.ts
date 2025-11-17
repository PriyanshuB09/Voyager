import { app, BrowserWindow, nativeImage, nativeTheme, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

function createWindow() {
  let iconPath;

  if (process.platform === 'win32') {
    iconPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons/icon2.ico');
  } else if (process.platform === 'darwin') { // macOS
    iconPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons/icon.icns');
  } else { // Linux
    iconPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons/icon.png');
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons/icon2.ico'),
    webPreferences: {
      preload: path.join(path.dirname(fileURLToPath(import.meta.url)), "../electron/preload.js"),
    },
    titleBarStyle: 'hidden',
    // frame: false,
    backgroundColor: '#000000',
    accentColor: '#000000',
    // expose window controls in Windows/Linux
    ...(process.platform !== 'darwin' ? {titleBarOverlay: {color: '#0D1821', symbolColor: '#B4CDED', height: 39}} : {})
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