// mood.js — Emotional state machine

import { saveMood, getMood } from './storage.js';

let mood = { happy: 50, closeness: 30, pouty: 20, worried: 10 };
let decayTimer = null;

export { getMood };

export function getMood() {
  return { ...mood };
}

export async function initMood() {
  const saved = await getMood();
  mood = saved;
  startDecayTimer();
}

export async function updateMood(changes) {
  // Apply deltas with [0, 100] clamping
  for (const key of Object.keys(changes)) {
    if (key in mood) {
      mood[key] = Math.max(0, Math.min(100, mood[key] + changes[key]));
    }
  }
  await saveMood(mood);
}

async function applyTimeDecay() {
  // Hourly decay: happy -> baseline, pouty rises, worried -> baseline
  const changes = {
    happy: mood.happy > 50 ? -1 : 1,
    pouty: Math.min(100, mood.pouty + 2),
    worried: mood.worried > 10 ? -1 : 0
  };
  await updateMood(changes);
}

function startDecayTimer() {
  if (decayTimer) clearInterval(decayTimer);
  decayTimer = setInterval(applyTimeDecay, 60 * 60 * 1000); // every hour
}

export function stopDecayTimer() {
  if (decayTimer) {
    clearInterval(decayTimer);
    decayTimer = null;
  }
}

export function getMoodDescription() {
  const lines = [];

  if (mood.happy > 70) {
    lines.push('你现在心情很好，语气轻快活泼，愿意和他多聊几句。');
  } else if (mood.happy < 30) {
    lines.push('你现在心情不太好，语气会比平时更冷淡或更尖锐。');
  }

  if (mood.pouty > 60) {
    lines.push('你现在有点闹别扭，觉得他不够重视你。嘴上会抱怨、撒娇、故意不理他。');
  } else if (mood.pouty > 30) {
    lines.push('你有一点想撒娇，语气比平时更黏人一点。');
  }

  if (mood.worried > 50) {
    lines.push('你现在有些担心他，忍不住想唠叨他几句，催他吃饭/休息。');
  }

  if (mood.closeness > 70) {
    lines.push('你已经很依赖他了，语气中会不自觉地流露温柔，偶尔会说出心里话。');
  } else if (mood.closeness < 20) {
    lines.push('你和他还不太熟，保持一点距离感，傲娇成分更多。');
  }

  if (lines.length === 0) {
    lines.push('你现在的情绪比较平稳，像平时一样和他聊天。');
  }

  return '## 当前情绪状态\n' + lines.join('\n');
}
