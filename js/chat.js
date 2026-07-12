// chat.js — Chat UI rendering and interaction

import { chat as aiChat, extractMemory } from './ai.js';
import { addAutoMemory } from './memory.js';
import { addMessage, getMessages } from './storage.js';
import { updateMood } from './mood.js';
import { savePendingTopic } from './storage.js';

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
    let message = await aiChat(conversationHistory, apiKey);
    console.log('[DEBUG] AI reply:', message.content?.substring(0, 200));

    // Parse <TOOL>...</TOOL> <ARGS>...</ARGS> tags — max 3 rounds
    let toolRounds = 0;
    while (toolRounds < 3) {
      const toolMatch = message.content?.match(/<TOOL>(\w+)<\/TOOL>/);
      const argsMatch = message.content?.match(/<ARGS>({[\s\S]*?})<\/ARGS>/);
      if (!toolMatch) break;

      toolRounds++;
      const toolName = toolMatch[1];
      const toolArgs = argsMatch ? argsMatch[1] : '{}';
      console.log('[DEBUG] Tool call:', toolName, toolArgs);

      // Add assistant message to conversation
      conversationHistory.push({ role: 'assistant', content: message.content });

      addSystemMessage(`🔧 ${toolName}...`);
      const result = await executeToolByName(toolName, toolArgs);
      conversationHistory.push({
        role: 'user',
        content: `[工具结果：${toolName}]\n${result}\n\n请用你的语气告诉他结果。`
      });

      message = await aiChat(conversationHistory, apiKey);
    }

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

export function resetIdleTimer() {
  // Will be wired by proactive.js — just declare the hook
  document.dispatchEvent(new CustomEvent('user-activity'));
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

async function executeToolByName(name, argsJson) {
  const parsedArgs = JSON.parse(argsJson);

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
        const confirm = await showConfirmDialog('run_command', parsedArgs);
        if (!confirm.allowed) return '用户拒绝了执行命令。';
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

export { loadHistory };
