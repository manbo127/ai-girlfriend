// main.js — Electron main process with IPC handlers

const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 750,
    minWidth: 360,
    minHeight: 500,
    title: 'AI 女友',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- File Operations ---

ipcMain.handle('search-files', async (event, query) => {
  const homeDir = os.homedir();
  const searchPaths = [homeDir, path.join(homeDir, 'Desktop'), path.join(homeDir, 'Documents')];
  const results = [];

  function searchDir(dir, depth) {
    if (depth <= 0) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'dir' : 'file'
          });
        }
        if (entry.isDirectory() && depth > 1) searchDir(fullPath, depth - 1);
      }
    } catch (e) { /* skip unreadable */ }
  }

  for (const p of searchPaths) searchDir(p, 3);
  logOperation('search-files', query, results.length + ' results');
  return results.slice(0, 20);
});

ipcMain.handle('read-file', async (event, filePath) => {
  if (!isSafePath(filePath)) throw new Error('Path not allowed: ' + filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  logOperation('read-file', filePath, content.length + ' chars');
  return content.substring(0, 10000);
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  if (!isSafePath(filePath)) throw new Error('Path not allowed: ' + filePath);
  fs.writeFileSync(filePath, content, 'utf-8');
  logOperation('write-file', filePath, content.length + ' chars');
  return true;
});

ipcMain.handle('list-dir', async (event, dirPath) => {
  if (!dirPath) dirPath = os.homedir();
  if (!isSafePath(dirPath)) throw new Error('Path not allowed: ' + dirPath);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  logOperation('list-dir', dirPath, entries.length + ' entries');
  return entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
});

// --- System Operations ---

ipcMain.handle('open-app', async (event, appName) => {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') {
    cmd = `start "" "${appName}"`;
  } else if (platform === 'darwin') {
    cmd = `open -a "${appName}"`;
  } else {
    cmd = appName;
  }
  exec(cmd, (err) => {
    if (err) console.error('open-app error:', err);
  });
  logOperation('open-app', appName, 'ok');
  return true;
});

const DANGEROUS_COMMANDS = ['rm -rf', 'del /f', 'format', 'mkfs', 'dd if=', ':(){', 'shutdown', 'reboot', 'chmod 777 /'];

ipcMain.handle('run-command', async (event, cmd) => {
  const lower = cmd.toLowerCase();
  for (const d of DANGEROUS_COMMANDS) {
    if (lower.includes(d.toLowerCase())) {
      logOperation('run-command BLOCKED', cmd, 'DANGEROUS');
      throw new Error('Dangerous command blocked: ' + cmd);
    }
  }
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      logOperation('run-command', cmd, err ? 'error' : 'ok');
      if (err) resolve(stderr || err.message);
      else resolve(stdout || '(no output)');
    });
  });
});

ipcMain.handle('screenshot', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });
  const source = sources[0];
  if (!source) throw new Error('No screen source found');
  const png = source.thumbnail.toPNG();
  logOperation('screenshot', '', png.length + ' bytes');
  return png.toString('base64');
});

// --- Safety ---

function isSafePath(filePath) {
  const resolved = path.resolve(filePath);
  const homeDir = os.homedir();
  return resolved.startsWith(homeDir) || resolved.startsWith(path.join(homeDir, '..'));
}

// --- Logging ---

function logOperation(op, target, result) {
  const logDir = path.join(os.homedir(), '.ai-girlfriend');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'operations.log');
  const entry = `${new Date().toISOString()} [${op}] ${target} → ${result}\n`;
  fs.appendFileSync(logFile, entry);
}

// --- App Lifecycle ---

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
