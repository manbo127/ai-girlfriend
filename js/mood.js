// mood.js — Emotional state machine

import { saveMood, getMood as getSavedMood } from './storage.js';

let mood = { happy: 50, closeness: 30, pouty: 20, worried: 10 };
let decayTimer = null;

export function getMood() {
  return { ...mood };
}

export async function initMood() {
  const saved = await getSavedMood();
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
  const feelings = [];

  if (mood.happy > 70) feelings.push('心情很好');
  else if (mood.happy < 30) feelings.push('心情不太好，有点烦');

  if (mood.pouty > 60) feelings.push('有点闹别扭，想让他哄你');
  else if (mood.pouty > 30) feelings.push('想跟他撒个娇');

  if (mood.worried > 50) feelings.push('有点担心他');
  if (mood.closeness > 70) feelings.push('跟他很亲近，心里踏实');

  if (feelings.length === 0) {
    feelings.push('没什么特别的，平常心');
  }

  return '你现在：' + feelings.join('；') + '。';
}
