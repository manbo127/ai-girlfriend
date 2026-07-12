// chat.js — Chat UI rendering and interaction

import { chat as aiChat, extractMemory } from './ai.js';
import { addAutoMemory } from './memory.js';
import { addMessage, getMessages } from './storage.js';
import { updateMood } from './mood.js';
import { savePendingTopic } from './storage.js';

let messageListEl, inputEl, sendBtn, typingEl;
let conversationHistory = []; // [{role, content}] for API — last N messages

export function clearContext() {
  conversationHistory = [];
}

const MAX_CONTEXT_MESSAGES = 40;

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
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(m => ({ role: m.role, content: m.content }));
}

async function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;

  // Debug: show mood stats
  if (text === '12312345') {
    const { getMood, getMoodDescription } = await import('./mood.js');
    const m = getMood();
    const desc = getMoodDescription();
    addSystemMessage(`📊 愉悦:${m.happy} 亲密:${m.closeness} 撒娇:${m.pouty} 担忧:${m.worried}\n${desc}`);
    inputEl.value = '';
    return;
  }

  resetIdleTimer();

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

  inputEl.value = '';

  // Typing...
  showTyping();
  sendBtn.disabled = true;

  try {
    // Trim context before sending
    if (conversationHistory.length > MAX_CONTEXT_MESSAGES) {
      conversationHistory = conversationHistory.slice(-MAX_CONTEXT_MESSAGES);
    }

    // Step 1: Check if user message needs a tool (separate classification call)
    const toolResult = await classifyAndExecute(text, apiKey);
    if (toolResult) {
      conversationHistory.push({
        role: 'user',
        content: `[工具结果：${toolResult.name}]\n${toolResult.result}\n\n请用你的语气告诉他结果，要自然。`
      });
    }

    // Step 2: Get AI response (may include tool result context)
    let message = await aiChat(conversationHistory, apiKey);

    hideTyping();

    const reply = message.content || '';
    const assistantMsg = { id: generateId(), role: 'assistant', content: reply, timestamp: Date.now() };
    renderMessage(assistantMsg);
    await addMessage(assistantMsg);
    conversationHistory.push({ role: 'assistant', content: reply });

    // Trim context
    if (conversationHistory.length > MAX_CONTEXT_MESSAGES) {
      conversationHistory = conversationHistory.slice(-MAX_CONTEXT_MESSAGES);
    }

    // Auto memory extraction — only from user's message
    const userOnly = [{ role: 'user', content: text }];
    extractMemory(userOnly, apiKey).then(fact => {
      if (fact) {
        addAutoMemory(fact).then(() => {
          addSystemMessage(`💡 已记住：${fact}`);
        });
      }
      const topicWords = ['面试', '考试', '出差', '旅行', '要去', '打算', '准备', '计划', '明天', '下次', '周末', '约会', '项目', '答辩', '搬家', '看病'];
      const hasTopic = topicWords.some(w => text.includes(w));
      if (hasTopic) {
        savePendingTopic(text.substring(0, 100));
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

  // Avatar (not for system messages)
  if (msg.role !== 'system') {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = msg.role === 'assistant' ? '🐱' : '😎';
    wrapper.appendChild(avatar);
  }

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.content;

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = formatTime(msg.timestamp);

  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(time);
  wrapper.appendChild(bubbleWrap);
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

export function resetIdleTimer() {
  // Will be wired by proactive.js — just declare the hook
  document.dispatchEvent(new CustomEvent('user-activity'));
}

// --- Tool Classification & Execution ---

async function classifyAndExecute(userText, apiKey) {
  // Quick keyword pre-check to avoid unnecessary API calls
  const toolKeywords = ['打开', '启动', '运行', '搜', '找', '读', '写', '存', '截图', '截屏',
    '列出', '浏览', '看看', '看看.*有', '帮我', '桌面.*什么', '文件.*在哪'];
  const hasKeyword = toolKeywords.some(k => new RegExp(k).test(userText));
  if (!hasKeyword) return null;

  // Ask DeepSeek to classify
  const classifyBody = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `判断用户消息是否需要操作电脑。如果需要，返回JSON；如果不需要，返回"NONE"。

可用工具：open_app(打开软件, 参数name)、search_files(搜索文件, 参数query)、read_file(读文件, 参数path)、write_file(写文件, 参数path+content)、list_dir(列目录, 参数path可选)、screenshot(截图, 无参数)、run_command(执行命令, 参数cmd)

返回格式示例：
{"tool":"open_app","args":{"name":"微信"}}
如果不需要工具，只回复：NONE`
      },
      { role: 'user', content: userText }
    ],
    temperature: 0.1,
    max_tokens: 150,
    stream: false
  };

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(classifyBody)
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || text === 'NONE') return null;

    // Parse JSON from response (may have markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const { tool, args } = JSON.parse(jsonMatch[0]);
    console.log('[DEBUG] Classified tool:', tool, args);

    // Check if already trusted
    const trustedStr = localStorage.getItem('trusted_tools') || '{}';
    const trusted = JSON.parse(trustedStr);

    let allowed = false;
    if (trusted[tool]) {
      allowed = true; // skip dialog for trusted tools
    } else {
      const result = await showConfirmDialog(tool, args);
      allowed = result.allowed;
      if (result.trust) {
        trusted[tool] = true;
        localStorage.setItem('trusted_tools', JSON.stringify(trusted));
      }
    }
    if (!allowed) {
      return { name: tool, result: '用户拒绝了此操作。' };
    }

    // Execute
    const result = await executeToolByName(tool, args);
    return { name: tool, result };

  } catch (e) {
    console.warn('Tool classification failed:', e);
    return null;
  }
}

// --- Tool Confirmation & Execution ---

const TOOL_ICONS = { search_files: '🔍', read_file: '📄', write_file: '✏️', list_dir: '📁', open_app: '🚀', run_command: '⚡', screenshot: '📸' };
const TOOL_NAMES = { search_files: '搜索文件', read_file: '读取文件', write_file: '写入文件', list_dir: '浏览目录', open_app: '打开应用', run_command: '执行命令', screenshot: '截屏' };

function showConfirmDialog(toolName, toolArgs) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    const icon = document.getElementById('confirm-tool-icon');
    const desc = document.getElementById('confirm-tool-desc');
    const btnAllow = document.getElementById('btn-allow');
    const btnDeny = document.getElementById('btn-deny');
    const trustLabel = document.getElementById('confirm-trust-label');
    const trustCheckbox = document.getElementById('confirm-trust');

    icon.textContent = TOOL_ICONS[toolName] || '🔧';
    desc.textContent = `${TOOL_NAMES[toolName] || toolName}：${JSON.stringify(toolArgs)}`;
    trustCheckbox.checked = false;

    // hide trust option for run_command
    if (toolName === 'run_command') {
      trustLabel.classList.add('hidden');
    } else {
      trustLabel.classList.remove('hidden');
    }

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

async function executeToolByName(name, args) {
  // Execute via preload bridge (trust check already done in classifyAndExecute)
  if (!window.electronAPI) return '此功能需要 Electron 桌面应用环境。';

  try {
    const api = window.electronAPI;
    let result;
    switch (name) {
      case 'search_files': result = await api.searchFiles(args.query); break;
      case 'read_file': result = await api.readFile(args.path); break;
      case 'write_file': result = await api.writeFile(args.path, args.content); break;
      case 'list_dir': result = await api.listDir(args.path || ''); break;
      case 'open_app': result = await api.openApp(args.name); break;
      case 'run_command': result = await api.runCommand(args.cmd); break;
      case 'screenshot': result = await api.screenshot(); break;
      default: return `未知工具：${name}`;
    }
    return JSON.stringify(result);
  } catch (err) {
    return `执行失败：${err.message}`;
  }
}

export { loadHistory };
