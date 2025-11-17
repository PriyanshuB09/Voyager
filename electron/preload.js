var _a = require("electron"), contextBridge = _a.contextBridge, ipcRenderer = _a.ipcRenderer;
contextBridge.exposeInMainWorld("electronAPI", {
    windowControl: {
        minimize: function () { return ipcRenderer.send("window-minimize"); },
        maximize: function () { return ipcRenderer.send("window-maximize"); },
        close: function () { return ipcRenderer.send("window-close"); }
    },
});
