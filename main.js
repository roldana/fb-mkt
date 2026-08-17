const { app, BrowserWindow, clipboard, ipcMain } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const COPY_URL_CHANNEL = 'copy-url';
const MAX_COPY_URL_LENGTH = 4096;
const INDEX_PATH = path.join(__dirname, 'index.html');
const INDEX_URL = pathToFileURL(INDEX_PATH).toString();

function isFacebookHttpsUrl(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_COPY_URL_LENGTH
  ) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (hostname === 'facebook.com' || hostname.endsWith('.facebook.com'))
    );
  } catch {
    return false;
  }
}

function isTrustedLocalSender(event) {
  const { sender, senderFrame } = event;

  return Boolean(
    senderFrame &&
      senderFrame === sender.mainFrame &&
      sender.getType() === 'window' &&
      senderFrame.url === INDEX_URL
  );
}

ipcMain.handle(COPY_URL_CHANNEL, (event, url) => {
  if (!isTrustedLocalSender(event)) {
    throw new Error('Clipboard request denied for an untrusted sender.');
  }

  if (!isFacebookHttpsUrl(url)) {
    throw new TypeError('Only valid Facebook HTTPS URLs can be copied.');
  }

  clipboard.writeText(url);
  return true;
});

// GTK Fix for Linux ---
if (process.platform === 'linux') {
  // This command line switch forces Electron to use GTK 3, resolving the 
  // "GTK 2/3 and GTK 4 in the same process is not supported" error.
  app.commandLine.appendSwitch('gtk-version', '3');
}

function createWindow() {
  console.log('[main] createWindow() running');

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.reactapp.fb-marketplace');
  }

  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f0f2f5',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
      webviewTag: true
    }
  });

  const electronSession = mainWindow.webContents.session;

  electronSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) =>
      permission === 'notifications' &&
      isFacebookHttpsUrl(requestingOrigin)
  );

  electronSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const allowed =
        webContents.getType() === 'webview' &&
        permission === 'notifications' &&
        isFacebookHttpsUrl(details.requestingUrl);

      callback(allowed);
    }
  );

  mainWindow.webContents.on(
    'will-attach-webview',
    (event, webPreferences, params) => {
      delete webPreferences.preload;
      delete params.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;

      if (!isFacebookHttpsUrl(params.src)) {
        event.preventDefault();
      }
    }
  );

  mainWindow.webContents.on(
    'did-attach-webview',
    (_event, guestContents) => {
      guestContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    }
  );

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const targetUrl = event.url || navigationUrl;
    if (targetUrl !== INDEX_URL) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.loadFile(INDEX_PATH);
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
