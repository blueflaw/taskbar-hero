const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Where we persist save data (per-OS user data folder, not inside the app bundle)
const SAVE_PATH = path.join(app.getPath('userData'), 'save.json');

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 48; // taskbar-height strip

let mainWindow = null;
let inventoryWindow = null;
let tray = null;

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: screenW - WINDOW_WIDTH - 8,      // bottom-right, nudge left of system tray
    y: screenH - WINDOW_HEIGHT,          // sit right above the taskbar
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,                   // don't show ITS OWN icon in the taskbar
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver'); // stay above most windows
  win.setIgnoreMouseEvents(true, { forward: true }); // click-through by default
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  win.on('closed', () => {
    mainWindow = null;
  });

  mainWindow = win;
  return win;
}

// A normal, framed window - this one you're meant to click into and interact with,
// unlike the click-through taskbar strip.
function createInventoryWindow() {
  if (inventoryWindow) {
    inventoryWindow.focus();
    return inventoryWindow;
  }

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const width = 380;
  const height = 480;

  inventoryWindow = new BrowserWindow({
    width,
    height,
    x: screenW - width - 20,
    y: screenH - height - 70, // sit just above the taskbar strip
    frame: true,
    resizable: false,
    alwaysOnTop: true,
    title: 'Inventory',
    webPreferences: {
      preload: path.join(__dirname, 'preload-inventory.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  inventoryWindow.setMenuBarVisibility(false);
  inventoryWindow.loadFile(path.join(__dirname, 'src', 'inventory.html'));

  inventoryWindow.on('closed', () => {
    inventoryWindow = null;
  });

  return inventoryWindow;
}

// The taskbar strip is easy to miss (small, click-through, no close button).
// The tray icon is the reliable entry point: Open Inventory, toggle the
// strip's visibility, or quit the app entirely.
function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon-16.png'));
    tray = new Tray(icon);
    tray.setToolTip('Taskbar Hero');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Inventory',
        click: () => createInventoryWindow(),
      },
      {
        label: 'Show/Hide Hero Strip',
        click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible()) mainWindow.hide();
          else mainWindow.show();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);

    tray.setContextMenu(contextMenu);

    // Left-click convenience: quick-toggle the strip without digging into the menu.
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) mainWindow.hide();
      else mainWindow.show();
    });
  } catch (err) {
    // Some Linux desktop environments have no system tray host available -
    // don't let that crash the whole app, just log it and move on. The
    // inventory bag icon on the strip still works as a fallback entry point.
    console.warn('Tray icon unavailable:', err.message);
  }
}

// --- Toggle click-through on the main strip ---
ipcMain.on('set-ignore-mouse', (_evt, ignore) => {
  if (mainWindow) mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
});

// --- Inventory window lifecycle ---
ipcMain.on('open-inventory', () => {
  createInventoryWindow();
});

// Inventory window asks for fresh data; we relay the request to the game
// window, which owns the live GameState in memory.
ipcMain.on('request-inventory-sync', () => {
  if (mainWindow) mainWindow.webContents.send('provide-inventory-sync');
});

// Game window responds with serialized data; relay it onward to the inventory window.
ipcMain.on('inventory-sync-data', (_evt, data) => {
  if (inventoryWindow) inventoryWindow.webContents.send('inventory-sync-data', data);
});

// Inventory window requests an equip action; relay to the game window, which
// actually mutates the live Hero/GameState objects.
ipcMain.on('equip-item', (_evt, payload) => {
  if (mainWindow) mainWindow.webContents.send('equip-item', payload);
});

// Inventory window requests a hero recruit; relay to the game window, which
// owns gold/party and does the actual "can afford it" check + addHero() call.
ipcMain.on('recruit-hero', (_evt, classId) => {
  if (mainWindow) mainWindow.webContents.send('recruit-hero', classId);
});

// --- Save/load handlers (main process owns disk access) ---
ipcMain.handle('save-game', (_evt, data) => {
  fs.writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('load-game', () => {
  if (!fs.existsSync(SAVE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SAVE_PATH, 'utf-8'));
  } catch {
    return null;
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
