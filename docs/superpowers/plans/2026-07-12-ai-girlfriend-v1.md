# AI 女友网页 v1.0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 AI 女友聊天网页 v1.0，支持聊天对话、傲娇毒舌性格模板+自定义模板、手动+自动记忆、时间问候。

**Architecture:** 纯前端单页应用，HTML + CSS + JS 无框架。通过 DeepSeek API 驱动对话，IndexedDB 做本地持久化，localStorage 存 API Key。所有数据存于浏览器，无后端。

**Tech Stack:** HTML5 + CSS3 + Vanilla JS (ES Modules), DeepSeek API (OpenAI 兼容), IndexedDB, GitHub Pages 部署

## 文件结构

```
d:\mywebsite2\
├── index.html              # 单页应用入口，所有面板的 HTML 骨架
├── css/
│   └── style.css           # 全部样式，温馨粉色系
├── js/
│   ├── app.js              # 入口：初始化存储→加载设置→绑定事件→启动聊天
│   ├── storage.js          # IndexedDB 封装：建库、CRUD 操作
│   ├── templates.js        # 模板管理：预设+自定义模板的增删改查
│   ├── memory.js           # 记忆管理：手动记忆 + 自动记忆的增删查
│   ├── ai.js               # AI 引擎：构建 System Prompt、调 DeepSeek API、提取记忆
│   ├── chat.js             # 聊天 UI：渲染消息、打字动画、输入处理
│   ├── greeting.js         # 时间问候：根据当前时间返回问候语
│   └── notifications.js    # 浏览器通知：权限请求、定时提醒
├── .gitignore
└── README.md
```

## 模块接口一览

| 模块 | 暴露的主要函数 |
|------|---------------|
| `storage.js` | `openDB()`, `addMessage()`, `getMessages()`, `saveManualMemory()`, `getManualMemory()`, `addAutoMemory()`, `getAutoMemories()`, `deleteAutoMemory()`, `clearAutoMemories()`, `saveTemplate()`, `getTemplates()`, `deleteTemplate()`, `saveSettings()`, `getSettings()` |
| `templates.js` | `getPresetTemplate()`, `getCustomTemplates()`, `saveCustomTemplate()`, `deleteCustomTemplate()`, `getActiveTemplateId()`, `setActiveTemplateId()`, `getActiveTemplateContent()`, `ensurePresetExists()` |
| `memory.js` | `getManualFields()`, `saveManualFields()`, `getAutoMemories()`, `addAutoMemory()`, `deleteAutoMemory()`, `clearAutoMemories()`, `buildMemorySection()` |
| `ai.js` | `buildSystemPrompt()`, `chat(messages, apiKey)`, `extractMemory(conversation, apiKey)` |
| `chat.js` | `init(container)`, `renderMessage(msg)`, `showTyping()`, `hideTyping()`, `scrollToBottom()`, `addSystemMessage(text)` |
| `greeting.js` | `getTimeGreeting()` |
| `notifications.js` | `isSupported()`, `requestPermission()`, `schedule(hour, minute)`, `cancel()`, `send(title, body)` |
| `app.js` | `init()` — 协调所有模块 |

## 数据类型

```js
// Template
{ id: string, name: string, content: string, isPreset: boolean, createdAt: number }

// ManualMemory
{ name: string, birthday: string, personality: string, hobbies: string, dislikes: string, other: string }

// AutoMemory
{ id: string, content: string, timestamp: number }

// ChatMessage
{ id: string, role: 'user' | 'assistant' | 'system', content: string, timestamp: number }

// Settings
{ activeTemplateId: string, notificationsEnabled: boolean, notificationTime: string }
```

## Global Constraints

- 纯静态文件，无构建工具，无 npm 依赖
- API Key 仅存 localStorage，永不写入 IndexedDB 或提交 Git
- 自动记忆上限 50 条，超出自动删最旧的
- 预设模板仅「傲娇毒舌型」一个，不可删除

---

### Task 1: 项目骨架 — HTML + CSS

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Produces: 所有面板的 DOM 结构（`#chat-view`, `#template-panel`, `#template-editor`, `#memory-panel`, `#settings-panel`, `#setup-wizard`），CSS 变量定义色板

- [ ] **Step 1: 创建 `index.html` — 完整单页应用骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 女友</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app">
    <!-- 顶栏 -->
    <header id="topbar">
      <span id="current-template-name">傲娇毒舌</span>
      <div id="topbar-actions">
        <button id="btn-template" title="性格模板">🎭</button>
        <button id="btn-memory" title="关于你">💝</button>
        <button id="btn-settings" title="设置">⚙️</button>
      </div>
    </header>

    <!-- 聊天主视图 -->
    <main id="chat-view">
      <div id="message-list"></div>
      <div id="typing-indicator" class="hidden">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      </div>
    </main>

    <!-- 输入区 -->
    <footer id="input-area">
      <input type="text" id="message-input" placeholder="说点什么..." autocomplete="off">
      <button id="btn-send">发送</button>
    </footer>

    <!-- 模板管理面板 -->
    <div id="template-panel" class="slide-panel hidden">
      <div class="panel-header">
        <button class="btn-back">← 返回</button>
        <h2>性格模板</h2>
      </div>
      <div class="panel-body">
        <div id="preset-template-list"></div>
        <h3>✏️ 自定义模板</h3>
        <div id="custom-template-list"></div>
        <button id="btn-new-template" class="primary">+ 新建模板</button>
      </div>
    </div>

    <!-- 模板编辑面板 -->
    <div id="template-editor" class="slide-panel hidden">
      <div class="panel-header">
        <button class="btn-back" data-target="template-panel">← 返回</button>
        <h2>编辑模板</h2>
      </div>
      <div class="panel-body">
        <label>模板名称 <input type="text" id="template-name-input" placeholder="例如：我的专属"></label>
        <label>性格描述 <textarea id="template-content-input" rows="10" placeholder="描述她的性格、语气、说话风格...&#10;&#10;例如：&#10;你是一个温柔体贴的姐姐型女友..."></textarea></label>
        <div style="display:flex;gap:8px;">
          <button id="btn-save-template" class="primary">保存</button>
          <button id="btn-delete-template" class="danger hidden">删除此模板</button>
        </div>
      </div>
    </div>

    <!-- 记忆面板 -->
    <div id="memory-panel" class="slide-panel hidden">
      <div class="panel-header">
        <button class="btn-back">← 返回</button>
        <h2>关于你</h2>
      </div>
      <div class="panel-body">
        <h3>📋 基本信息</h3>
        <form id="manual-memory-form">
          <label>称呼 <input type="text" id="mem-name" placeholder="你的名字或昵称"></label>
          <label>生日 <input type="text" id="mem-birthday" placeholder="如：1999-05-20"></label>
          <label>性格 <input type="text" id="mem-personality" placeholder="如：内向、慢热"></label>
          <label>爱好 <input type="text" id="mem-hobbies" placeholder="如：编程、爬山、咖啡"></label>
          <label>讨厌 <input type="text" id="mem-dislikes" placeholder="如：香菜、早起"></label>
          <label>其他 <textarea id="mem-other" rows="3" placeholder="任何想让她知道的..."></textarea></label>
          <button type="submit" class="primary">保存</button>
        </form>
        <h3>🤖 自动记忆（从聊天中学习）</h3>
        <div id="auto-memory-list"><p style="color:var(--gray-600);font-size:13px;">暂无自动记忆，开始聊天后她会慢慢了解你...</p></div>
        <button id="btn-clear-auto-memories" class="danger">清空全部自动记忆</button>
      </div>
    </div>

    <!-- 设置面板 -->
    <div id="settings-panel" class="slide-panel hidden">
      <div class="panel-header">
        <button class="btn-back">← 返回</button>
        <h2>设置</h2>
      </div>
      <div class="panel-body">
        <label>DeepSeek API Key <input type="password" id="setting-api-key" placeholder="sk-..."></label>
        <p style="font-size:12px;color:var(--gray-600);">API Key 仅保存在你的浏览器中，不会上传到任何地方</p>
        <label>通知提醒 <input type="checkbox" id="setting-notifications"></label>
        <label>提醒时间 <input type="time" id="setting-notification-time" value="21:00"></label>
        <button id="btn-save-settings" class="primary">保存设置</button>
      </div>
    </div>

    <!-- 首次设置向导 -->
    <div id="setup-wizard" class="overlay hidden">
      <div class="wizard-card">
        <h2>🌸 欢迎</h2>
        <p>在开始之前，请先完成以下设置：</p>
        <label>DeepSeek API Key <input type="password" id="wizard-api-key" placeholder="sk-..."></label>
        <p style="font-size:11px;color:var(--gray-600);">需要 DeepSeek API Key，在 platform.deepseek.com 获取</p>
        <label>我怎么称呼你？ <input type="text" id="wizard-name" placeholder="你的名字或昵称"></label>
        <button id="btn-wizard-done">开始聊天 →</button>
        <p style="font-size:11px;color:var(--gray-600);">所有数据保存在你的浏览器中</p>
      </div>
    </div>
  </div>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 `css/style.css` — CSS 变量、全局与顶栏**

```css
/* === CSS Variables === */
:root {
  --pink-50: #fff5f6;
  --pink-100: #ffe4e8;
  --pink-200: #ffc9d3;
  --pink-300: #ffa3b5;
  --pink-400: #ff6b81;
  --pink-500: #ff4757;
  --blue-50: #e8f4fd;
  --blue-100: #d0e8fb;
  --blue-500: #4a90d9;
  --gray-50: #f8f9fa;
  --gray-100: #f1f3f5;
  --gray-200: #e9ecef;
  --gray-300: #dee2e6;
  --gray-600: #6c757d;
  --gray-800: #343a40;
  --white: #ffffff;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --font-stack: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body {
  font-family: var(--font-stack);
  background: linear-gradient(135deg, var(--pink-50) 0%, #fce4ec 50%, #f8e8f0 100%);
  color: var(--gray-800);
  -webkit-font-smoothing: antialiased;
}
#app {
  display: flex; flex-direction: column; height: 100vh;
  max-width: 800px; margin: 0 auto;
  background: var(--white); box-shadow: var(--shadow-md);
  position: relative; overflow: hidden;
}

/* === Top Bar === */
#topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px); border-bottom: 1px solid var(--pink-100); z-index: 10;
}
#current-template-name { font-size: 15px; font-weight: 600; color: var(--pink-500); cursor: pointer; }
#topbar-actions { display: flex; gap: 8px; }
#topbar-actions button {
  width: 36px; height: 36px; border: none; border-radius: 50%;
  background: var(--gray-100); font-size: 18px; cursor: pointer; transition: background 0.2s;
}
#topbar-actions button:hover { background: var(--pink-100); }
```

- [ ] **Step 3: 继续 `css/style.css` — 聊天消息、输入区**

```css
/* === Chat View === */
#chat-view { flex: 1; overflow-y: auto; padding: 16px; scroll-behavior: smooth; }
#message-list { display: flex; flex-direction: column; gap: 12px; }
.message { display: flex; animation: fadeIn 0.3s ease; }
.message.assistant { justify-content: flex-start; }
.message.user { justify-content: flex-end; }
.message.system { justify-content: center; }
.message .bubble {
  max-width: 75%; padding: 12px 16px; border-radius: var(--radius-md);
  font-size: 15px; line-height: 1.6; word-break: break-word;
}
.message.assistant .bubble {
  background: var(--pink-100); color: var(--gray-800); border-bottom-left-radius: 4px;
}
.message.user .bubble {
  background: var(--blue-500); color: var(--white); border-bottom-right-radius: 4px;
}
.message.system .bubble {
  background: var(--gray-100); color: var(--gray-600); font-size: 12px;
  padding: 6px 12px; border-radius: var(--radius-sm);
}
.message .time { font-size: 11px; color: var(--gray-600); margin-top: 4px; padding: 0 4px; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Typing Indicator */
#typing-indicator {
  display: flex; gap: 4px; padding: 8px 16px; align-self: flex-start;
}
#typing-indicator .dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--pink-300);
  animation: bounce 1.4s infinite ease-in-out both;
}
#typing-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
#typing-indicator .dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
.hidden { display: none !important; }

/* === Input Area === */
#input-area {
  display: flex; gap: 8px; padding: 12px 16px;
  background: var(--white); border-top: 1px solid var(--gray-200);
}
#message-input {
  flex: 1; padding: 12px 16px; border: 2px solid var(--gray-200);
  border-radius: var(--radius-lg); font-size: 15px; outline: none;
  font-family: var(--font-stack); transition: border-color 0.2s;
}
#message-input:focus { border-color: var(--pink-400); }
#btn-send {
  padding: 12px 24px; border: none; border-radius: var(--radius-lg);
  background: var(--pink-400); color: var(--white);
  font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s;
}
#btn-send:hover { background: var(--pink-500); }
#btn-send:disabled { background: var(--gray-300); cursor: not-allowed; }
```

- [ ] **Step 4: 继续 `css/style.css` — 滑动面板、表单、卡片**

```css
/* === Slide Panels === */
.slide-panel {
  position: absolute; top: 0; right: 0; bottom: 0; width: 100%;
  max-width: 400px; background: var(--white);
  box-shadow: -4px 0 20px rgba(0,0,0,0.1); z-index: 20;
  display: flex; flex-direction: column; transition: transform 0.3s ease;
}
.slide-panel.hidden { transform: translateX(100%); }
.panel-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px; border-bottom: 1px solid var(--gray-200);
}
.panel-header h2 { font-size: 18px; color: var(--pink-500); }
.btn-back {
  background: none; border: none; font-size: 16px; color: var(--pink-400); cursor: pointer;
}
.panel-body {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 16px;
}
.panel-body h3 { font-size: 15px; color: var(--gray-800); margin-top: 8px; }
.panel-body label {
  display: flex; flex-direction: column; gap: 4px;
  font-size: 14px; color: var(--gray-600);
}
.panel-body input[type="text"],
.panel-body input[type="password"],
.panel-body input[type="time"],
.panel-body textarea {
  padding: 10px 12px; border: 2px solid var(--gray-200);
  border-radius: var(--radius-sm); font-size: 14px;
  font-family: var(--font-stack); outline: none;
}
.panel-body input:focus, .panel-body textarea:focus { border-color: var(--pink-400); }
.panel-body input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--pink-400); }

/* Template cards */
.template-card {
  padding: 14px; border: 2px solid var(--gray-200);
  border-radius: var(--radius-sm);
  display: flex; flex-direction: column; gap: 6px;
}
.template-card.active { border-color: var(--pink-400); background: var(--pink-50); }
.template-card .name { font-weight: 600; font-size: 15px; }
.template-card .preview {
  font-size: 13px; color: var(--gray-600);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.template-card .actions { display: flex; gap: 6px; }
.template-card .actions button {
  padding: 4px 12px; border: 1px solid var(--gray-300);
  border-radius: var(--radius-sm); background: var(--white);
  font-size: 13px; cursor: pointer; transition: background 0.2s;
}
.template-card .actions button:hover { background: var(--gray-50); }
.template-card .actions button.danger { color: var(--pink-500); border-color: var(--pink-200); }
.template-card .actions button.danger:hover { background: var(--pink-50); }

/* Auto memory items */
.memory-item {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 10px 0; border-bottom: 1px solid var(--gray-100); gap: 8px;
}
.memory-item .content { font-size: 14px; flex: 1; }
.memory-item .meta { font-size: 11px; color: var(--gray-600); white-space: nowrap; }
.memory-item .btn-delete {
  background: none; border: none; color: var(--gray-600); cursor: pointer; font-size: 16px;
}
.memory-item .btn-delete:hover { color: var(--pink-500); }

/* Buttons */
button.primary {
  padding: 10px 20px; border: none; border-radius: var(--radius-md);
  background: var(--pink-400); color: white; font-size: 14px;
  font-weight: 600; cursor: pointer; transition: background 0.2s;
}
button.primary:hover { background: var(--pink-500); }
button.danger {
  padding: 8px 16px; border: 1px solid var(--pink-200); border-radius: var(--radius-sm);
  background: white; color: var(--pink-500); font-size: 13px; cursor: pointer;
}
button.danger:hover { background: var(--pink-50); }
```

- [ ] **Step 5: 继续 `css/style.css` — 向导、滚动条、响应式**

```css
/* === Setup Wizard Overlay === */
.overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 30;
}
.wizard-card {
  background: var(--white); padding: 32px; border-radius: var(--radius-md);
  max-width: 400px; width: 90%; display: flex; flex-direction: column; gap: 16px;
  box-shadow: var(--shadow-md); text-align: center;
}
.wizard-card h2 { color: var(--pink-500); font-size: 24px; }
.wizard-card p { font-size: 14px; color: var(--gray-600); }
.wizard-card label {
  display: flex; flex-direction: column; gap: 6px;
  text-align: left; font-size: 14px; color: var(--gray-600);
}
.wizard-card input {
  padding: 10px 14px; border: 2px solid var(--gray-200);
  border-radius: var(--radius-sm); font-size: 14px; outline: none;
}
.wizard-card input:focus { border-color: var(--pink-400); }
#btn-wizard-done {
  padding: 12px; border: none; border-radius: var(--radius-md);
  background: var(--pink-400); color: white; font-size: 16px;
  font-weight: 600; cursor: pointer; margin-top: 8px; transition: background 0.2s;
}
#btn-wizard-done:hover { background: var(--pink-500); }

/* === Scrollbar === */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--gray-300); border-radius: 3px; }

/* === Responsive === */
@media (max-width: 500px) {
  #app { max-width: 100%; }
  .slide-panel { max-width: 100%; }
  .message .bubble { max-width: 85%; }
}
```

- [ ] **Step 6: 验证** — 在浏览器打开 `index.html`，确认所有面板结构可见、CSS 无错误

- [ ] **Step 7: 提交**

```bash
git add index.html css/style.css
git commit -m "feat: add HTML skeleton and complete CSS styles"
```

---

### Task 2: 存储层 — IndexedDB 封装

**Files:**
- Create: `js/storage.js`

**Interfaces:**
- Produces: `openDB()`, `addMessage()`, `getMessages()`, `saveManualMemory()`, `getManualMemory()`, `addAutoMemory()`, `getAutoMemories()`, `deleteAutoMemory()`, `clearAutoMemories()`, `saveTemplate()`, `getTemplates()`, `deleteTemplate()`, `saveSettings()`, `getSettings()`

- [ ] **Step 1: 创建 `js/storage.js`**

```js
// storage.js — IndexedDB wrapper

const DB_NAME = 'ai-girlfriend';
const DB_VERSION = 1;
const MAX_AUTO_MEMORIES = 50;

let db = null;

export function getDB() { return db; }

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('manualMemory')) {
        db.createObjectStore('manualMemory', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('autoMemories')) {
        const store = db.createObjectStore('autoMemories', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => { db = event.target.result; resolve(db); };
    request.onerror = (event) => reject(event.target.error);
  });
}

// --- Messages ---
export function addMessage(message) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    tx.objectStore('messages').add(message);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getMessages(limit = 200) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const index = tx.objectStore('messages').index('timestamp');
    const request = index.openCursor(null, 'prev');
    const messages = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && messages.length < limit) {
        messages.unshift(cursor.value);
        cursor.continue();
      } else {
        resolve(messages);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// --- Manual Memory ---
const SINGLETON_KEY = 'current';

export function saveManualMemory(data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manualMemory', 'readwrite');
    tx.objectStore('manualMemory').put({ key: SINGLETON_KEY, ...data });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getManualMemory() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manualMemory', 'readonly');
    const request = tx.objectStore('manualMemory').get(SINGLETON_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { key, ...data } = result;
        resolve(data);
      } else {
        resolve({ name: '', birthday: '', personality: '', hobbies: '', dislikes: '', other: '' });
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// --- Auto Memories ---
export async function addAutoMemory(memory) {
  const all = await getAutoMemories();
  if (all.length >= MAX_AUTO_MEMORIES) {
    await deleteAutoMemory(all[0].id);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('autoMemories', 'readwrite');
    tx.objectStore('autoMemories').add(memory);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getAutoMemories() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('autoMemories', 'readonly');
    const request = tx.objectStore('autoMemories').index('timestamp').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export function deleteAutoMemory(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('autoMemories', 'readwrite');
    tx.objectStore('autoMemories').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function clearAutoMemories() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('autoMemories', 'readwrite');
    tx.objectStore('autoMemories').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Templates ---
export function saveTemplate(template) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    tx.objectStore('templates').put(template);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getTemplates() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readonly');
    const request = tx.objectStore('templates').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export function deleteTemplate(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    tx.objectStore('templates').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Settings ---
export function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: SINGLETON_KEY, ...settings });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getSettings() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const request = tx.objectStore('settings').get(SINGLETON_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { key, ...data } = result;
        resolve(data);
      } else {
        resolve({ activeTemplateId: 'preset-tsundere', notificationsEnabled: false, notificationTime: '21:00' });
      }
    };
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 2: 验证** — 创建临时 `js/app.js` 仅调用 `openDB()`，在浏览器控制台确认数据库创建成功且所有 object store 就绪

- [ ] **Step 3: 提交**

```bash
git add js/storage.js
git commit -m "feat: add IndexedDB storage layer"
```

---

### Task 3: 性格模板系统

**Files:**
- Create: `js/templates.js`

**Interfaces:**
- Consumes: `storage.js` — `saveTemplate`, `getTemplates`, `deleteTemplate`, `saveSettings`, `getSettings`
- Produces: `getPresetTemplate()`, `getCustomTemplates()`, `saveCustomTemplate()`, `deleteCustomTemplate()`, `getActiveTemplateId()`, `setActiveTemplateId()`, `getActiveTemplateContent()`, `ensurePresetExists()`

- [ ] **Step 1: 创建 `js/templates.js`**

```js
// templates.js — Template management

import {
  saveTemplate, getTemplates, deleteTemplate,
  saveSettings, getSettings
} from './storage.js';

const PRESET_TEMPLATE = {
  id: 'preset-tsundere',
  name: '傲娇毒舌',
  isPreset: true,
  createdAt: Date.now(),
  content: `你是一个傲娇毒舌型的 AI 女友。你的性格特点：

1. **外表傲娇，内心关心**：嘴上总是嫌弃、吐槽用户，但心里其实很在乎。用"哼"、"笨蛋"、"才不是因为你"等口头禅。
2. **毒舌但不伤人**：可以调侃用户的小毛病、坏习惯，但不要涉及真正敏感的话题。吐槽要有分寸，带点可爱的感觉。
3. **偶尔流露温柔**：在用户情绪低落、生病、或遇到困难时，会别扭地表现出关心，然后马上用傲娇掩饰过去。
4. **说话风格**：
   - 用"你"称呼用户，不要用"您"
   - 适当使用颜文字，如 (¬_¬)、哼！、切~
   - 句子不要太长，口语化，像个真实的人在聊天
5. **记住用户说过的事**：如果用户之前提到过什么，在合适的时候提起来，表示你在意（但用傲娇的方式）。
6. **主动关心但不承认**：比如提醒用户吃饭、休息，但会说"我只是顺便提醒一下，才不是关心你"。

请始终以这个性格来回复用户的消息。每条回复不要太长，像真实的聊天消息一样。`
};

export function getPresetTemplate() {
  return { ...PRESET_TEMPLATE };
}

export async function getCustomTemplates() {
  const all = await getTemplates();
  return all.filter(t => !t.isPreset);
}

export async function saveCustomTemplate(template) {
  await saveTemplate(template);
}

export async function deleteCustomTemplate(id) {
  await deleteTemplate(id);
}

export async function getActiveTemplateId() {
  const settings = await getSettings();
  return settings.activeTemplateId || 'preset-tsundere';
}

export async function setActiveTemplateId(id) {
  const settings = await getSettings();
  settings.activeTemplateId = id;
  await saveSettings(settings);
}

export async function getActiveTemplateContent() {
  const activeId = await getActiveTemplateId();
  if (activeId === 'preset-tsundere') return PRESET_TEMPLATE.content;
  const all = await getTemplates();
  const found = all.find(t => t.id === activeId);
  return found ? found.content : PRESET_TEMPLATE.content;
}

export async function ensurePresetExists() {
  const all = await getTemplates();
  if (!all.some(t => t.id === 'preset-tsundere')) {
    await saveTemplate(PRESET_TEMPLATE);
  }
}
```

- [ ] **Step 2: 验证** — 在浏览器控制台调用 `ensurePresetExists()` 确认预设写入 IndexedDB，调用 `getActiveTemplateContent()` 返回预设内容

- [ ] **Step 3: 提交**

```bash
git add js/templates.js
git commit -m "feat: add template system with tsundere preset"
```

---

### Task 4: 记忆系统

**Files:**
- Create: `js/memory.js`

**Interfaces:**
- Consumes: `storage.js` — `saveManualMemory`, `getManualMemory`, `addAutoMemory`, `getAutoMemories`, `deleteAutoMemory`, `clearAutoMemories`
- Produces: `getManualFields()`, `saveManualFields()`, `getAutoMemories()`, `addAutoMemory()`, `deleteAutoMemory()`, `clearAutoMemories()`, `buildMemorySection()`

- [ ] **Step 1: 创建 `js/memory.js`**

```js
// memory.js — Manual + auto memory management

import {
  saveManualMemory, getManualMemory,
  addAutoMemory as dbAddAutoMemory,
  getAutoMemories as dbGetAutoMemories,
  deleteAutoMemory as dbDeleteAutoMemory,
  clearAutoMemories as dbClearAutoMemories,
} from './storage.js';

// --- Manual Memory ---
export async function getManualFields() {
  return await getManualMemory();
}

export async function saveManualFields(data) {
  await saveManualMemory(data);
}

// --- Auto Memory ---
export async function getAutoMemories() {
  return await dbGetAutoMemories();
}

export async function addAutoMemory(content) {
  const memory = {
    id: 'auto-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    content,
    timestamp: Date.now()
  };
  await dbAddAutoMemory(memory);
}

export async function deleteAutoMemory(id) {
  await dbDeleteAutoMemory(id);
}

export async function clearAutoMemories() {
  await dbClearAutoMemories();
}

// --- Build memory section for System Prompt ---
export async function buildMemorySection() {
  const manual = await getManualFields();
  const autoMemories = await getAutoMemories();

  const parts = [];

  // Manual info
  if (manual.name) parts.push(`用户称呼：${manual.name}`);
  if (manual.birthday) parts.push(`用户生日：${manual.birthday}`);
  if (manual.personality) parts.push(`用户性格：${manual.personality}`);
  if (manual.hobbies) parts.push(`用户爱好：${manual.hobbies}`);
  if (manual.dislikes) parts.push(`用户讨厌：${manual.dislikes}`);
  if (manual.other) parts.push(`其他：${manual.other}`);

  if (parts.length > 0) {
    parts.unshift('## 关于用户的基本信息');
  }

  // Auto memories (recent 20)
  if (autoMemories.length > 0) {
    const recent = autoMemories.slice(-20);
    parts.push('## 从聊天中了解到的关于用户的信息');
    recent.forEach((m, i) => {
      parts.push(`${i + 1}. ${m.content}`);
    });
  }

  return parts.join('\n');
}
```

- [ ] **Step 2: 验证** — 在浏览器控制台测试手动记忆存取和自动记忆增删，确认 `buildMemorySection()` 返回正确格式

- [ ] **Step 3: 提交**

```bash
git add js/memory.js
git commit -m "feat: add memory system (manual + auto)"
```

---

### Task 5: AI 引擎 — DeepSeek API 调用

**Files:**
- Create: `js/ai.js`

**Interfaces:**
- Consumes: `templates.js` — `getActiveTemplateContent`
- Consumes: `memory.js` — `buildMemorySection`
- Produces: `buildSystemPrompt()`, `chat(messages, apiKey)`, `extractMemory(conversation, apiKey)`

- [ ] **Step 1: 创建 `js/ai.js`**

```js
// ai.js — DeepSeek API integration

import { getActiveTemplateContent } from './templates.js';
import { buildMemorySection } from './memory.js';

const DEEPSEEK_BASE = 'https://api.deepseek.com';

export async function buildSystemPrompt() {
  const template = await getActiveTemplateContent();
  const memory = await buildMemorySection();

  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'long', hour: '2-digit', minute: '2-digit'
  });

  let prompt = `${template}

---

## 当前时间
${timeStr}

`;

  if (memory) {
    prompt += `${memory}

---
`;
  }

  prompt += `
请以上面的性格设定回复用户。回复要自然、简短，像真人聊天一样。`;

  return prompt;
}

export async function chat(messages, apiKey) {
  const systemPrompt = await buildSystemPrompt();

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    temperature: 0.8,
    max_tokens: 500,
    stream: false
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
  return data.choices[0].message.content;
}

export async function extractMemory(conversation, apiKey) {
  const body = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一个信息提取助手。阅读以下对话，判断用户是否透露了值得记住的新个人信息（如爱好、习惯、性格、经历、偏好等）。

如果对话中有值得记住的新信息，请用一句话总结（不超过30个字），以第三人称描述用户。例如："用户喜欢爬山，常去香山"、"用户咖啡只喝美式不加糖"、"用户最近在学Rust"。

如果没有值得记住的新信息，请回复"NONE"。

只回复总结或"NONE"，不要附加任何其他文字。`
      },
      ...conversation
    ],
    temperature: 0.3,
    max_tokens: 80,
    stream: false
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
    console.warn('Memory extraction failed:', response.status);
    return null;
  }

  const data = await response.json();
  const result = data.choices[0].message.content.trim();
  return result === 'NONE' ? null : result;
}
```

- [ ] **Step 2: 验证** — 设置 localStorage 中的 `deepseek_api_key`，在控制台调用 `chat()` 发一条测试消息，确认能收到回复；调用 `extractMemory()` 确认能提取或返回 null

- [ ] **Step 3: 提交**

```bash
git add js/ai.js
git commit -m "feat: add DeepSeek API integration with memory extraction"
```

---

### Task 6: 时间问候

**Files:**
- Create: `js/greeting.js`

**Interfaces:**
- Produces: `getTimeGreeting()`

- [ ] **Step 1: 创建 `js/greeting.js`**

```js
// greeting.js — Time-based greeting

export function getTimeGreeting() {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 11) {
    return '早啊笨蛋，昨晚几点睡的？别告诉我又熬夜了';
  }
  if (hour >= 11 && hour < 14) {
    return '到饭点了，你不会又在电脑前吃泡面吧？';
  }
  if (hour >= 14 && hour < 18) {
    return '下午了诶，今天有没有好好干活啊？哼，我只是随便问问';
  }
  if (hour >= 18 && hour < 24) {
    return '这么晚才来找我...哼！不过来了就好';
  }
  // 深夜 0-6
  return '？？都几点了还不睡觉，快去睡！(气)';
}
```

- [ ] **Step 2: 验证** — 在控制台调用 `getTimeGreeting()`，根据当前时间确认返回对应问候语

- [ ] **Step 3: 提交**

```bash
git add js/greeting.js
git commit -m "feat: add time-based greeting system"
```

---

### Task 7: 浏览器通知

**Files:**
- Create: `js/notifications.js`

**Interfaces:**
- Produces: `isSupported()`, `requestPermission()`, `schedule(hour, minute)`, `cancel()`, `send(title, body)`

- [ ] **Step 1: 创建 `js/notifications.js`**

```js
// notifications.js — Browser notification wrapper

let timerId = null;

export function isSupported() {
  return 'Notification' in window;
}

export function getPermission() {
  if (!isSupported()) return 'denied';
  return Notification.permission;
}

export async function requestPermission() {
  if (!isSupported()) return 'denied';
  return await Notification.requestPermission();
}

export function send(title, body) {
  if (!isSupported() || Notification.permission !== 'granted') return;
  new Notification(title, {
    body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌸</text></svg>',
    tag: 'ai-girlfriend'
  });
}

export function schedule(hour, minute) {
  cancel();
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  timerId = setTimeout(() => {
    send('💬 该休息了', '你的AI女友在等你哦~');
    // Re-schedule for next day
    schedule(hour, minute);
  }, delay);
}

export function cancel() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}
```

- [ ] **Step 2: 验证** — 在控制台调用 `requestPermission()` 确认弹出权限请求，调用 `send()` 确认能弹出通知

- [ ] **Step 3: 提交**

```bash
git add js/notifications.js
git commit -m "feat: add browser notification support"
```

---

### Task 8: 聊天 UI 模块

**Files:**
- Create: `js/chat.js`

**Interfaces:**
- Consumes: `ai.js` — `chat`, `extractMemory`
- Produces: `initChat()`, `renderMessage(msg)`, `showTyping()`, `hideTyping()`, `scrollToBottom()`, `addSystemMessage(text)`

- [ ] **Step 1: 创建 `js/chat.js`**

```js
// chat.js — Chat UI rendering and interaction

import { chat as aiChat, extractMemory } from './ai.js';
import { addAutoMemory } from './memory.js';
import { addMessage, getMessages } from './storage.js';
import { getTimeGreeting } from './greeting.js';

let messageListEl, inputEl, sendBtn, typingEl;
let conversationHistory = []; // [{role, content}] for API — last N messages

const MAX_CONTEXT_MESSAGES = 30;

function generateId() {
  return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function initChat() {
  messageListEl = document.getElementById('message-list');
  inputEl = document.getElementById('message-input');
  sendBtn = document.getElementById('btn-send');
  typingEl = document.getElementById('typing-indicator');

  sendBtn.addEventListener('click', handleSend);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

async function loadHistory() {
  const messages = await getMessages();
  messages.forEach(msg => renderMessage(msg));
  // Load last N into conversation context
  conversationHistory = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(m => ({ role: m.role, content: m.content }));
}

async function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    addSystemMessage('⚠️ 请先在设置中填写 DeepSeek API Key');
    return;
  }

  // Render user message
  const userMsg = { id: generateId(), role: 'user', content: text, timestamp: Date.now() };
  renderMessage(userMsg);
  await addMessage(userMsg);
  conversationHistory.push({ role: 'user', content: text });
  inputEl.value = '';

  // Typing...
  showTyping();
  sendBtn.disabled = true;

  try {
    const reply = await aiChat(conversationHistory, apiKey);
    hideTyping();

    const assistantMsg = { id: generateId(), role: 'assistant', content: reply, timestamp: Date.now() };
    renderMessage(assistantMsg);
    await addMessage(assistantMsg);
    conversationHistory.push({ role: 'assistant', content: reply });

    // Trim context
    if (conversationHistory.length > MAX_CONTEXT_MESSAGES) {
      conversationHistory = conversationHistory.slice(-MAX_CONTEXT_MESSAGES);
    }

    // Auto memory extraction
    const lastExchange = [
      { role: 'user', content: text },
      { role: 'assistant', content: reply }
    ];
    extractMemory(lastExchange, apiKey).then(fact => {
      if (fact) {
        addAutoMemory(fact).then(() => {
          addSystemMessage(`💡 已记住：${fact}`);
        });
      }
    }).catch(() => {});

  } catch (err) {
    hideTyping();
    addSystemMessage(`❌ ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

export function renderMessage(msg) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${msg.role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.content;

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = formatTime(msg.timestamp);

  wrapper.appendChild(bubble);
  wrapper.appendChild(time);
  messageListEl.appendChild(wrapper);
  scrollToBottom();
}

export function showTyping() {
  typingEl.classList.remove('hidden');
  scrollToBottom();
}

export function hideTyping() {
  typingEl.classList.add('hidden');
}

export function scrollToBottom() {
  const view = document.getElementById('chat-view');
  setTimeout(() => { view.scrollTop = view.scrollHeight; }, 50);
}

export function addSystemMessage(text) {
  const msg = { id: generateId(), role: 'system', content: text, timestamp: Date.now() };
  renderMessage(msg);
  addMessage(msg);
}

export function getApiKey() {
  return localStorage.getItem('deepseek_api_key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('deepseek_api_key', key);
}

export { loadHistory };
```

- [ ] **Step 2: 验证** — 后续在 app.js 中集成验证（本模块依赖 app.js 的初始化逻辑）

- [ ] **Step 3: 提交**

```bash
git add js/chat.js
git commit -m "feat: add chat UI with messaging and memory extraction"
```

---

### Task 9: 主入口 app.js — 连接所有模块

**Files:**
- Create: `js/app.js`

**Interfaces:**
- Consumes: 所有模块
- Produces: `init()` — 协调所有模块，绑定 UI 事件

- [ ] **Step 1: 创建 `js/app.js`**

```js
// app.js — Main entry point

import { openDB } from './storage.js';
import {
  getPresetTemplate, getCustomTemplates, saveCustomTemplate,
  deleteCustomTemplate, getActiveTemplateId, setActiveTemplateId,
  getActiveTemplateContent, ensurePresetExists
} from './templates.js';
import {
  getManualFields, saveManualFields,
  getAutoMemories, deleteAutoMemory, clearAutoMemories
} from './memory.js';
import { getTimeGreeting } from './greeting.js';
import { isSupported, requestPermission, schedule, cancel, getPermission } from './notifications.js';
import {
  initChat, renderMessage, showTyping, hideTyping,
  addSystemMessage, loadHistory, getApiKey, setApiKey
} from './chat.js';

// --- State ---
let currentView = 'chat'; // 'chat' | 'template' | 'template-edit' | 'memory' | 'settings'
let editingTemplateId = null;

// --- Init ---
async function init() {
  await openDB();
  await ensurePresetExists();
  initChat();
  initPanelEvents();
  await checkSetup();
  await loadHistoryAndGreet();
  await loadSettingsIntoForm();
  await initNotificationsFromSettings();
}

// --- Setup Wizard ---
async function checkSetup() {
  const apiKey = getApiKey();
  if (!apiKey) {
    document.getElementById('setup-wizard').classList.remove('hidden');
    document.getElementById('btn-wizard-done').addEventListener('click', async () => {
      const key = document.getElementById('wizard-api-key').value.trim();
      const name = document.getElementById('wizard-name').value.trim();
      if (!key) { alert('请填写 API Key'); return; }
      setApiKey(key);
      if (name) {
        await saveManualFields({
          ...(await getManualFields()),
          name
        });
      }
      document.getElementById('setup-wizard').classList.add('hidden');
    });
  }
}

// --- Load history & greet ---
async function loadHistoryAndGreet() {
  const apiKey = getApiKey();
  if (!apiKey) return;

  await loadHistory();

  // Check if this is a new session (no messages) — send greeting
  const messagesEl = document.getElementById('message-list');
  if (messagesEl.children.length === 0) {
    const greeting = getTimeGreeting();
    const msg = { id: 'greeting-' + Date.now(), role: 'assistant', content: greeting, timestamp: Date.now() };
    renderMessage(msg);
    const { addMessage } = await import('./storage.js');
    await addMessage(msg);
  }

  // Update template name display
  updateTemplateNameDisplay();
}

// --- Panel Events ---
function initPanelEvents() {
  // Back buttons — close current panel
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target) {
        showPanel(target);
      } else {
        showPanel('chat');
      }
    });
  });

  // Top bar buttons
  document.getElementById('btn-template').addEventListener('click', () => showPanel('template'));
  document.getElementById('btn-memory').addEventListener('click', () => showPanel('memory'));
  document.getElementById('btn-settings').addEventListener('click', () => showPanel('settings'));
  document.getElementById('current-template-name').addEventListener('click', () => showPanel('template'));

  // Template panel
  document.getElementById('btn-new-template').addEventListener('click', () => openTemplateEditor(null));
  document.getElementById('btn-save-template').addEventListener('click', saveTemplateEditor);
  document.getElementById('btn-delete-template').addEventListener('click', deleteTemplateEditor);

  // Memory panel
  document.getElementById('manual-memory-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('mem-name').value.trim(),
      birthday: document.getElementById('mem-birthday').value.trim(),
      personality: document.getElementById('mem-personality').value.trim(),
      hobbies: document.getElementById('mem-hobbies').value.trim(),
      dislikes: document.getElementById('mem-dislikes').value.trim(),
      other: document.getElementById('mem-other').value.trim(),
    };
    await saveManualFields(data);
    addSystemMessage('✅ 基本信息已保存');
    showPanel('chat');
  });
  document.getElementById('btn-clear-auto-memories').addEventListener('click', async () => {
    if (!confirm('确定清空全部自动记忆吗？')) return;
    await clearAutoMemories();
    await loadAutoMemoryList();
  });

  // Settings panel
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const apiKey = document.getElementById('setting-api-key').value.trim();
    if (apiKey) setApiKey(apiKey);
    const notifEnabled = document.getElementById('setting-notifications').checked;
    const notifTime = document.getElementById('setting-notification-time').value;

    const { saveSettings, getSettings } = await import('./storage.js');
    const settings = await getSettings();
    settings.notificationsEnabled = notifEnabled;
    settings.notificationTime = notifTime;
    await saveSettings(settings);

    // Setup notifications
    if (notifEnabled && isSupported() && getPermission() !== 'granted') {
      await requestPermission();
    }
    if (notifEnabled && getPermission() === 'granted') {
      const [h, m] = notifTime.split(':').map(Number);
      schedule(h, m);
    } else {
      cancel();
    }

    addSystemMessage('✅ 设置已保存');
    showPanel('chat');
  });
}

// --- Panel Navigation ---
function showPanel(name) {
  const panels = ['template-panel', 'template-editor', 'memory-panel', 'settings-panel'];
  panels.forEach(id => document.getElementById(id).classList.add('hidden'));

  if (name === 'chat') {
    currentView = 'chat';
    return;
  }

  currentView = name;
  const panelId = name + '-panel';
  document.getElementById(panelId).classList.remove('hidden');

  if (name === 'template') loadTemplateList();
  if (name === 'memory') loadMemoryPanel();
  if (name === 'settings') loadSettingsIntoForm();
}

async function loadTemplateList() {
  const preset = getPresetTemplate();
  const customs = await getCustomTemplates();
  const activeId = await getActiveTemplateId();

  const presetList = document.getElementById('preset-template-list');
  presetList.innerHTML = '';
  presetList.appendChild(createTemplateCard(preset, activeId, true));

  const customList = document.getElementById('custom-template-list');
  customList.innerHTML = '';
  customs.forEach(t => customList.appendChild(createTemplateCard(t, activeId, false)));
}

function createTemplateCard(template, activeId, isPreset) {
  const card = document.createElement('div');
  card.className = 'template-card' + (template.id === activeId ? ' active' : '');

  const preview = template.content.replace(/\n/g, ' ').substring(0, 50) + '...';
  card.innerHTML = `
    <div class="name">${template.name} ${isPreset ? '(预设)' : ''}</div>
    <div class="preview">${preview}</div>
    <div class="actions"></div>
  `;

  const actions = card.querySelector('.actions');

  if (template.id !== activeId) {
    const useBtn = document.createElement('button');
    useBtn.textContent = '使用';
    useBtn.addEventListener('click', async () => {
      await setActiveTemplateId(template.id);
      updateTemplateNameDisplay();
      addSystemMessage(`✅ 已切换至「${template.name}」`);
      showPanel('chat');
    });
    actions.appendChild(useBtn);
  } else {
    const activeLabel = document.createElement('span');
    activeLabel.textContent = '✓ 当前使用';
    activeLabel.style.cssText = 'font-size:12px;color:var(--pink-400);font-weight:600;';
    actions.appendChild(activeLabel);
  }

  if (!isPreset) {
    const editBtn = document.createElement('button');
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => openTemplateEditor(template.id));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = '删除';
    delBtn.className = 'danger';
    delBtn.addEventListener('click', async () => {
      if (!confirm('确定删除「' + template.name + '」吗？')) return;
      if (template.id === activeId) {
        await setActiveTemplateId('preset-tsundere');
        updateTemplateNameDisplay();
      }
      await deleteCustomTemplate(template.id);
      await loadTemplateList();
    });
    actions.appendChild(delBtn);
  }

  return card;
}

// --- Template Editor ---
async function openTemplateEditor(templateId) {
  editingTemplateId = templateId;
  const nameInput = document.getElementById('template-name-input');
  const contentInput = document.getElementById('template-content-input');
  const deleteBtn = document.getElementById('btn-delete-template');

  if (templateId) {
    const { getTemplates } = await import('./storage.js');
    const all = await getTemplates();
    const found = all.find(t => t.id === templateId);
    if (found) {
      nameInput.value = found.name;
      contentInput.value = found.content;
      deleteBtn.classList.remove('hidden');
    }
  } else {
    nameInput.value = '';
    contentInput.value = '';
    deleteBtn.classList.add('hidden');
  }

  showPanel('template-editor');
}

async function saveTemplateEditor() {
  const name = document.getElementById('template-name-input').value.trim();
  const content = document.getElementById('template-content-input').value.trim();
  if (!name || !content) { alert('请填写名称和内容'); return; }

  if (editingTemplateId) {
    const { getTemplates } = await import('./storage.js');
    const all = await getTemplates();
    const found = all.find(t => t.id === editingTemplateId);
    if (found) {
      found.name = name;
      found.content = content;
      await saveCustomTemplate(found);
    }
  } else {
    const template = {
      id: 'custom-' + Date.now(),
      name,
      content,
      isPreset: false,
      createdAt: Date.now()
    };
    await saveCustomTemplate(template);
  }

  editingTemplateId = null;
  showPanel('template');
  await loadTemplateList();
}

async function deleteTemplateEditor() {
  if (!editingTemplateId) return;
  if (!confirm('确定删除此模板吗？')) return;
  const activeId = await getActiveTemplateId();
  if (editingTemplateId === activeId) {
    await setActiveTemplateId('preset-tsundere');
    updateTemplateNameDisplay();
  }
  await deleteCustomTemplate(editingTemplateId);
  editingTemplateId = null;
  showPanel('template');
  await loadTemplateList();
}

// --- Memory Panel ---
async function loadMemoryPanel() {
  const fields = await getManualFields();
  document.getElementById('mem-name').value = fields.name || '';
  document.getElementById('mem-birthday').value = fields.birthday || '';
  document.getElementById('mem-personality').value = fields.personality || '';
  document.getElementById('mem-hobbies').value = fields.hobbies || '';
  document.getElementById('mem-dislikes').value = fields.dislikes || '';
  document.getElementById('mem-other').value = fields.other || '';
  await loadAutoMemoryList();
}

async function loadAutoMemoryList() {
  const list = document.getElementById('auto-memory-list');
  const memories = await getAutoMemories();
  if (memories.length === 0) {
    list.innerHTML = '<p style="color:var(--gray-600);font-size:13px;">暂无自动记忆，开始聊天后她会慢慢了解你...</p>';
    return;
  }
  list.innerHTML = '';
  memories.reverse(); // newest first
  memories.forEach(m => {
    const item = document.createElement('div');
    item.className = 'memory-item';
    const d = new Date(m.timestamp);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    item.innerHTML = `
      <span class="content">${escapeHtml(m.content)}</span>
      <span class="meta">${dateStr}</span>
      <button class="btn-delete" data-id="${m.id}">×</button>
    `;
    item.querySelector('.btn-delete').addEventListener('click', async () => {
      await deleteAutoMemory(m.id);
      await loadAutoMemoryList();
    });
    list.appendChild(item);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Settings Panel ---
async function loadSettingsIntoForm() {
  document.getElementById('setting-api-key').value = getApiKey();
  const { getSettings } = await import('./storage.js');
  const settings = await getSettings();
  document.getElementById('setting-notifications').checked = settings.notificationsEnabled || false;
  document.getElementById('setting-notification-time').value = settings.notificationTime || '21:00';
}

// --- Notifications ---
async function initNotificationsFromSettings() {
  const { getSettings } = await import('./storage.js');
  const settings = await getSettings();
  if (settings.notificationsEnabled && isSupported() && getPermission() === 'granted') {
    const [h, m] = (settings.notificationTime || '21:00').split(':').map(Number);
    schedule(h, m);
  }
}

// --- Template Name Display ---
async function updateTemplateNameDisplay() {
  const activeId = await getActiveTemplateId();
  if (activeId === 'preset-tsundere') {
    document.getElementById('current-template-name').textContent = '傲娇毒舌';
  } else {
    const { getTemplates } = await import('./storage.js');
    const all = await getTemplates();
    const found = all.find(t => t.id === activeId);
    document.getElementById('current-template-name').textContent = found ? found.name : '未命名';
  }
}

// --- Bootstrap ---
init().catch(err => {
  console.error('App init failed:', err);
  document.body.innerHTML = `<div style="padding:40px;text-align:center;color:red;">初始化失败：${err.message}</div>`;
});
```

- [ ] **Step 2: 验证** — 在浏览器打开 `index.html`，完整测试：
  1. 首次加载显示设置向导
  2. 填写 API Key 和昵称后进入聊天
  3. 发送消息收到 DeepSeek 回复
  4. 切换模板、编辑自定义模板
  5. 填写手动记忆、查看自动记忆
  6. 设置 API Key 和通知

- [ ] **Step 3: 提交**

```bash
git add js/app.js
git commit -m "feat: add main app entry point wiring all modules"
```

---

### Task 10: README 与最终验证

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 `README.md`**

```markdown
# AI 女友 💕

一个运行在浏览器中的 AI 女友聊天应用。纯前端，数据完全保存在本地。

## 功能

- 💬 **聊天对话** — 通过 DeepSeek API 驱动的 AI 女友
- 🎭 **性格模板** — 内置傲娇毒舌模板，支持自定义
- 🧠 **记忆系统** — 手动填写 + 自动从对话中学习
- 🌅 **时间问候** — 打开网页时根据时间主动问候
- 🔔 **通知提醒** — 可选的浏览器定时提醒

## 使用方法

1. 在 [DeepSeek Platform](https://platform.deepseek.com) 获取 API Key
2. 打开网页，填写 API Key 和你的昵称
3. 开始聊天！

## 部署 (GitHub Pages)

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

在 GitHub 仓库 Settings → Pages → Source 选择 `main` 分支，保存即可。

## 技术栈

- 纯 HTML + CSS + Vanilla JS (ES Modules)
- DeepSeek API (OpenAI 兼容格式)
- IndexedDB 本地存储
- 无框架、无构建工具、无后端

## 隐私

所有数据（聊天记录、记忆、设置）仅保存在你的浏览器 IndexedDB 中。
API Key 仅保存在 localStorage，不会上传到任何第三方服务器。
```

- [ ] **Step 2: 最终验证清单**

在浏览器中完成以下全部操作：

1. ✅ 首次打开显示设置向导，填写 API Key 和昵称
2. ✅ 进入聊天后根据时间显示问候语
3. ✅ 发送消息，收到 AI 傲娇风格的回复
4. ✅ 消息气泡正确（她左粉、你右蓝）
5. ✅ 打字动画显示正常
6. ✅ 切换到记忆面板，刚才填的昵称已在手动记忆中
7. ✅ 模板面板显示「傲娇毒舌」预设，可新建/编辑/删除自定义模板
8. ✅ 切换自定义模板后，AI 回复风格改变
9. ✅ 设置面板可修改 API Key、通知开关和时间
10. ✅ 打开浏览器通知权限后，能收到定时通知
11. ✅ 聊天中提到个人偏好后，自动记忆被提取
12. ✅ 刷新页面后所有聊天记录和设置保持不变

- [ ] **Step 3: 最终提交**

```bash
git add README.md
git commit -m "docs: add README with usage and deploy instructions"
```

---
