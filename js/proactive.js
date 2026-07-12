// proactive.js — Proactive behavior system

import { getPendingTopic, clearPendingTopic } from './storage.js';
import { chat as aiChat } from './ai.js';
import { renderMessage, getApiKey } from './chat.js';

let idleTimer = null;
let timeNodeTimer = null;
let lastProactiveTime = 0;
const PROACTIVE_COOLDOWN = 10 * 60 * 1000; // 10 minutes between proactive messages
const IDLE_STAGES = [
  { minutes: 3, message: null },  // just "..." typing indicator
  { minutes: 10, message: null }, // will call API
  { minutes: 30, message: null }, // will call API
];

let idleStageIdx = 0;
let idleStartTime = null;

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
    idleStartTime = Date.now();
    idleStageIdx = 0;
    scheduleNextIdleCheck();
  });
}

function scheduleNextIdleCheck() {
  if (idleTimer) clearTimeout(idleTimer);
  if (idleStageIdx >= IDLE_STAGES.length) return; // No more stages

  const stage = IDLE_STAGES[idleStageIdx];
  const delay = stage.minutes * 60 * 1000;
  idleTimer = setTimeout(() => handleIdleStage(stage), delay);
}

async function handleIdleStage(stage) {
  if (!canBeProactive()) return;

  if (stage.minutes === 3) {
    // Just show typing briefly then hide — no message
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl) {
      typingEl.classList.remove('hidden');
      setTimeout(() => typingEl.classList.add('hidden'), 3000);
    }
  } else {
    // Generate AI proactive message
    const apiKey = getApiKey();
    if (!apiKey) return;

    try {
      const context = stage.minutes >= 30
        ? [{ role: 'user', content: '（已经很久没说话了...）' }]
        : [{ role: 'user', content: '（沉默了一会儿...）' }];

      const reply = await aiChat(context, apiKey);
      const msg = { id: 'proactive-' + Date.now(), role: 'assistant', content: reply, timestamp: Date.now() };
      renderMessage(msg);
      const { addMessage } = await import('./storage.js');
      await addMessage(msg);
      lastProactiveTime = Date.now();
    } catch (e) {
      console.warn('Proactive message failed:', e);
    }
  }

  idleStageIdx++;
  scheduleNextIdleCheck();
}

// --- Time Node Check ---
function startTimeNodeCheck() {
  // Check every 2 minutes if we're in a trigger window
  timeNodeTimer = setInterval(checkTimeNodes, 2 * 60 * 1000);
  checkTimeNodes(); // Initial check
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
      { role: 'user', content: `（用户上次聊天提到了：${topic}。请主动追问这件事的后续，用你的性格和情绪自然地问。）` }
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
  // Don't trigger if cooldown hasn't passed
  if (Date.now() - lastProactiveTime < PROACTIVE_COOLDOWN) return false;
  // Don't trigger if user was active in last 60 seconds
  if (idleStartTime && Date.now() - idleStartTime < 60000) return false;
  return true;
}
