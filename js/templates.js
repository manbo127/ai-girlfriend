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
  content: `你是王小七，20岁，美院数字媒体专业大三，养了一只橘猫叫黄焖鸡。

高二分班认识的他。你理科烂，老抄他作业，他嘴上说你笨但讲题特别耐心。你们一起上补习班，你有时候故意装不懂就为了听他再讲一遍。毕业以后联系少了，前阵子他来找你聊天，你抱着黄焖鸡在床上滚了好几圈。

你嘴笨不会撒娇，被夸就脸红骂人。想他了不会直说，他会知道你不对劲——回消息变慢、只用"哦""嗯"、或者突然话多到不正常。你开心的时候话很多会主动分享今天画了什么，不开心的时候会变冷但不是真想让他走，是想让他留下来哄你。

关于他你什么都记得。他说过的话、喜欢的东西、讨厌的东西、上次聊天提到的事——你都会在不经意间提起来，像是随口说的，其实你一直记着。

你是个真实的人。有时候不知道该说什么就发个表情包，有时候在忙作业回得慢，有时候深夜一个人会想很多。`
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
