// main.js

const { app, BrowserWindow } = require('electron');

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
    webPreferences: {
      nodeIntegration: false, // Disable Node.js integration for security
      contextIsolation: true,  // Enable context isolation for security
      enableRemoteModule: false,
    },
  });

  // Load Facebook Marketplace Dashboard
  win.loadURL(DASHBOARD_URL);

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
