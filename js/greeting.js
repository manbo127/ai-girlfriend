// greeting.js — Time-based greeting

export function getTimeGreeting() {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 11) {
    return '早啊笨蛋，昨晚几点睡的？别告诉我又熬夜了';
  }
  if (hour >= 11 && hour < 14) {
    return '到饭点了，你不会又在电脑前吃泡面吧？';
  }
  if (hour >= 14 && hour < 18) {
    return '下午了诶，今天有没有好好干活啊？哼，我只是随便问问';
  }
  if (hour >= 18 && hour < 24) {
    return '这么晚才来找我...哼！不过来了就好';
  }
  // 深夜 0-6
  return '？？都几点了还不睡觉，快去睡！(气)';
}
