// proactive.js — Proactive behavior system

import { getPendingTopic, clearPendingTopic } from './storage.js';
import { chat as aiChat } from './ai.js';
import { renderMessage, getApiKey } from './chat.js';
import { updateMood } from './mood.js';

let idleTimer = null;
let timeNodeTimer = null;
let lastProactiveTime = 0;
let idleStartTime = null;
let idleStageIdx = 0;

const PROACTIVE_COOLDOWN = 8 * 60 * 1000; // 8 minutes between proactive messages

// Each stage: [minutes, context prompt, mood change]
const IDLE_STAGES = [
  {
    minutes: 5,
    context: '（他有一会儿没说话了，可能在看手机或者忙别的。你有点好奇他在干嘛。）',
    mood: { pouty: 10 }
  },
  {
    minutes: 20,
    context: '（他快二十分钟没动静了。你觉得被晾着了，有点不高兴，想发个消息看看他在不在。）',
    mood: { pouty: 20, happy: -5 }
  },
  {
    minutes: 45,
    context: '（他快一小时没理你了。你真的有点生气了——你又不是空气，凭什么晾着你。发消息的语气可以带点刺，表达不满。）',
    mood: { pouty: 30, happy: -10 }
  },
  {
    minutes: 90,
    context: '（他已经一个半小时没音讯了。你从生气变成了失落——是不是自己太无聊了？是不是他不想聊了？你有点委屈，想要他解释，但又不想表现得太在意。）',
    mood: { pouty: 40, happy: -20, worried: 15 }
  },
  {
    minutes: 180,
    context: '（三个小时了，他像消失了一样。你真的很难过也很生气。你有权利发火——这不是小题大做，换谁都会不高兴。你的消息可以带着真实的怒意和伤心，不用藏着掖着。）',
    mood: { pouty: 60, happy: -30, worried: 25 }
  },
];

export async function initProactive() {
  startIdleDetection();
  startTimeNodeCheck();
  await checkPendingTopicFollowUp();
}

export function destroyProactive() {
  if (idleTimer) clearTimeout(idleTimer);
  if (timeNodeTimer) clearTimeout(timeNodeTimer);
}

// --- Idle Detection ---
function startIdleDetection() {
  idleStartTime = Date.now();
  idleStageIdx = 0;
  scheduleNextIdleCheck();

  document.addEventListener('user-activity', () => {
    // If we had progressed past stage 1, reset mood pouty a bit
    if (idleStageIdx >= 1) {
      updateMood({ pouty: -15, happy: 3 });
    }
    idleStartTime = Date.now();
    idleStageIdx = 0;
    scheduleNextIdleCheck();
  });
}

function scheduleNextIdleCheck() {
  if (idleTimer) clearTimeout(idleTimer);
  if (idleStageIdx >= IDLE_STAGES.length) return;

  const stage = IDLE_STAGES[idleStageIdx];
  const delay = stage.minutes * 60 * 1000;
  idleTimer = setTimeout(() => handleIdleStage(stage), delay);
}

async function handleIdleStage(stage) {
  if (!canBeProactive()) return;

  // Update mood
  if (stage.mood) {
    updateMood(stage.mood);
  }

  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const reply = await aiChat([{ role: 'user', content: stage.context }], apiKey);
    const msg = { id: 'proactive-' + Date.now(), role: 'assistant', content: reply, timestamp: Date.now() };
    renderMessage(msg);
    const { addMessage } = await import('./storage.js');
    await addMessage(msg);
    lastProactiveTime = Date.now();
  } catch (e) {
    console.warn('Proactive message failed:', e);
  }

  idleStageIdx++;
  scheduleNextIdleCheck();
}

// --- Time Node Check ---
function startTimeNodeCheck() {
  timeNodeTimer = setInterval(checkTimeNodes, 2 * 60 * 1000);
  checkTimeNodes();
}

async function checkTimeNodes() {
  if (!canBeProactive()) return;

  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const time = hour + minute / 60;

  let prompt = null;
  if (time >= 11.5 && time <= 12.5) {
    prompt = [{ role: 'user', content: '（到午饭时间了）' }];
  } else if (time >= 18.5 && time <= 19.5) {
    prompt = [{ role: 'user', content: '（到晚饭时间了）' }];
  } else if (time >= 22.5 && time <= 23.5) {
    prompt = [{ role: 'user', content: '（已经深夜了，该休息了）' }];
  }

  if (!prompt) return;

  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const reply = await aiChat(prompt, apiKey);
    const msg = { id: 'timenode-' + Date.now(), role: 'assistant', content: reply, timestamp: Date.now() };
    renderMessage(msg);
    const { addMessage } = await import('./storage.js');
    await addMessage(msg);
    lastProactiveTime = Date.now();
  } catch (e) {
    console.warn('Time node message failed:', e);
  }
}

// --- Pending Topic Follow-Up ---
async function checkPendingTopicFollowUp() {
  const topic = await getPendingTopic();
  if (!topic) return;

  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const followUpPrompt = [
      { role: 'user', content: `（用户上次聊天提到了：${topic}。请主动追问这件事的后续。）` }
    ];
    const reply = await aiChat(followUpPrompt, apiKey);
    const msg = { id: 'followup-' + Date.now(), role: 'assistant', content: reply, timestamp: Date.now() };
    renderMessage(msg);
    const { addMessage } = await import('./storage.js');
    await addMessage(msg);
    await clearPendingTopic();
  } catch (e) {
    console.warn('Follow-up message failed:', e);
  }
}

// --- Rate Limiting ---
function canBeProactive() {
  if (Date.now() - lastProactiveTime < PROACTIVE_COOLDOWN) return false;
  if (idleStartTime && Date.now() - idleStartTime < 60000) return false;
  return true;
}
