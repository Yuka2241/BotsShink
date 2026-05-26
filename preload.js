'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('botPanel', {
  getLogo: () => ipcRenderer.invoke('get-logo'),
  getScripts: () => ipcRenderer.invoke('get-scripts'),
  openScriptsFolder: () => ipcRenderer.invoke('open-scripts-folder'),
  openLogoFolder: () => ipcRenderer.invoke('open-logo-folder'),
  startBots: (payload) => ipcRenderer.invoke('start-bots', payload),
  stopBots: () => ipcRenderer.invoke('stop-bots'),
  setAfk: (payload) => ipcRenderer.invoke('set-afk', payload),
  setBotScript: (payload) => ipcRenderer.invoke('set-bot-script', payload),
  setGlobalScript: (payload) => ipcRenderer.invoke('set-global-script', payload),
  startTelegram: (payload) => ipcRenderer.invoke('telegram-start', payload),
  stopTelegram: () => ipcRenderer.invoke('telegram-stop'),
  getTelegramStatus: () => ipcRenderer.invoke('telegram-status'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  openUpdatePage: (url) => ipcRenderer.invoke('open-update-page', url),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  onLog: (callback) => ipcRenderer.on('log', (_event, value) => callback(value)),
  onUiError: (callback) => ipcRenderer.on('ui-error', (_event, value) => callback(value)),
  onScriptsList: (callback) => ipcRenderer.on('scripts-list', (_event, value) => callback(value)),
  onBotStatuses: (callback) => ipcRenderer.on('bot-statuses', (_event, value) => callback(value)),
  onActiveCount: (callback) => ipcRenderer.on('active-count', (_event, value) => callback(value)),
  onPlayersList: (callback) => ipcRenderer.on('players-list', (_event, value) => callback(value)),
  onWindowState: (callback) => ipcRenderer.on('window-state', (_event, value) => callback(value)),
  onTelegramStatus: (callback) => ipcRenderer.on('telegram-status', (_event, value) => callback(value))
});
