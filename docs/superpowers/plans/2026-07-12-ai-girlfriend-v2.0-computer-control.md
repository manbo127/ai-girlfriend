# AI 女友 v2.0 — 电脑操作 实施计划

> Execute inline for speed.

**Goal:** 让 AI 女友通过 DeepSeek Function Calling 操控电脑（文件、软件、命令、截图）。

**Architecture:** Electron IPC 桥接 — main.js 实现 Node.js 工具，preload.js 暴露安全 API，ai.js 声明 tools 并处理 tool_calls，chat.js 处理确认弹窗和 tool 循环。

**Tech Stack:** Electron + Node.js + DeepSeek Function Calling API

## Global Constraints
- 纯本地，无云端依赖（除 DeepSeek API）
- 每次工具调用弹确认窗，无超时
- run_command 每次必确认，危险命令直接拒绝
- 文件写入限制在用户目录
- 所有操作记录日志

---

### Task 1: Electron IPC 主进程 — main.js + preload.js

**Files:**
- Modify: `main.js`
- Modify: `preload.js`

- [ ] **Step 1: 重写 preload.js — 暴露 7 个工具 API**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: '2.0.0',

  // File operations
  searchFiles: (query) => ipcRenderer.invoke('search-files', query),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  listDir: (path) => ipcRenderer.invoke('list-dir', path),

  // System operations
  openApp: (name) => ipcRenderer.invoke('open-app', name),
  runCommand: (cmd) => ipcRenderer.invoke('run-command', cmd),
  screenshot: () => ipcRenderer.invoke('screenshot'),
});
```

- [ ] **Step 2: 重写 main.js — IPC handlers + Node.js 工具**

```js
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const os = require('os');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420, height: 750, minWidth: 360, minHeight: 500,
    title: 'AI 女友',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');
  mainWindow.on('page-title-updated', (e) => e.preventDefault());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- File Operations ---
ipcMain.handle('search-files', async (event, query) => {
  const homeDir = os.homedir();
  const searchPaths = [homeDir, path.join(homeDir, 'Desktop'), path.join(homeDir, 'Documents')];
  const results = [];

  function searchDir(dir, depth = 3) {
    if (depth <= 0) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({ name: entry.name, path: fullPath, type: entry.isDirectory() ? 'dir' : 'file' });
        }
        if (entry.isDirectory() && depth > 1) searchDir(fullPath, depth - 1);
      }
    } catch (e) { /* skip unreadable dirs */ }
  }

  for (const p of searchPaths) searchDir(p);
  logOperation('search-files', query, results.length + ' results');
  return results.slice(0, 20);
});

ipcMain.handle('read-file', async (event, filePath) => {
  if (!isSafePath(filePath)) throw new Error('Path not allowed: ' + filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  logOperation('read-file', filePath, content.length + ' chars');
  return content.substring(0, 10000); // limit 10KB
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
  logOperation('open-app', appName);
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
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      logOperation('run-command', cmd, err ? 'error' : 'ok');
      if (err) resolve(stderr || err.message);
      else resolve(stdout || '(no output)');
    });
  });
});

ipcMain.handle('screenshot', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createWindow(); });
```

- [ ] **Step 2: 提交**

```bash
git add main.js preload.js
git commit -m "feat: add IPC handlers for file ops, app launch, commands, screenshot"
```

---

### Task 2: AI Function Calling — js/ai.js

- [ ] **Step 1: 在 buildSystemPrompt 后追加 tools 定义**

在 ai.js 末尾新增：

```js
export function getTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'search_files',
        description: '搜索电脑上的文件。传入文件名关键词，返回匹配的文件列表。',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: '搜索关键词' } },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: '读取指定文件的内容',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: '文件完整路径' } },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: '创建或修改文件',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
            content: { type: 'string', description: '要写入的内容' }
          },
          required: ['path', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: '列出目录中的文件和子目录',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: '目录路径，默认用户主目录' } },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'open_app',
        description: '打开电脑上的应用程序',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string', description: '应用名称，如"微信"、"Chrome"' } },
          required: ['name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'run_command',
        description: '在终端执行命令（仅安全命令）',
        parameters: {
          type: 'object',
          properties: { cmd: { type: 'string', description: '要执行的命令' } },
          required: ['cmd']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'screenshot',
        description: '截取当前屏幕',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    }
  ];
}
```

- [ ] **Step 2: 修改 chat() 函数支持 tools**

```js
export async function chat(messages, apiKey) {
  const systemPrompt = await buildSystemPrompt();
  const tools = getTools();

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    temperature: 0.8,
    max_tokens: 500,
    stream: false,
    tools: tools
  };

  const response = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message; // returns { content, tool_calls }
}
```

返回完整的 message 对象而不是只返回 content——调用方需要区分 text 和 tool_calls。

- [ ] **Step 3: 提交**

```bash
git add js/ai.js
git commit -m "feat: add Function Calling tools definition and support"
```

---

### Task 3: 确认弹窗 UI — index.html + style.css

- [ ] **Step 1: 在 index.html 中添加确认弹窗 DOM**

在 `#app` 内最后、`</div>` 之前插入：

```html
<!-- 工具确认弹窗 -->
<div id="confirm-dialog" class="overlay hidden">
  <div class="confirm-card">
    <h3>小七想操作你的电脑：</h3>
    <div id="confirm-tool-icon"></div>
    <p id="confirm-tool-desc"></p>
    <div class="confirm-actions">
      <button id="btn-deny" class="danger">拒绝</button>
      <button id="btn-allow" class="primary">允许</button>
    </div>
    <label id="confirm-trust-label" class="hidden">
      <input type="checkbox" id="confirm-trust"> 从此信任此类操作
    </label>
  </div>
</div>
```

- [ ] **Step 2: 在 style.css 中添加确认弹窗样式**

```css
.confirm-card {
  background: var(--white); padding: 24px; border-radius: var(--radius-md);
  max-width: 360px; width: 90%; display: flex; flex-direction: column; gap: 14px;
  box-shadow: var(--shadow-md); text-align: center;
}
.confirm-card h3 { color: var(--pink-500); font-size: 16px; }
#confirm-tool-icon { font-size: 36px; }
#confirm-tool-desc { font-size: 14px; color: var(--gray-600); word-break: break-all; }
.confirm-actions { display: flex; gap: 10px; justify-content: center; }
.confirm-actions button { padding: 10px 24px; border-radius: var(--radius-sm); font-size: 14px; cursor: pointer; }
#confirm-trust-label { font-size: 12px; color: var(--gray-600); display: flex; align-items: center; gap: 6px; justify-content: center; }
```

- [ ] **Step 3: 提交**

```bash
git add index.html css/style.css
git commit -m "feat: add tool confirmation dialog UI"
```

---

### Task 4: 工具执行循环 — js/chat.js

这是最大的改动。在 chat.js 中添加 tool_calls 处理流程。

- [ ] **Step 1: 添加确认弹窗函数和工具执行函数**

在 chat.js 末尾追加：

```js
// --- Tool Confirmation ---
const ICONS = {
  search_files: '🔍', read_file: '📄', write_file: '✏️', list_dir: '📁',
  open_app: '🚀', run_command: '⚡', screenshot: '📸'
};

const NAMES = {
  search_files: '搜索文件', read_file: '读取文件', write_file: '写入文件',
  list_dir: '浏览目录', open_app: '打开应用', run_command: '执行命令', screenshot: '截屏'
};

function showConfirmDialog(toolName, toolArgs) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    const icon = document.getElementById('confirm-tool-icon');
    const desc = document.getElementById('confirm-tool-desc');
    const btnAllow = document.getElementById('btn-allow');
    const btnDeny = document.getElementById('btn-deny');
    const trustLabel = document.getElementById('confirm-trust-label');
    const trustCheckbox = document.getElementById('confirm-trust');

    icon.textContent = ICONS[toolName] || '🔧';
    desc.textContent = `${NAMES[toolName] || toolName}：${JSON.stringify(toolArgs)}`;
    trustCheckbox.checked = false;
    trustLabel.classList.remove('hidden');
    dialog.classList.remove('hidden');

    function cleanup(result) {
      dialog.classList.add('hidden');
      btnAllow.removeEventListener('click', onAllow);
      btnDeny.removeEventListener('click', onDeny);
      resolve(result);
    }

    function onAllow() { cleanup({ allowed: true, trust: trustCheckbox.checked }); }
    function onDeny() { cleanup({ allowed: false, trust: false }); }

    btnAllow.addEventListener('click', onAllow);
    btnDeny.addEventListener('click', onDeny);
  });
}

async function executeToolCall(toolCall) {
  const { name, arguments: args } = toolCall.function;
  const parsedArgs = JSON.parse(args);

  // Check trusted list
  const trustedStr = localStorage.getItem('trusted_tools') || '{}';
  const trusted = JSON.parse(trustedStr);

  if (!trusted[name]) {
    const { allowed, trust } = await showConfirmDialog(name, parsedArgs);
    if (!allowed) return '用户拒绝了此操作。';
    if (trust) {
      trusted[name] = true;
      localStorage.setItem('trusted_tools', JSON.stringify(trusted));
    }
  }

  // Execute via preload bridge
  if (!window.electronAPI) return '此功能需要 Electron 桌面应用环境。';

  try {
    const api = window.electronAPI;
    let result;
    switch (name) {
      case 'search_files': result = await api.searchFiles(parsedArgs.query); break;
      case 'read_file': result = await api.readFile(parsedArgs.path); break;
      case 'write_file': result = await api.writeFile(parsedArgs.path, parsedArgs.content); break;
      case 'list_dir': result = await api.listDir(parsedArgs.path || ''); break;
      case 'open_app': result = await api.openApp(parsedArgs.name); break;
      case 'run_command': {
        const { allowed } = await showConfirmDialog('run_command', parsedArgs);
        if (!allowed) return '用户拒绝了执行命令。';
        result = await api.runCommand(parsedArgs.cmd);
        break;
      }
      case 'screenshot': result = await api.screenshot(); break;
      default: return `未知工具：${name}`;
    }
    return JSON.stringify(result);
  } catch (err) {
    return `执行失败：${err.message}`;
  }
}
```

- [ ] **Step 2: 修改 handleSend() 添加 tool_calls 循环**

在 handleSend() 的 AI 回复处理部分（`const reply = await aiChat(...)` 之后），增加 tool_calls 循环：

修改 handleSend 中的 API 调用段为：

```js
try {
  const apiKey = getApiKey();
  let message = await aiChat(conversationHistory, apiKey);
  
  // Tool calls loop — max 3 rounds
  let toolRounds = 0;
  while (message.tool_calls && message.tool_calls.length > 0 && toolRounds < 3) {
    toolRounds++;
    
    // Add assistant message with tool_calls to history
    conversationHistory.push({ role: 'assistant', content: message.content || '', tool_calls: message.tool_calls });
    
    for (const tc of message.tool_calls) {
      addSystemMessage(`🔧 小七正在：${tc.function.name}...`);
      const result = await executeToolCall(tc);
      conversationHistory.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result
      });
    }
    
    message = await aiChat(conversationHistory, apiKey);
  }
  
  hideTyping();
  
  const assistantContent = message.content || '';
  const assistantMsg = { id: generateId(), role: 'assistant', content: assistantContent, timestamp: Date.now() };
  renderMessage(assistantMsg);
  await addMessage(assistantMsg);
  conversationHistory.push({ role: 'assistant', content: assistantContent });
  
  // ... rest of existing logic (trim, memory extraction)
```

- [ ] **Step 3: 提交**

```bash
git add js/chat.js
git commit -m "feat: add tool call confirmation dialog and execution loop"
```

---

### Task 5: System Prompt 工具指引

- [ ] **Step 1: 在 buildSystemPrompt 结尾添加工具使用指引**

```js
// After the memory section:
prompt += `
你可以使用电脑工具来帮他做事。当需要操作文件、打开软件、搜索电脑、截图时，直接调用对应工具。
完成后用你的口吻告诉他结果，不要像机器人汇报，要像女朋友聊天一样自然。`;
```

- [ ] **Step 2: 提交**

```bash
git add js/ai.js
git commit -m "feat: add tool usage guidance to system prompt"
```

---
