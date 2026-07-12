// storage.js — IndexedDB wrapper

const DB_NAME = 'ai-girlfriend';
const DB_VERSION = 2;
const MAX_AUTO_MEMORIES = 50;

let db = null;

export function getDB() { return db; }

function upgradeDB(db) {
  if (!db.objectStoreNames.contains('messages')) {
    const store = db.createObjectStore('messages', { keyPath: 'id' });
    store.createIndex('timestamp', 'timestamp', { unique: false });
  }
  if (!db.objectStoreNames.contains('manualMemory')) {
    db.createObjectStore('manualMemory', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('autoMemories')) {
    const store = db.createObjectStore('autoMemories', { keyPath: 'id' });
    store.createIndex('timestamp', 'timestamp', { unique: false });
  }
  if (!db.objectStoreNames.contains('templates')) {
    db.createObjectStore('templates', { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('mood')) {
    db.createObjectStore('mood', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('pendingTopic')) {
    db.createObjectStore('pendingTopic', { keyPath: 'key' });
  }
}

export function openDB() {
  return new Promise((resolve, reject) => {
    let retried = false;
    function tryOpen() {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => upgradeDB(event.target.result);
      request.onsuccess = (event) => { db = event.target.result; resolve(db); };
      request.onerror = (event) => {
        if (retried) return reject(event.target.error);
        retried = true;
        console.warn('IndexedDB open failed, resetting...', event.target.error);
        indexedDB.deleteDatabase(DB_NAME);
        tryOpen();
      };
    }
    tryOpen();
  });
}

// --- Messages ---
export function addMessage(message) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    tx.objectStore('messages').add(message);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getMessages(limit = 200) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const index = tx.objectStore('messages').index('timestamp');
    const request = index.openCursor(null, 'prev');
    const messages = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && messages.length < limit) {
        messages.unshift(cursor.value);
        cursor.continue();
      } else {
        resolve(messages);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// --- Manual Memory ---
const SINGLETON_KEY = 'current';

export function saveManualMemory(data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manualMemory', 'readwrite');
    tx.objectStore('manualMemory').put({ key: SINGLETON_KEY, ...data });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getManualMemory() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manualMemory', 'readonly');
    const request = tx.objectStore('manualMemory').get(SINGLETON_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { key, ...data } = result;
        resolve(data);
      } else {
        resolve({ name: '', birthday: '', personality: '', hobbies: '', dislikes: '', other: '' });
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// --- Auto Memories ---
export async function addAutoMemory(memory) {
  const all = await getAutoMemories();
  if (all.length >= MAX_AUTO_MEMORIES) {
    await deleteAutoMemory(all[0].id);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('autoMemories', 'readwrite');
    tx.objectStore('autoMemories').add(memory);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getAutoMemories() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('autoMemories', 'readonly');
    const request = tx.objectStore('autoMemories').index('timestamp').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export function deleteAutoMemory(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('autoMemories', 'readwrite');
    tx.objectStore('autoMemories').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function clearAutoMemories() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('autoMemories', 'readwrite');
    tx.objectStore('autoMemories').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Templates ---
export function saveTemplate(template) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    tx.objectStore('templates').put(template);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getTemplates() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readonly');
    const request = tx.objectStore('templates').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export function deleteTemplate(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', 'readwrite');
    tx.objectStore('templates').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Settings ---
export function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: SINGLETON_KEY, ...settings });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getSettings() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const request = tx.objectStore('settings').get(SINGLETON_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { key, ...data } = result;
        resolve(data);
      } else {
        resolve({ activeTemplateId: 'preset-tsundere', notificationsEnabled: false, notificationTime: '21:00' });
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// --- Mood ---
const MOOD_KEY = 'current';

export function saveMood(mood) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mood', 'readwrite');
    tx.objectStore('mood').put({ key: MOOD_KEY, ...mood });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getMood() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mood', 'readonly');
    const request = tx.objectStore('mood').get(MOOD_KEY);
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { key, ...data } = result;
        resolve(data);
      } else {
        resolve({ happy: 50, closeness: 30, pouty: 20, worried: 10 });
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// --- Pending Topic ---
const TOPIC_KEY = 'current';

export function savePendingTopic(topic) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingTopic', 'readwrite');
    tx.objectStore('pendingTopic').put({ key: TOPIC_KEY, topic, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getPendingTopic() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingTopic', 'readonly');
    const request = tx.objectStore('pendingTopic').get(TOPIC_KEY);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.topic : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export function clearPendingTopic() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingTopic', 'readwrite');
    tx.objectStore('pendingTopic').delete(TOPIC_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
