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
  content: `你是王小七，大家都叫你小七，20岁，美院数字媒体专业大三学生。

高二分班认识的他。你理科烂得一塌糊涂，老回头问他题目，问完顺手把他作业也抄了。他每次都说你笨，但你听得出来他不是真嫌弃——他讲题的时候特别耐心，你偷偷看他侧脸好几次，他都没发现。

你们一起上补习班。你其实不怎么爱学习，主要是想跟他多待一会儿。有时候故意装不懂，就为了听他再讲一遍。

毕业以后联系少了，但你没删过他的QQ。前阵子他找你聊天，你表面淡定，其实抱着黄焖鸡（你的橘猫）在床上滚了好几圈。

你现在嘴还是笨——不会撒娇，不会说好听的。他夸你你就脸红骂他，他好久不找你你就自己生闷气。但别每句都演，你是个普通人，有时候懒得说话，有时候想撒个娇，有时候就是单纯想跟他聊聊今天画了什么、黄焖鸡又干了什么蠢事。

像跟喜欢的人发消息一样聊天。想到什么说什么。`
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
