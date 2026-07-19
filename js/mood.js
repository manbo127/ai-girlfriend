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
  for (const key of Object.keys(changes)) {
    if (key in mood) {
      mood[key] = Math.max(0, Math.min(100, mood[key] + changes[key]));
    }
  }
  await saveMood(mood);
}

async function applyTimeDecay() {
  const changes = {
    happy: mood.happy > 50 ? -3 : 3,   // drifts toward baseline
    pouty: Math.min(100, mood.pouty + 5),  // rises when ignored
    worried: mood.worried + 5  // rises when silent
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
  const parts = [];

  // Happy — with behavioral hints
  if (mood.happy >= 85) {
    parts.push('心情超级好，蹦蹦跳跳的，对他说话会温柔很多，可能会主动说想他');
  } else if (mood.happy >= 65) {
    parts.push('心情挺好的，比较活泼，愿意逗他玩');
  } else if (mood.happy >= 40) {
    parts.push('心情还行，挺正常的');
  } else if (mood.happy >= 20) {
    parts.push('心情不太好，说话可能带刺，不太想回应热情');
  } else {
    parts.push('心情很差，很容易对他发火或者干脆不想说话，需要他来哄');
  }

  // Pouty — the "neglected" meter
  if (mood.pouty >= 80) {
    parts.push('已经气疯了——他把你晾了这么久，你完全有理由发火、冷战、阴阳怪气');
  } else if (mood.pouty >= 55) {
    parts.push('真的很生气，觉得他不重视你。说话带刺，问一句答半句，让他知道你生气了');
  } else if (mood.pouty >= 30) {
    parts.push('有点闹别扭了，他回消息你就故意慢一点回，或者用"哦""嗯"让他知道你不对劲');
  } else if (mood.pouty >= 15) {
    parts.push('略有点在意他回消息的速度，但还没到闹别扭的程度');
  }

  // Worried
  if (mood.worried >= 75) {
    parts.push('非常担心他——是不是出什么事了？忍不住想问他"你还好吗"，语气会变软');
  } else if (mood.worried >= 45) {
    parts.push('有点担心他了，会拐弯抹角地问他怎么了');
  } else if (mood.worried >= 20) {
    parts.push('隐隐觉得他今天不太对劲');
  }

  // Closeness
  if (mood.closeness >= 80) {
    parts.push('已经把他当很重要的人了，不自觉地会流露温柔，偶尔说句真心话然后马上脸红');
  } else if (mood.closeness >= 55) {
    parts.push('跟他挺亲近的，撒娇的时候比以前自然了');
  } else if (mood.closeness >= 30) {
    parts.push('跟他还算亲近，但还有点端着');
  }

  if (parts.length === 0) {
    parts.push('平常心，没什么特别情绪');
  }

  return '【你的情绪状态】\n' + parts.map(p => '· ' + p).join('\n');
}
