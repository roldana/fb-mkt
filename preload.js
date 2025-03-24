const { ipcRenderer, contextBridge } = require('electron');
const { contextBridge, clipboard } = require('electron');


contextBridge.exposeInMainWorld('electronAPI', {
  navigate: (url) => ipcRenderer.send('navigate', url)
});

contextBridge.exposeInMainWorld('electronAPI', {
  copyText: (text) => clipboard.writeText(text)
});