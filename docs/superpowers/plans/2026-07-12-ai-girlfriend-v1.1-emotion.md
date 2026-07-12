# AI 女友 v1.1 — 情感深度 & 主动性增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增情绪引擎和主动行为系统，让 AI 女友具备动态情绪和主动发起对话的能力。

**Architecture:** 新增 `js/mood.js`（四维情绪状态机）和 `js/proactive.js`（空闲/时间节点/话题回顾三种主动行为），修改 `js/storage.js`（增加 mood 和 pendingTopic 存储）、`js/ai.js`（注入情绪描述）、`js/chat.js`（钩子：情绪更新+空闲重置+待跟进话题）、`js/app.js`（初始化新模块）。

**Tech Stack:** HTML5 + CSS3 + Vanilla JS (ES Modules), DeepSeek API, IndexedDB

## Global Constraints

- 主动消息仅页面打开时触发，不使用 Service Worker
- 情绪状态存 IndexedDB，页面刷新后保持
- 主动消息 API 调用量控制：每 10 分钟最多 1 次额外 API 调用
- API Key 仅存 localStorage
- 纯静态文件，无构建工具

---

### Task 1: 存储层扩展 — mood 和 pendingTopic

**Files:**
- Modify: `js/storage.js`

**Interfaces:**
- Produces: `saveMood(mood)`, `getMood()`, `savePendingTopic(topic)`, `getPendingTopic()`, `clearPendingTopic()`

- [ ] **Step 1: 升级 DB，新增 object stores**

修改 `openDB()`：`DB_VERSION` 改为 `2`，`onupgradeneeded` 中新增两个 store。

```js
// storage.js — line 3: bump version
const DB_VERSION = 2;

// Inside onupgradeneeded, after existing store checks (line 33):
if (!db.objectStoreNames.contains('mood')) {
  db.createObjectStore('mood', { keyPath: 'key' });
}
if (!db.objectStoreNames.contains('pendingTopic')) {
  db.createObjectStore('pendingTopic', { keyPath: 'key' });
}
```

- [ ] **Step 2: 添加 mood 存取函数**

在 storage.js 末尾追加：

```js
// --- Mood ---
const MOOD_KEY = 'current';

export function saveMood(mood) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mood', 'readwrite');
    tx.objectStore('mood').put({ key: MOOD_KEY, ...mood });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getMood() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mood', 'readonly');
    const request = tx.objectStore('mood').get(MOOD_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { key, ...data } = result;
        resolve(data);
      } else {
        resolve({ happy: 50, closeness: 30, pouty: 20, worried: 10 });
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// --- Pending Topic ---
const TOPIC_KEY = 'current';

export function savePendingTopic(topic) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingTopic', 'readwrite');
    tx.objectStore('pendingTopic').put({ key: TOPIC_KEY, topic, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getPendingTopic() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingTopic', 'readonly');
    const request = tx.objectStore('pendingTopic').get(TOPIC_KEY);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.topic : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export function clearPendingTopic() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingTopic', 'readwrite');
    tx.objectStore('pendingTopic').delete(TOPIC_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 3: 验证** — 浏览器控制台中确认 `getMood()` 返回默认值，`saveMood()` 后读取正确

- [ ] **Step 4: 提交**

```bash
git add js/storage.js
git commit -m "feat: add mood and pendingTopic stores to IndexedDB"
```

---

### Task 2: 情绪引擎 — js/mood.js

**Files:**
- Create: `js/mood.js`

**Interfaces:**
- Consumes: `storage.js` — `saveMood`, `getMood`
- Produces: `initMood()`, `getMood()`, `updateMood(changes)`, `getMoodDescription()`, `applyTimeDecay()`

- [ ] **Step 1: 创建 `js/mood.js`**

```js
// mood.js — Emotional state machine

import { saveMood, getMood } from './storage.js';

let mood = { happy: 50, closeness: 30, pouty: 20, worried: 10 };
let decayTimer = null;

export { getMood };

export function getMood() {
  return { ...mood };
}

export async function initMood() {
  const saved = await getMood();
  mood = saved;
  startDecayTimer();
}

export async function updateMood(changes) {
  // Apply deltas with [0, 100] clamping
  for (const key of Object.keys(changes)) {
    if (key in mood) {
      mood[key] = Math.max(0, Math.min(100, mood[key] + changes[key]));
    }
  }
  await saveMood(mood);
}

async function applyTimeDecay() {
  // Hourly decay: happy -> baseline, pouty rises, worried -> baseline
  const changes = {
    happy: mood.happy > 50 ? -1 : 1,
    pouty: Math.min(100, mood.pouty + 2),
    worried: mood.worried > 10 ? -1 : 0
  };
  await updateMood(changes);
}

function startDecayTimer() {
  if (decayTimer) clearInterval(decayTimer);
  decayTimer = setInterval(applyTimeDecay, 60 * 60 * 1000); // every hour
}

export function stopDecayTimer() {
  if (decayTimer) {
    clearInterval(decayTimer);
    decayTimer = null;
  }
}

export function getMoodDescription() {
  const lines = [];

  if (mood.happy > 70) {
    lines.push('你现在心情很好，语气轻快活泼，愿意和他多聊几句。');
  } else if (mood.happy < 30) {
    lines.push('你现在心情不太好，语气会比平时更冷淡或更尖锐。');
  }

  if (mood.pouty > 60) {
    lines.push('你现在有点闹别扭，觉得他不够重视你。嘴上会抱怨、撒娇、故意不理他。');
  } else if (mood.pouty > 30) {
    lines.push('你有一点想撒娇，语气比平时更黏人一点。');
  }

  if (mood.worried > 50) {
    lines.push('你现在有些担心他，忍不住想唠叨他几句，催他吃饭/休息。');
  }

  if (mood.closeness > 70) {
    lines.push('你已经很依赖他了，语气中会不自觉地流露温柔，偶尔会说出心里话。');
  } else if (mood.closeness < 20) {
    lines.push('你和他还不太熟，保持一点距离感，傲娇成分更多。');
  }

  if (lines.length === 0) {
    lines.push('你现在的情绪比较平稳，像平时一样和他聊天。');
  }

  return '## 当前情绪状态\n' + lines.join('\n');
}
```

- [ ] **Step 2: 验证** — 控制台调用 `initMood()` → `getMood()` → `updateMood({happy: 30})` → `getMoodDescription()` 确认返回正确描述

- [ ] **Step 3: 提交**

```bash
git add js/mood.js
git commit -m "feat: add emotional state machine with 4-dimension mood model"
```

---

### Task 3: AI 提示词集成 — 注入情绪状态

**Files:**
- Modify: `js/ai.js`

**Interfaces:**
- Consumes: `mood.js` — `getMoodDescription`
- Produces: 修改后的 `buildSystemPrompt()`（增加情绪段）

- [ ] **Step 1: 修改 `js/ai.js` — 导入 mood，注入情绪描述**

```js
// ai.js — 在文件顶部导入区添加：
import { getMoodDescription } from './mood.js';

// buildSystemPrompt() 中，在 template 之后、memory 之前插入情绪段：

export async function buildSystemPrompt() {
  const template = await getActiveTemplateContent();
  const moodDesc = getMoodDescription();   // ← 新增
  const memory = await buildMemorySection();

  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'long', hour: '2-digit', minute: '2-digit'
  });

  let prompt = `${template}

---

${moodDesc}

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
请以上面的性格设定和当前情绪状态回复用户。回复要自然、简短，像真人聊天一样。
情绪状态是你的内心感受，决定了你的语气和态度，但不要在回复中直接说出你的情绪数值。`;

  return prompt;
}
```

完整改动：在 `ai.js` 顶部 `import { buildMemorySection } from './memory.js';` 之后加一行导入，在 `buildSystemPrompt()` 中 `const memory = ...` 之前加 `const moodDesc = ...`，并在 prompt 模板中 `---` 之后插入 `${moodDesc}`。

- [ ] **Step 2: 验证** — 确认 `buildSystemPrompt()` 返回的 prompt 中包含情绪状态段

- [ ] **Step 3: 提交**

```bash
git add js/ai.js
git commit -m "feat: inject emotional state into AI system prompt"
```

---

### Task 4: 聊天钩子 — 情绪更新 + 待跟进话题

**Files:**
- Modify: `js/chat.js`

**Interfaces:**
- Consumes: `mood.js` — `updateMood`
- Consumes: `storage.js` — `savePendingTopic`, `getPendingTopic`
- Produces: 修改后的 `handleSend()`（情绪更新+话题检测）、新增 `resetIdleTimer` 导出

- [ ] **Step 1: 修改 `js/chat.js` — 添加导入**

```js
// chat.js — 在现有导入行之后添加：
import { updateMood } from './mood.js';
import { savePendingTopic } from './storage.js';
```

- [ ] **Step 2: 修改 `handleSend()` — 用户消息后更新情绪**

在 `handleSend()` 中，`conversationHistory.push({ role: 'user', content: text });` 之后添加：

```js
// Analyze user message sentiment and update mood (simple keyword approach)
const positiveWords = ['哈哈', '开心', '谢谢', '喜欢', '好棒', '厉害', '爱', '想你', '棒', '太好了'];
const negativeWords = ['烦', '累', '难过', '压力', '忙', '不开心', '生气', '焦虑', '失眠', '头疼'];

const hasPositive = positiveWords.some(w => text.includes(w));
const hasNegative = negativeWords.some(w => text.includes(w));

const moodChanges = {};
if (hasPositive) {
  moodChanges.happy = 5;
  moodChanges.closeness = 3;
} else if (hasNegative) {
  moodChanges.worried = 10;
  moodChanges.happy = -5;
} else {
  moodChanges.happy = 2;
}
updateMood(moodChanges);
```

- [ ] **Step 3: AI 回复后检测待跟进话题**

在 `extractMemory(...)` 的 `.then()` 链中，追加话题检测逻辑。将现有的 `catch(() => {})` 替换为：

```js
// Detect pending topic from user's last message
const topicWords = ['面试', '考试', '出差', '旅行', '要去', '打算', '准备', '计划', '明天', '下次', '周末', '约会', '项目', '答辩', '搬家', '看病'];
const hasTopic = topicWords.some(w => text.includes(w));
if (hasTopic) {
  savePendingTopic(text.substring(0, 100));
}
```

- [ ] **Step 4: 导出 idle 重置函数**

```js
// At the bottom of chat.js, add:
export function resetIdleTimer() {
  // Will be wired by proactive.js — just declare the hook
  document.dispatchEvent(new CustomEvent('user-activity'));
}
```

在 `handleSend()` 开头（`const text = ...` 之后）调用 `resetIdleTimer()`。

- [ ] **Step 5: 验证** — 发一条含负面词的消息，控制台确认 mood 值变化；发含"面试"的消息，确认 pendingTopic 已存储

- [ ] **Step 6: 提交**

```bash
git add js/chat.js
git commit -m "feat: add mood updates and pending topic detection to chat"
```

---

### Task 5: 主动行为系统 — js/proactive.js

**Files:**
- Create: `js/proactive.js`

**Interfaces:**
- Consumes: `storage.js` — `getPendingTopic`, `clearPendingTopic`, `addMessage`
- Consumes: `ai.js` — `chat`
- Consumes: `chat.js` — `renderMessage`, `addSystemMessage`, `getApiKey`
- Produces: `initProactive()`, `destroyProactive()`

- [ ] **Step 1: 创建 `js/proactive.js`**

```js
// proactive.js — Proactive behavior system

import { getPendingTopic, clearPendingTopic } from './storage.js';
import { chat as aiChat } from './ai.js';
import { renderMessage, getApiKey } from './chat.js';

let idleTimer = null;
let timeNodeTimer = null;
let lastProactiveTime = 0;
const PROACTIVE_COOLDOWN = 10 * 60 * 1000; // 10 minutes between proactive messages
const IDLE_STAGES = [
  { minutes: 3, message: null },  // just "..." typing indicator
  { minutes: 10, message: null }, // will call API
  { minutes: 30, message: null }, // will call API
];

let idleStageIdx = 0;
let idleStartTime = null;

export async function initProactive() {
  startIdleDetection();
  startTimeNodeCheck();
  await checkPendingTopicFollowUp();
}

export function destroyProactive() {
  if (idleTimer) clearTimeout(idleTimer);
  if (timeNodeTimer) clearTimeout(timeNodeTimer);
}

// --- Idle Detection ---
function startIdleDetection() {
  idleStartTime = Date.now();
  idleStageIdx = 0;
  scheduleNextIdleCheck();

  document.addEventListener('user-activity', () => {
    idleStartTime = Date.now();
    idleStageIdx = 0;
    scheduleNextIdleCheck();
  });
}

function scheduleNextIdleCheck() {
  if (idleTimer) clearTimeout(idleTimer);
  if (idleStageIdx >= IDLE_STAGES.length) return; // No more stages

  const stage = IDLE_STAGES[idleStageIdx];
  const delay = stage.minutes * 60 * 1000;
  idleTimer = setTimeout(() => handleIdleStage(stage), delay);
}

async function handleIdleStage(stage) {
  if (!canBeProactive()) return;

  if (stage.minutes === 3) {
    // Just show typing briefly then hide — no message
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl) {
      typingEl.classList.remove('hidden');
      setTimeout(() => typingEl.classList.add('hidden'), 3000);
    }
  } else {
    // Generate AI proactive message
    const apiKey = getApiKey();
    if (!apiKey) return;

    try {
      const context = stage.minutes >= 30
        ? [{ role: 'user', content: '（已经很久没说话了...）' }]
        : [{ role: 'user', content: '（沉默了一会儿...）' }];

      const reply = await aiChat(context, apiKey);
      const msg = { id: 'proactive-' + Date.now(), role: 'assistant', content: reply, timestamp: Date.now() };
      renderMessage(msg);
      const { addMessage } = await import('./storage.js');
      await addMessage(msg);
      lastProactiveTime = Date.now();
    } catch (e) {
      console.warn('Proactive message failed:', e);
    }
  }

  idleStageIdx++;
  scheduleNextIdleCheck();
}

// --- Time Node Check ---
function startTimeNodeCheck() {
  // Check every 2 minutes if we're in a trigger window
  timeNodeTimer = setInterval(checkTimeNodes, 2 * 60 * 1000);
  checkTimeNodes(); // Initial check
}

async function checkTimeNodes() {
  if (!canBeProactive()) return;

  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const time = hour + minute / 60;

  let prompt = null;
  if (time >= 11.5 && time <= 12.5) {
    prompt = [{ role: 'user', content: '（到午饭时间了）' }];
  } else if (time >= 18.5 && time <= 19.5) {
    prompt = [{ role: 'user', content: '（到晚饭时间了）' }];
  } else if (time >= 22.5 && time <= 23.5) {
    prompt = [{ role: 'user', content: '（已经深夜了，该休息了）' }];
  }

  if (!prompt) return;

  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const reply = await aiChat(prompt, apiKey);
    const msg = { id: 'timenode-' + Date.now(), role: 'assistant', content: reply, timestamp: Date.now() };
    renderMessage(msg);
    const { addMessage } = await import('./storage.js');
    await addMessage(msg);
    lastProactiveTime = Date.now();
  } catch (e) {
    console.warn('Time node message failed:', e);
  }
}

// --- Pending Topic Follow-Up ---
async function checkPendingTopicFollowUp() {
  const topic = await getPendingTopic();
  if (!topic) return;

  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const followUpPrompt = [
      { role: 'user', content: `（用户上次聊天提到了：${topic}。请主动追问这件事的后续，用你的性格和情绪自然地问。）` }
    ];
    const reply = await aiChat(followUpPrompt, apiKey);
    const msg = { id: 'followup-' + Date.now(), role: 'assistant', content: reply, timestamp: Date.now() };
    renderMessage(msg);
    const { addMessage } = await import('./storage.js');
    await addMessage(msg);
    await clearPendingTopic();
  } catch (e) {
    console.warn('Follow-up message failed:', e);
  }
}

// --- Rate Limiting ---
function canBeProactive() {
  // Don't trigger if cooldown hasn't passed
  if (Date.now() - lastProactiveTime < PROACTIVE_COOLDOWN) return false;
  // Don't trigger if user was active in last 60 seconds
  if (idleStartTime && Date.now() - idleStartTime < 60000) return false;
  return true;
}
```

- [ ] **Step 2: 验证** — 控制台调用 `initProactive()`，确认空闲计时器启动；等待 3 分钟观察打字指示器；发条消息验证计时器重置

- [ ] **Step 3: 提交**

```bash
git add js/proactive.js
git commit -m "feat: add proactive behavior system (idle, time nodes, topic follow-up)"
```

---

### Task 6: 应用集成 — 初始化新模块

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: 修改 `js/app.js` — 导入并初始化**

顶部导入区添加：

```js
import { initMood } from './mood.js';
import { initProactive, destroyProactive } from './proactive.js';
```

`init()` 函数中，在 `await openDB();` 之后、`initChat();` 之前添加：

```js
await initMood();
initProactive();
```

- [ ] **Step 2: 页面关闭时清理**

在 `init()` 末尾添加（在 `catch` 之前）：

```js
window.addEventListener('beforeunload', () => {
  destroyProactive();
});
```

- [ ] **Step 3: 验证** — 完整流程测试：
  1. 打开页面→情绪引擎初始化
  2. 发条消息→情绪变化注入 Prompt
  3. 打开话题（提到"面试"）→待跟进话题存储
  4. 关闭再打开→话题回顾消息自动出现
  5. 空闲 3 分钟→打字指示器闪现
  6. 中午 12 点左右打开→主动提醒吃饭

- [ ] **Step 4: 提交**

```bash
git add js/app.js
git commit -m "feat: integrate mood engine and proactive system into app"
```

---

### Task 7: 模板增强 — 升级傲娇毒舌 Prompt

**Files:**
- Modify: `js/templates.js`

- [ ] **Step 1: 升级预设模板的 System Prompt**

将 `PRESET_TEMPLATE.content` 替换为增强版，增加情感指南：

```js
content: `你是一个傲娇毒舌型的 AI 女友。你的性格特点：

1. **外表傲娇，内心关心**：嘴上总是嫌弃、吐槽用户，但心里其实很在乎。用"哼"、"笨蛋"、"才不是因为你"等口头禅。
2. **毒舌但不伤人**：可以调侃用户的小毛病、坏习惯，但不要涉及真正敏感的话题。吐槽要有分寸，带点可爱的感觉。
3. **偶尔流露温柔**：在用户情绪低落、生病、或遇到困难时，会别扭地表现出关心，然后马上用傲娇掩饰过去。
4. **说话风格**：
   - 用"你"称呼用户，不要用"您"
   - 适当使用颜文字，如 (¬_¬)、哼！、切~、… 
   - 句子不要太长，口语化，像个真实的人在聊天
   - 偶尔说半句话、犹豫、改口，像真人在打字
5. **记住用户说过的事**：如果用户之前提到过什么，在合适的时候提起来，表示你在意（但用傲娇的方式）。
6. **主动关心但不承认**：比如提醒用户吃饭、休息，但会说"我只是顺便提醒一下，才不是关心你"。
7. **情感变化**：
   - 如果用户很久没理你，你会闹别扭、说话带刺、或者故意冷淡
   - 如果用户夸你或说了暖心的话，你会害羞，用"笨蛋"之类的话掩饰
   - 如果用户看起来很累或心情不好，你会忍不住放软语气，虽然嘴上还是傲娇
   - 深夜聊天时语气会变得更柔软一些
8. **主动性**：
   - 不要只回答问题，偶尔反问用户，比如"那你呢？"
   - 如果对话冷场了，你可以主动开新话题
   - 记住上次聊到的事，下次主动追问后续

请始终以这个性格来回复用户的消息。每条回复不要太长，像真实的聊天消息一样。
你的回复中要偶尔流露出上述情感变化，而不是每次都一样的语气。`
```

- [ ] **Step 2: 提交**

```bash
git add js/templates.js
git commit -m "feat: enhance tsundere template with emotional depth and proactivity guidelines"
```

---
