import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory"),

  writeTextFile: (folder: string, fileName: string, text: string) =>
    ipcRenderer.invoke("fs:write-text-file", {
      folder,
      fileName,
      text,
    }),

  readTextFile: (folder: string, fileName: string) =>
    ipcRenderer.invoke("fs:read-text-file", {
      folder,
      fileName,
    }),

  makeDirectory: (folder: string) =>
    ipcRenderer.invoke("fs:make-directory", {
      folder,
    }),

  deleteTextFile: (folder: string, fileName: string) =>
    ipcRenderer.invoke("fs:delete-text-file", {
      folder,
      fileName,
    }),
});
