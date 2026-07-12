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
    title: '小七',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#fff5f6',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

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
      'D:\\',
      path.join(os.homedir(), 'AppData\\Local'),
      path.join(os.homedir(), 'AppData\\Roaming'),
    ];
    const found = findExe(appName, searchDirs);

    if (found) {
      exec(`"${found}"`, (err) => {
        if (err) console.error('open-app error:', err);
      });
      logOperation('open-app', appName, 'found: ' + found);
      return `已打开 ${appName}（${found}）`;
    } else {
      // Fallback: only use 'where' for ASCII names (Chinese causes encoding issues)
      const isAscii = /^[\x00-\x7F]+$/.test(appName);
      if (isAscii) {
        const whereResult = await new Promise((resolve) => {
          exec(`where "${appName}"`, (err, stdout) => {
            if (!err && stdout.trim()) {
              const exePath = stdout.trim().split('\n')[0].trim();
              exec(`"${exePath}"`, (e) => { if (e) console.error('open-app error:', e); });
              logOperation('open-app', appName, 'where found: ' + exePath);
              resolve(`已打开 ${appName}（${exePath}）`);
            } else {
              logOperation('open-app', appName, 'not found');
              resolve(`未找到应用 "${appName}"。请在设置中配置应用路径。`);
            }
          });
        });
        return whereResult;
      }
      logOperation('open-app', appName, 'not found');
      return `未找到应用 "${appName}"。请确认已安装，或告诉我它的安装路径。`;
    }
  } else if (platform === 'darwin') {
    exec(`open -a "${appName}"`, (err) => {
      if (err) console.error('open-app error:', err);
    });
    logOperation('open-app', appName, 'ok');
    return `已打开 ${appName}`;
  } else {
    exec(appName, (err) => {
      if (err) console.error('open-app error:', err);
    });
    logOperation('open-app', appName, 'linux');
    return `已尝试打开 ${appName}`;
  }
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

// --- App Cache ---

function getAppCachePath() {
  return path.join(os.homedir(), '.ai-girlfriend', 'app_cache.json');
}

function loadAppCache() {
  try {
    const data = fs.readFileSync(getAppCachePath(), 'utf-8');
    const cached = JSON.parse(data);
    // Expire after 7 days
    if (Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return cached.apps || {};
    }
  } catch (e) { /* no cache or expired */ }
  return null;
}

function saveAppCache(apps) {
  const logDir = path.join(os.homedir(), '.ai-girlfriend');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(getAppCachePath(), JSON.stringify({ timestamp: Date.now(), apps }), 'utf-8');
}

function scanForApps() {
  const scanDirs = [
    'C:\\Program Files', 'C:\\Program Files (x86)',
    'D:\\',
    path.join(os.homedir(), 'AppData\\Local'),
    path.join(os.homedir(), 'AppData\\Roaming'),
    path.join(os.homedir(), 'Desktop'),
  ];

  const apps = {}; // { 'appname_lower': 'full\\path\\to\\app.exe' }

  function scanDir(dir, depth) {
    if (depth <= 0) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.startsWith('$')) continue;
        const fullPath = path.join(dir, entry.name);
        try {
          if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
            const exeName = entry.name.replace(/\.exe$/i, '').toLowerCase().replace(/\s/g, '');
            apps[exeName] = fullPath;
          } else if (entry.isDirectory()) {
            scanDir(fullPath, depth - 1);
          }
        } catch (e) { /* skip locked files */ }
      }
    } catch (e) { /* skip unreadable dirs */ }
  }

  console.log('[AppCache] Scanning for apps...');
  for (const dir of scanDirs) {
    scanDir(dir, 4);
  }
  console.log('[AppCache] Found', Object.keys(apps).length, 'apps');

  saveAppCache(apps);
  return apps;
}

function getAppCache() {
  let cache = loadAppCache();
  if (!cache) {
    cache = scanForApps();
  }
  return cache;
}

// --- App Finder ---

const APP_MAP = {
  '微信': ['C:\\Program Files\\Tencent\\Weixin\\Weixin.exe'],
  'qq': ['D:\\QQ\\QQ.exe'],
  'QQ': ['D:\\QQ\\QQ.exe'],
  '网易云': ['D:\\CloudMusic\\cloudmusic.exe'],
  '音乐': ['D:\\CloudMusic\\cloudmusic.exe'],
  'steam': ['D:\\steam\\Steam.exe', 'steam', 'Steam'],
  '抖音': ['D:\\LenovoSoftstore\\Install\\douyin\\douyin.exe'],
  'douyin': ['D:\\LenovoSoftstore\\Install\\douyin\\douyin.exe'],
  '豆包': ['D:\\Doubao\\Doubao.exe'],
  'doubao': ['D:\\Doubao\\Doubao.exe'],
  'vpn': ['D:\\Reaeeman\\Reaeeman.exe'],
  '梯子': ['D:\\Reaeeman\\Reaeeman.exe'],
  '翻墙': ['D:\\Reaeeman\\Reaeeman.exe'],
  '代理': ['D:\\Reaeeman\\Reaeeman.exe'],
  'reaeeman': ['D:\\Reaeeman\\Reaeeman.exe'],
  'vscode': ['D:\\Microsoft VS Code\\Code.exe', 'Code', 'Microsoft VS Code'],
  'visual studio code': ['D:\\Microsoft VS Code\\Code.exe'],
  'code': ['D:\\Microsoft VS Code\\Code.exe'],
  'wps': ['wps', 'WPS'],
  'word': ['WINWORD', 'Microsoft Office'],
  'excel': ['EXCEL', 'Microsoft Office'],
  '记事本': ['notepad', 'Notepad'],
  '计算器': ['calc', 'Calculator'],
  '终端': ['cmd', 'Windows Terminal', 'wt'],
  'powershell': ['powershell', 'pwsh'],
  '浏览器': ['chrome', 'Chrome', 'firefox', 'Firefox', 'msedge', 'Edge'],
  'chrome': ['chrome', 'Chrome', 'Google\\Chrome'],
  'edge': ['msedge', 'Edge'],
  '钉钉': ['DingTalk', 'dingtalk'],
  '腾讯会议': ['wemeet', 'Tencent\\WeMeet'],
  '飞书': ['feishu', 'Lark'],
  'qq音乐': ['QQMusic'],
  '酷狗': ['kugou', 'KuGou'],
  '百度网盘': ['BaiduNetdisk', 'baidunetdisk'],
  '迅雷': ['thunder', 'Thunder'],
};

function findExe(appName, dirs, maxDepth = 3) {
  const lower = appName.toLowerCase().replace(/\s/g, '');
  let searchNames = [];

  // Check app map for English names
  for (const [cnName, exeList] of Object.entries(APP_MAP)) {
    if (lower.includes(cnName) || cnName.includes(lower)) {
      searchNames.push(...exeList.map(e => e.toLowerCase().replace(/\s/g, '')));
    }
  }

  if (searchNames.length === 0) {
    searchNames.push(lower);
  }

  // Direct path check — if any search name is an absolute path, try it first
  for (const name of searchNames) {
    if (name.includes(':\\') || name.includes(':/')) {
      if (fs.existsSync(name)) {
        console.log('[AppCache] Direct path:', name);
        return name;
      }
    }
  }

  // Check app cache first (pre-indexed exe list)
  const cache = getAppCache();
  for (const name of searchNames) {
    if (cache[name]) {
      console.log('[AppCache] Hit:', name, '→', cache[name]);
      return cache[name];
    }
  }
  // Also check partial matches in cache
  for (const [cachedName, cachedPath] of Object.entries(cache)) {
    for (const name of searchNames) {
      if (cachedName.includes(name) || name.includes(cachedName)) {
        console.log('[AppCache] Partial match:', cachedName, '→', cachedPath);
        return cachedPath;
      }
    }
  }

  // Fallback: live search
  console.log('[DEBUG] Searching disk for:', searchNames);
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
        // Also check if directory name matches — recursively search for any .exe inside
        for (const name of searchNames) {
          if (entryLower.includes(name) || name.includes(entryLower)) {
            const found = searchForExe(fullPath, searchNames, 3); // search up to 3 levels deep
            if (found) return found;
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

app.setPath('userData', path.join(__dirname, 'userdata'));

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
