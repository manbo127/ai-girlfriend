// preload.js — Secure bridge between renderer and Node.js
// Currently empty; v2.0 computer-control APIs will be exposed here

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // v2.0: file operations, app control, screenshot, etc.
  platform: process.platform,
  version: '1.0.0'
});
