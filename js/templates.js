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
