// webviewPreload.js

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getURL: () => window.location.href,
});
