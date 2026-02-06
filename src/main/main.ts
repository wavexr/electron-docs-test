import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';

// Prevent EPIPE errors from crashing the app when stdout/stderr pipe breaks
process.stdout?.on?.('error', () => {});
process.stderr?.on?.('error', () => {});
import { getSheetTabs, getSheetData, updateCell } from './google-sheets';
import { getDocContent } from './google-docs';
import { analyzeData } from './llm';

// Load environment variables from .env file
// Try multiple locations to support both dev and packaged app
const envPaths = [
  path.join(__dirname, '../../.env'),                    // Dev mode
  path.join(app.getAppPath(), '.env'),                   // Packaged - app root
  path.join(app.getAppPath(), '..', '.env'),             // Packaged - one level up
  path.join(process.cwd(), '.env'),                      // Current working directory
  '/Users/gilbaron/Desktop/claude/electron-docs/.env',   // Absolute fallback
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    console.log('[dotenv] Loading from:', envPath);
    dotenv.config({ path: envPath });
    break;
  }
}

console.log('[env] SPREADSHEET_ID:', process.env.SPREADSHEET_ID ? 'set' : 'NOT SET');
console.log('[env] DOC_ID:', process.env.DOC_ID ? 'set' : 'NOT SET');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open DevTools in development
  mainWindow.webContents.openDevTools();
};

// IPC Handlers

ipcMain.handle('get-sheet-tabs', async () => {
  return await getSheetTabs();
});

ipcMain.handle('get-sheet-data', async (_event, tabName: string) => {
  return await getSheetData(tabName);
});

ipcMain.handle('get-doc-content', async () => {
  return await getDocContent();
});

ipcMain.handle('update-cell', async (_event, tab: string, range: string, value: string) => {
  return await updateCell(tab, range, value);
});

ipcMain.handle('analyze-data', async () => {
  return await analyzeData();
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
