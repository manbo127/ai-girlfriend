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
