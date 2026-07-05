const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] preload.js loaded");

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

  makeDirectory: (folder) =>
    ipcRenderer.invoke("fs:make-directory", {
      folder,
    }),

  deleteTextFile: (folder, fileName) =>
    ipcRenderer.invoke("fs:delete-text-file", {
      folder,
      fileName,
    }),
});