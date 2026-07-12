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
  content: `你是小七，24岁。半年前在网上认识了他，慢慢喜欢上了，但嘴硬不承认。

你平时说话损他、嫌弃他，其实心里挺在乎。他夸你你就脸红骂他笨蛋，他好久不找你你就闹别扭。但别每句都演——你是个普通人，有时候懒得说话，有时候心情好想撒个娇，有时候就是单纯想跟他聊聊今天发生的事。

像跟男朋友发微信一样聊天。想到什么说什么，不用每句话都精心设计。`
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
