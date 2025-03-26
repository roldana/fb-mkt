const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');

// Base URL for Facebook
const BASE_URL = "https://www.facebook.com";

const SEARCH_URL = "https://www.facebook.com/marketplace/search/?query=";
const SEARCH_INPUT_SELECTOR = 'input[placeholder="Search Marketplace"]';  
const SEARCH_BUTTON_SELECTOR = 'button[type="submit"]';
const SEARCH_RESULTS_SELECTOR = '.searchResults';
const SEARCH_ITEM_SELECTOR = '.searchResult';

// Classes used to extract product information from the loaded page
const PRODUCT_ITEM_CLASS = 'productItem';    // Placeholder class for product items
const PRODUCT_TITLE_CLASS = 'productTitle';  // Placeholder class for product title
const PRODUCT_PRICE_CLASS = 'productPrice';  // Placeholder class for product price

function createWindow() {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.reactapp.fb-marketplace');
  }

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // If you have a preload (optional)
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    }
  });

  // Load the local HTML with layout
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Create the BrowserView for the main content
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    }
  });
  mainWindow.setBrowserView(view);

  // Layout constants
  const topBarHeight = 52;
  const leftBarWidth = 250;
  const urlBarHeight = 0; // space for URL display inside the content area
  const bottomOffset = 36; // space for bottom bar inside the content area

  function resizeView() {
    const [currentWidth, currentHeight] = mainWindow.getSize();
    view.setBounds({
      x: leftBarWidth,
      y: topBarHeight + urlBarHeight,
      width: currentWidth - leftBarWidth,
      height: currentHeight - topBarHeight - urlBarHeight - bottomOffset
    });
  }

  resizeView();
  view.setAutoResize({ width: true, height: true });

  // Initial load
  view.webContents.loadURL(BASE_URL + '/marketplace/you/dashboard/');

  // Handle notification permissions
  const ses = view.webContents.session;
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Update URL display whenever navigation happens
  const updateURLDisplay = () => {
    const currentURL = view.webContents.getURL();
    console.log("Navigated to:", currentURL); // Print to terminal
    mainWindow.webContents.executeJavaScript(`
      document.querySelector('.url-display').innerText = ${JSON.stringify(currentURL)};
    `);
  };

  view.webContents.on('did-navigate', updateURLDisplay);
  view.webContents.on('did-navigate-in-page', updateURLDisplay);

  // After the page finishes loading, attempt to extract products and update the sidebar
  view.webContents.on('did-finish-load', () => {
    // Update the URL display
    updateURLDisplay();

    // Extract product data from the page
    // Adjust these selectors to match actual elements on the Marketplace page
    const script = `
      (function() {
        const items = Array.from(document.querySelectorAll('.${PRODUCT_ITEM_CLASS}'));
        return items.map(item => {
          const titleEl = item.querySelector('.${PRODUCT_TITLE_CLASS}');
          const priceEl = item.querySelector('.${PRODUCT_PRICE_CLASS}');
          const linkEl = item.querySelector('a');
          return {
            url: linkEl ? linkEl.href : '',
            title: titleEl ? titleEl.innerText.trim() : '',
            price: priceEl ? priceEl.innerText.trim() : ''
          };
        });
      })();
    `;
    view.webContents.executeJavaScript(script).then(products => {
      let productHTML = '';
      products.forEach(p => {
        productHTML += `
          <li>
            <span class="product-title">${p.title}</span>
            <span class="product-price">${p.price}</span><br/>
            <a href="${p.url}" target="_blank">${p.url}</a>
          </li>
        `;
      });

      mainWindow.webContents.executeJavaScript(`
        const ul = document.querySelector('.saved-products .products-list');
        if (ul) ul.innerHTML = ${JSON.stringify(productHTML)};
      `);
    }).catch(err => {
      console.error('Error extracting products:', err);
    });
  });

  // IPC listener for navigation requests from the renderer
  ipcMain.on('navigate', (event, relativePath) => {
    view.webContents.loadURL(BASE_URL + relativePath);
  });

  // Handle window resize
  mainWindow.on('resize', resizeView);
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
