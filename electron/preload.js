import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory"),

  writeTextFile: (folder, fileName, text) =>
    ipcRenderer.invoke("fs:write-text-file", {
      folder,
      fileName,
      text,
    }),

  readTextFile: (folder, fileName) =>
    ipcRenderer.invoke("fs:read-text-file", {
      folder,
      fileName,
    }),
});