// notifications.js — Browser notification wrapper

let timerId = null;

export function isSupported() {
  return 'Notification' in window;
}

export function getPermission() {
  if (!isSupported()) return 'denied';
  return Notification.permission;
}

export async function requestPermission() {
  if (!isSupported()) return 'denied';
  return await Notification.requestPermission();
}

export function send(title, body) {
  if (!isSupported() || Notification.permission !== 'granted') return;
  new Notification(title, {
    body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">&#x1F338;</text></svg>',
    tag: 'ai-girlfriend'
  });
}

export function schedule(hour, minute) {
  cancel();
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  timerId = setTimeout(() => {
    send('💬 该休息了', '你的AI女友在等你哦~');
    // Re-schedule for next day
    schedule(hour, minute);
  }, delay);
}

export function cancel() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}
