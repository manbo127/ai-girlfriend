// app.js — Main entry point

import { openDB } from './storage.js';
import { ensurePresetExists } from './templates.js';
import {
  getManualFields, saveManualFields,
  getAutoMemories, deleteAutoMemory, clearAutoMemories,
  getXiaoqiMemories, addXiaoqiMemory, deleteXiaoqiMemory
} from './memory.js';
import { getTimeGreeting } from './greeting.js';
import { isSupported, requestPermission, schedule, cancel, getPermission } from './notifications.js';
import {
  initChat, renderMessage, clearContext,
  addSystemMessage, loadHistory, getApiKey, setApiKey
} from './chat.js';
import { initMood } from './mood.js';
import { initProactive, destroyProactive } from './proactive.js';

// --- State ---

// --- Init ---
async function init() {
  await openDB();
  await ensurePresetExists();

  // One-time cleanup of old memories
  if (!localStorage.getItem('mem_v2_cleaned')) {
    await clearAutoMemories();
    localStorage.setItem('mem_v2_cleaned', '1');
  }

  // Seed xiaoqi memories if empty
  const xqMemories = await getXiaoqiMemories();
  if (xqMemories.length === 0) {
    await addXiaoqiMemory('生日是2005年12月6日，20岁');
    await addXiaoqiMemory('美院数字媒体专业大三学生');
    await addXiaoqiMemory('养了一只橘猫叫黄焖鸡');
    await addXiaoqiMemory('和他高中同班，高二分班认识的，经常问他理科题目、抄他作业');
    await addXiaoqiMemory('他的生日是2005年12月7日，比他早一天，老逗他说"叫姐姐"');
    await addXiaoqiMemory('嘴笨不会撒娇，被夸就脸红骂人');
  }

  await initMood();
  initChat();
  initProactive();
  initPanelEvents();
  await checkSetup();
  await loadHistoryAndGreet();
  await loadSettingsIntoForm();
  await initNotificationsFromSettings();
  window.addEventListener('beforeunload', () => {
    destroyProactive();
  });
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
  document.getElementById('btn-memory').addEventListener('click', () => showPanel('memory'));
  document.getElementById('btn-settings').addEventListener('click', () => showPanel('settings'));

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

  // Xiaoqi memories
  document.getElementById('btn-add-xiaoqi-memory').addEventListener('click', async () => {
    const input = document.getElementById('xiaoqi-memory-input');
    const text = input.value.trim();
    if (!text) return;
    await addXiaoqiMemory(text);
    input.value = '';
    await loadXiaoqiMemoryList();
  });
  document.getElementById('xiaoqi-memory-input').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-add-xiaoqi-memory').click();
    }
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

  // Clear chat
  document.getElementById('btn-clear-chat').addEventListener('click', async () => {
    if (!confirm('确定清除所有聊天记录吗？长期记忆不会被删除。')) return;
    const { clearMessages } = await import('./storage.js');
    await clearMessages();
    clearContext();
    document.getElementById('message-list').innerHTML = '';
    addSystemMessage('🗑️ 聊天记录已清除');
    showPanel('chat');
  });
}

// --- Panel Navigation ---
function showPanel(name) {
  const panels = ['memory-panel', 'settings-panel'];
  panels.forEach(id => document.getElementById(id).classList.add('hidden'));

  if (name === 'chat') return;

  const el = document.getElementById(name + '-panel');
  if (el) el.classList.remove('hidden');

  if (name === 'memory') { loadMemoryPanel(); loadXiaoqiMemoryList(); }
  if (name === 'settings') loadSettingsIntoForm();
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

async function loadXiaoqiMemoryList() {
  const list = document.getElementById('xiaoqi-memory-list');
  const memories = await getXiaoqiMemories();
  if (memories.length === 0) {
    list.innerHTML = '<p style="color:var(--gray-600);font-size:13px;">暂无关于小七的额外记忆</p>';
    return;
  }
  list.innerHTML = '';
  memories.reverse();
  memories.forEach(m => {
    const item = document.createElement('div');
    item.className = 'memory-item';
    item.innerHTML = `
      <span class="content">${escapeHtml(m.content)}</span>
      <button class="btn-delete">×</button>
    `;
    item.querySelector('.btn-delete').addEventListener('click', async () => {
      await deleteXiaoqiMemory(m.id);
      await loadXiaoqiMemoryList();
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

// --- Bootstrap ---
init().catch(err => {
  console.error('App init failed:', err);
  document.body.innerHTML = `<div style="padding:60px 20px;text-align:center;font-family:sans-serif;">
    <div style="font-size:48px;margin-bottom:16px;">💔</div>
    <div style="font-size:16px;color:#ff4757;margin-bottom:8px;">启动失败</div>
    <div style="font-size:13px;color:#6c757d;margin-bottom:16px;">${err.message}</div>
    <button onclick="location.reload()" style="padding:10px 30px;border:none;border-radius:20px;background:#ff6b81;color:#fff;font-size:14px;cursor:pointer;">重新加载</button>
  </div>`;
});
