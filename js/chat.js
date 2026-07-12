// chat.js — Chat UI rendering and interaction

import { chat as aiChat, extractMemory } from './ai.js';
import { addAutoMemory } from './memory.js';
import { addMessage, getMessages } from './storage.js';

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
