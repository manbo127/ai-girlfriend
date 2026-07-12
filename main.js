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
  if (platform === 'win32') {
    // Search common install locations for matching .exe
    const searchDirs = [
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      path.join(os.homedir(), 'AppData\\Local'),
      path.join(os.homedir(), 'AppData\\Roaming'),
    ];
    const found = findExe(appName, searchDirs);

    if (found) {
      exec(`"${found}"`, (err) => {
        if (err) console.error('open-app error:', err);
      });
      logOperation('open-app', appName, 'found: ' + found);
    } else {
      // Fallback: try start command
      exec(`start "" "${appName}"`, (err) => {
        if (err) console.error('open-app error:', err);
      });
      logOperation('open-app', appName, 'fallback start');
    }
  } else if (platform === 'darwin') {
    exec(`open -a "${appName}"`, (err) => {
      if (err) console.error('open-app error:', err);
    });
    logOperation('open-app', appName, 'ok');
  } else {
    exec(appName, (err) => {
      if (err) console.error('open-app error:', err);
    });
    logOperation('open-app', appName, 'linux');
  }
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

// --- App Finder ---

const APP_MAP = {
  '微信': ['WeChat', 'wechat'],
  'qq': ['QQ', 'Tencent\\QQ'],
  '网易云': ['cloudmusic', 'Netease'],
  '音乐': ['cloudmusic'],
  '浏览器': ['chrome', 'Chrome', 'firefox', 'Firefox', 'msedge', 'Edge'],
  'chrome': ['chrome', 'Chrome', 'Google\\Chrome'],
  'edge': ['msedge', 'Edge'],
  'vscode': ['Code', 'Microsoft VS Code'],
  'visual studio code': ['Code'],
  'wps': ['wps', 'WPS'],
  'word': ['WINWORD', 'Microsoft Office'],
  'excel': ['EXCEL', 'Microsoft Office'],
  '记事本': ['notepad', 'Notepad'],
  '计算器': ['calc', 'Calculator'],
  '终端': ['cmd', 'Windows Terminal', 'wt'],
  'powershell': ['powershell', 'pwsh'],
  'steam': ['steam', 'Steam'],
  '钉钉': ['DingTalk', 'dingtalk'],
  '腾讯会议': ['wemeet', 'Tencent\\WeMeet'],
  '飞书': ['feishu', 'Lark'],
  'qq音乐': ['QQMusic'],
  '酷狗': ['kugou', 'KuGou'],
  '百度网盘': ['BaiduNetdisk', 'baidunetdisk'],
  '迅雷': ['thunder', 'Thunder'],
};

function findExe(appName, dirs, maxDepth = 2) {
  // Try mapping first
  const lower = appName.toLowerCase().replace(/\s/g, '');
  let searchNames = [lower];

  for (const [cnName, exeList] of Object.entries(APP_MAP)) {
    if (lower.includes(cnName) || cnName.includes(lower)) {
      searchNames.push(...exeList.map(e => e.toLowerCase().replace(/\s/g, '')));
    }
  }

  for (const dir of dirs) {
    const found = searchForExe(dir, searchNames, maxDepth);
    if (found) return found;
  }
  return null;
}

function searchForExe(dir, searchNames, depth) {
  if (depth <= 0) return null;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      const entryLower = entry.name.toLowerCase().replace(/\s/g, '');

      if (entry.isFile() && entryLower.endsWith('.exe')) {
        const exeName = entryLower.replace('.exe', '');
        for (const name of searchNames) {
          if (exeName.includes(name) || name.includes(exeName) || entryLower.includes(name)) {
            return fullPath;
          }
        }
      } else if (entry.isDirectory()) {
        // Also check if directory name matches — app dirs often contain the exe
        for (const name of searchNames) {
          if (entryLower.includes(name) || name.includes(entryLower)) {
            // Search one level deeper for any .exe
            try {
              const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
              for (const sub of subEntries) {
                if (sub.isFile() && sub.name.toLowerCase().endsWith('.exe')) {
                  return path.join(fullPath, sub.name);
                }
              }
            } catch (e) { /* skip */ }
          }
        }
        const found = searchForExe(fullPath, searchNames, depth - 1);
        if (found) return found;
      }
    }
  } catch (e) { /* skip */ }
  return null;
}

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
