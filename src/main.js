// main.js

const { app, BrowserWindow, Menu, session, ipcMain, clipboard } = require('electron');
const path = require('path');

let favorites = [];

DASHBOARD_URL = "https://www.facebook.com/marketplace/you/dashboard"

function createWindow() {
  if (process.platform === 'win32') {
      app.setAppUserModelId('com.reactapp.fb-marketplace');
  }
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false, // Disable Node.js integration for security
      contextIsolation: true,  // Enable context isolation for security
      enableRemoteModule: false,
      webviewTag: true
      // preload: path.join(__dirname, 'preload.js')
    },
  });

  win.loadFile('src/index.html');

  // Load Facebook Marketplace Dashboard
  // win.loadURL(DASHBOARD_URL);

  // Optional: Open DevTools (useful during development)
  // win.webContents.openDevTools();

  // Handle notification permissions
  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications') {
      // Approve notification permission request
      callback(true);
    } else {
      callback(false); // Deny other permissions
    }
  });

  // Handle IPC messages
  ipcMain.on('copy-current-url', (event) => {
    const currentWindow = BrowserWindow.getFocusedWindow();
    currentWindow.webContents.executeJavaScript('document.getElementById("webview").getURL()')
      .then((url) => {
        clipboard.writeText(url);
      });
  });

  ipcMain.on('add-favorite', (event) => {
    const currentWindow = BrowserWindow.getFocusedWindow();
    currentWindow.webContents.executeJavaScript('document.getElementById("webview").getURL()')
      .then((url) => {
        favorites.push(url);
        // Optionally, store favorites persistently using localStorage or a file
      });
  });

  ipcMain.on('view-favorites', (event) => {
    // Open a new window or modal to display the favorites
    // For simplicity, we'll log them here
    console.log('Favorites:', favorites);
  });

}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  // On macOS, recreate a window when the dock icon is clicked and there are no other windows open
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
