const { app, BrowserWindow, ipcMain, clipboard, session} = require('electron');
const path = require('path');

// Base URL for Facebook
const BASE_URL = "https://www.facebook.com";
const LOGIN_URL = "/login";
const DASHBOARD_URL = "/marketplace/you/dashboard";

const SEARCH_URL = "https://www.facebook.com/marketplace/search/?query=";
const SEARCH_INPUT_SELECTOR = 'input[placeholder="Search Marketplace"]';  
const SEARCH_BUTTON_SELECTOR = 'button[type="submit"]';
const SEARCH_RESULTS_SELECTOR = '.searchResults';
const SEARCH_ITEM_SELECTOR = '.searchResult';

let mainWindow;

async function isLoggedIn() {
  const cookies = await session.defaultSession.cookies.get({
    name: 'c_user',
    domain: 'facebook.com'
  });
  return cookies.length > 0;
}

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

  let savedSearches = [];

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      devTools: true,
      webviewTag: true
    }
  });

  // Load the local HTML with the updated navigation bar
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // open Dev tools in new window
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  // enable notification permission
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications') {
      callback(true);
    } else {
      callback(false);
    }
  });

  const initial_url = '';
  
  // IMPLEMENT THIS FUNCTIONALITY WITH WEBVIEW; IT WAS IMPLEMENTED WITH BROWSERVIEW
  // isLoggedIn()
  //   .then(loggedIn => {
  //     console.log('checking if user is logged in')
  //     view.webContents.loadURL(loggedIn ? BASE_URL + DASHBOARD_URL : BASE_URL + LOGIN_URL )
  //   })
  //   .catch(err => {
  //     console.error('Cookie check failed:', err);
  //     view.webContents.loadURL(BASE_URL+LOGIN_URL);
  //   });

  // Initial load
  // view.webContents.loadURL(BASE_URL + DASHBOARD_URL);

  // Update URL display whenever navigation happens
  const updateURLDisplay = () => {
    const currentURL = mainWindow.webContents.getURL();
    console.log("Navigated to:", currentURL); // Print to terminal
    mainWindow.webContents.executeJavaScript(`
      document.getElementById('current-url').innerText = ${JSON.stringify(currentURL)};
    `);
  };

  mainWindow.webContents.on('did-navigate', updateURLDisplay);
  mainWindow.webContents.on('did-navigate-in-page', updateURLDisplay);

  // IPC listener for navigation requests from the renderer
  ipcMain.on('navigate', (event, relativePath) => {
    console.log("Navigating to:", relativePath); // Print to terminal
    const targetURL = BASE_URL + relativePath;
    console.log("Target URL:", targetURL); // Print to terminal
    mainWindow.webContents.loadURL(targetURL);
  });

  ipcMain.on('save-search', (event, query) => {
    // Here you would insert the search term into your database.
    // For this demo, we simply push it into the array.
    savedSearches.push(query);
    console.log("Saved search:", query);
    event.reply('search-saved', savedSearches);
  });
  
  ipcMain.on('get-saved-searches', (event) => {
    event.reply('saved-searches', savedSearches);
  });

  ipcMain.on('copy-to-clipboard', (event, text) => {
    // Use the clipboard module to copy text to the clipboard
    clipboard.writeText(text);
  });
}

// When app is ready, create the window
app.whenReady().then(createWindow);

// On macOS, recreate a window when the dock icon is clicked and no other windows are open.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
// 