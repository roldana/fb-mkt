const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  copyUrl: (url) => ipcRenderer.invoke('copy-url', url)
});
    