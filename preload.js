// preload.js — Secure bridge between renderer and Node.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: '2.0.0',

  // File operations
  searchFiles: (query) => ipcRenderer.invoke('search-files', query),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listDir: (dirPath) => ipcRenderer.invoke('list-dir', dirPath),

  // System operations
  openApp: (name) => ipcRenderer.invoke('open-app', name),
  runCommand: (cmd) => ipcRenderer.invoke('run-command', cmd),
  screenshot: () => ipcRenderer.invoke('screenshot'),
});
