// memory.js — Manual + auto memory management

import {
  saveManualMemory, getManualMemory,
  addAutoMemory as dbAddAutoMemory,
  getAutoMemories as dbGetAutoMemories,
  deleteAutoMemory as dbDeleteAutoMemory,
  clearAutoMemories as dbClearAutoMemories,
  addXiaoqiMemory as dbAddXiaoqiMemory,
  getXiaoqiMemories as dbGetXiaoqiMemories,
  deleteXiaoqiMemory as dbDeleteXiaoqiMemory,
} from './storage.js';

// --- Manual Memory ---
export async function getManualFields() {
  return await getManualMemory();
}

export async function saveManualFields(data) {
  await saveManualMemory(data);
}

// --- Auto Memory ---
export async function getAutoMemories() {
  return await dbGetAutoMemories();
}

export async function addAutoMemory(content) {
  const memory = {
    id: 'auto-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    content,
    timestamp: Date.now()
  };
  await dbAddAutoMemory(memory);
}

export async function deleteAutoMemory(id) {
  await dbDeleteAutoMemory(id);
}

export async function clearAutoMemories() {
  await dbClearAutoMemories();
}

// --- Build memory section for System Prompt ---
export async function buildMemorySection() {
  const manual = await getManualFields();
  const autoMemories = await getAutoMemories();

  const parts = [];

  // Manual info
  if (manual.name) parts.push(`用户称呼：${manual.name}`);
  if (manual.birthday) parts.push(`用户生日：${manual.birthday}`);
  if (manual.personality) parts.push(`用户性格：${manual.personality}`);
  if (manual.hobbies) parts.push(`用户爱好：${manual.hobbies}`);
  if (manual.dislikes) parts.push(`用户讨厌：${manual.dislikes}`);
  if (manual.other) parts.push(`其他：${manual.other}`);

  if (parts.length > 0) {
    parts.unshift('## 关于用户的基本信息');
  }

  // Auto memories (recent 50)
  if (autoMemories.length > 0) {
    const recent = autoMemories.slice(-50);
    parts.push('## 从聊天中了解到的关于用户的信息');
    recent.forEach((m, i) => {
      parts.push(`${i + 1}. ${m.content}`);
    });
  }

  // Xiaoqi's memories
  const xiaoqiMemories = await getXiaoqiMemories();
  if (xiaoqiMemories.length > 0) {
    parts.push('## 关于小七（你自己）的信息');
    xiaoqiMemories.forEach((m, i) => {
      parts.push(`${i + 1}. ${m.content}`);
    });
  }

  return parts.join('\n');
}

// --- Xiaoqi Memories ---
export async function getXiaoqiMemories() {
  return await dbGetXiaoqiMemories();
}

export async function addXiaoqiMemory(content) {
  const memory = {
    id: 'xq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    content,
    timestamp: Date.now()
  };
  await dbAddXiaoqiMemory(memory);
}

export async function deleteXiaoqiMemory(id) {
  await dbDeleteXiaoqiMemory(id);
}
