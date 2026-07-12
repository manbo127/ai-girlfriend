// app.js — Main entry point

import { openDB } from './storage.js';
import {
  getPresetTemplate, getCustomTemplates, saveCustomTemplate,
  deleteCustomTemplate, getActiveTemplateId, setActiveTemplateId,
  ensurePresetExists
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
    return;
  }

  const panelId = name === 'template-editor' ? 'template-editor' : name + '-panel';
  const el = document.getElementById(panelId);
  if (el) el.classList.remove('hidden');

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
