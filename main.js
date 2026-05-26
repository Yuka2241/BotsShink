'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const Module = require('module');
const https = require('https');
const mineflayer = require('mineflayer');

const SOURCE_ROOT = __dirname;
const RUNTIME_ROOT = app.isPackaged ? path.dirname(process.execPath) : SOURCE_ROOT;
const SCRIPT_DIR = path.join(RUNTIME_ROOT, 'BotSkripts');
const LOGO_DIR = path.join(RUNTIME_ROOT, 'logo');
const BUNDLED_SCRIPT_DIR = app.isPackaged ? path.join(process.resourcesPath, 'BotSkripts') : path.join(SOURCE_ROOT, 'BotSkripts');
const BUNDLED_LOGO_DIR = app.isPackaged ? path.join(process.resourcesPath, 'logo') : path.join(SOURCE_ROOT, 'logo');
const SCRIPT_MARKER = 'Seleckt - BotSkripts';
const MAX_BOTS = 10;
const MIN_DELAY_SECONDS = 5;
const GITHUB_OWNER = 'Yuka2241';
const GITHUB_REPO = 'BotsShink';
const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;


let mainWindow = null;
let scriptWatchTimer = null;
let playerTimer = null;

/**
 * scripts Map:
 * fileName -> { fileName, displayName, fullPath, hasTargetPlayer, valid, error, updatedAt }
 */
const scripts = new Map();

/**
 * bots Map:
 * username -> {
 *   username, bot, status, reason,
 *   afkEnabled, afkTimer, afkYaw,
 *   activeScripts: Map(fileName -> runtime),
 *   desiredScripts: Map(fileName -> options)
 * }
 */
const bots = new Map();

let currentServerLabel = 'сервер не выбран';

const TELEGRAM_FEATURE_LABELS = {
  botNotifications: 'Уведомления о боте',
  chatNotifications: 'Уведомления чата',
  serverOnline: 'Онлайн сервера',
  playersOnline: 'Игроки на сервере'
};

const telegramState = {
  scriptEnabled: false,
  running: false,
  token: '',
  chatId: '',
  offset: 0,
  pollTimer: null,
  lastPlayersText: '',
  lastPlayersAt: 0,
  features: {
    botNotifications: false,
    chatNotifications: false,
    serverOnline: false,
    playersOnline: false
  }
};


function copyFolderIfTargetEmpty(sourceDir, targetDir) {
  try {
    if (!fs.existsSync(sourceDir)) return;
    const existing = fs.existsSync(targetDir) ? fs.readdirSync(targetDir) : [];
    if (existing.length > 0) return;

    fs.mkdirSync(targetDir, { recursive: true });
    for (const item of fs.readdirSync(sourceDir)) {
      const sourcePath = path.join(sourceDir, item);
      const targetPath = path.join(targetDir, item);
      const stat = fs.statSync(sourcePath);
      if (stat.isDirectory()) {
        fs.cpSync(sourcePath, targetPath, { recursive: true });
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  } catch (err) {
    console.warn('Failed to copy default folder:', err.message || err);
  }
}

function ensureFolders() {
  fs.mkdirSync(SCRIPT_DIR, { recursive: true });
  fs.mkdirSync(LOGO_DIR, { recursive: true });
  copyFolderIfTargetEmpty(BUNDLED_SCRIPT_DIR, SCRIPT_DIR);
  copyFolderIfTargetEmpty(BUNDLED_LOGO_DIR, LOGO_DIR);
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#050607',
    title: 'BotsShink',
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(SOURCE_ROOT, 'botsshink_logo.png'),
    webPreferences: {
      preload: path.join(SOURCE_ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const emitWindowState = () => {
    send('window-state', {
      maximized: !!mainWindow && mainWindow.isMaximized()
    });
  };

  mainWindow.loadFile(path.join(SOURCE_ROOT, 'index.html'));
  mainWindow.once('ready-to-show', emitWindowState);
  mainWindow.on('maximize', emitWindowState);
  mainWindow.on('unmaximize', emitWindowState);
  mainWindow.on('enter-full-screen', emitWindowState);
  mainWindow.on('leave-full-screen', emitWindowState);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function send(channel, data) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, data);
}

function stamp() {
  return new Date().toLocaleTimeString('ru-RU', { hour12: false });
}

function log(message) {
  send('log', `[${stamp()}] ${message}`);
}

function uiError(message) {
  send('ui-error', message);
}

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeVersion(value) {
  return String(value || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .replace(/[^0-9.]/g, '');
}

function compareVersions(a, b) {
  const pa = normalizeVersion(a).split('.').map((n) => Number.parseInt(n || '0', 10));
  const pb = normalizeVersion(b).split('.').map((n) => Number.parseInt(n || '0', 10));
  const len = Math.max(pa.length, pb.length, 3);

  for (let i = 0; i < len; i += 1) {
    const na = Number.isFinite(pa[i]) ? pa[i] : 0;
    const nb = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }

  return 0;
}

function httpsJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'BotsShink-Update-Checker',
        'Accept': 'application/vnd.github+json'
      },
      timeout: 15000
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        if (response.statusCode === 404) {
          resolve({ notFound: true, statusCode: response.statusCode });
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub ответил кодом ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error('GitHub вернул некорректный JSON.'));
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Таймаут подключения к GitHub.'));
    });
    request.on('error', reject);
  });
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();
  const latest = await httpsJson(GITHUB_LATEST_RELEASE_API);

  if (latest && latest.notFound) {
    return {
      ok: true,
      hasUpdate: false,
      currentVersion,
      latestVersion: '',
      releaseName: '',
      releaseUrl: GITHUB_RELEASES_URL,
      message: 'На GitHub пока нет Release. Создай первый релиз, и проверка заработает.'
    };
  }

  const tag = latest.tag_name || latest.name || '';
  const latestVersion = normalizeVersion(tag);
  const hasUpdate = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;
  const asset = Array.isArray(latest.assets)
    ? latest.assets.find((item) => /Setup|Web-Setup|Portable/i.test(item.name || '')) || latest.assets[0]
    : null;

  return {
    ok: true,
    hasUpdate,
    currentVersion,
    latestVersion,
    releaseName: latest.name || tag || 'GitHub Release',
    releaseUrl: latest.html_url || GITHUB_RELEASES_URL,
    assetName: asset ? asset.name : '',
    assetUrl: asset ? asset.browser_download_url : '',
    publishedAt: latest.published_at || '',
    message: hasUpdate ? `Доступно обновление ${latestVersion}` : 'Установлена последняя версия.'
  };
}


function telegramStatusPayload() {
  return {
    scriptEnabled: !!telegramState.scriptEnabled,
    running: !!telegramState.running,
    chatId: telegramState.chatId ? 'задан' : '',
    features: { ...telegramState.features }
  };
}

function sendTelegramStatus() {
  send('telegram-status', telegramStatusPayload());
}

function escapeTelegram(text) {
  return String(text ?? '').slice(0, 3500);
}

function telegramApi(method, payload = {}) {
  return new Promise((resolve, reject) => {
    const token = cleanText(telegramState.token);
    if (!token) {
      reject(new Error('Telegram token не указан.'));
      return;
    }

    const body = JSON.stringify(payload);
    const request = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 18000
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (_) {}

        if (response.statusCode < 200 || response.statusCode >= 300 || !parsed || parsed.ok === false) {
          const description = parsed && parsed.description ? parsed.description : `Telegram ответил кодом ${response.statusCode}`;
          reject(new Error(description));
          return;
        }

        resolve(parsed.result);
      });
    });

    request.on('timeout', () => request.destroy(new Error('Таймаут Telegram API.')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function telegramKeyboard() {
  const rows = [];
  for (const [key, label] of Object.entries(TELEGRAM_FEATURE_LABELS)) {
    if (telegramState.features[key]) rows.push([{ text: label }]);
  }
  rows.push([{ text: 'Меню' }]);
  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

function telegramFeatureButtons(featureKey) {
  return {
    inline_keyboard: [[
      { text: 'Вкл', callback_data: `feature:${featureKey}:on` },
      { text: 'Выкл', callback_data: `feature:${featureKey}:off` }
    ]]
  };
}

async function telegramSend(text, replyMarkup = null) {
  if (!telegramState.running || !telegramState.chatId) return;
  const payload = {
    chat_id: telegramState.chatId,
    text: escapeTelegram(text),
    disable_web_page_preview: true
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await telegramApi('sendMessage', payload);
}

function getOnlineBotNames() {
  return [...bots.values()].filter((record) => record.status === 'online').map((record) => record.username);
}

function getPlayersText() {
  const all = new Set();
  for (const record of bots.values()) {
    const bot = record.bot;
    if (!bot || !bot.entities) continue;
    for (const entity of Object.values(bot.entities)) {
      if (entity && entity.type === 'player' && entity.username && entity.username !== record.username) all.add(entity.username);
    }
  }
  const list = [...all].sort((a, b) => a.localeCompare(b));
  return list.length ? list.join(', ') : 'Игроков не видно.';
}

function getServerOnlineText() {
  const online = getOnlineBotNames();
  return [
    'Онлайн сервера',
    `Сервер: ${currentServerLabel}`,
    `Боты онлайн: ${online.length}`,
    `Ники: ${online.length ? online.join(', ') : 'нет'}`
  ].join('\n');
}

async function telegramShowMenu() {
  const enabled = Object.entries(TELEGRAM_FEATURE_LABELS).filter(([key]) => telegramState.features[key]);
  const list = enabled.length ? enabled.map(([, label]) => `• ${label}`).join('\n') : 'В приложении не включена ни одна функция.';
  await telegramSend(`BotsShink Telegram меню\n\nАктивные функции:\n${list}\n\nНажми кнопку функции, потом выбери Вкл или Выкл.`, telegramKeyboard());
}

async function telegramHandleFeatureMessage(featureKey) {
  const label = TELEGRAM_FEATURE_LABELS[featureKey];
  if (!label || !telegramState.features[featureKey]) {
    await telegramShowMenu();
    return;
  }

  let extra = '';
  if (featureKey === 'serverOnline') extra = `\n\n${getServerOnlineText()}`;
  if (featureKey === 'playersOnline') extra = `\n\nИгроки на сервере:\n${getPlayersText()}`;

  await telegramSend(`${label}\nВыбери действие.${extra}`, telegramFeatureButtons(featureKey));
}

async function telegramHandleUpdate(update) {
  if (!update) return;

  if (update.callback_query) {
    const query = update.callback_query;
    const data = String(query.data || '');
    if (query.message && String(query.message.chat.id) !== String(telegramState.chatId)) return;

    const match = data.match(/^feature:([a-zA-Z]+):(on|off)$/);
    if (match) {
      const featureKey = match[1];
      const enabled = match[2] === 'on';
      if (Object.prototype.hasOwnProperty.call(telegramState.features, featureKey)) {
        telegramState.features[featureKey] = enabled;
        sendTelegramStatus();
        await telegramApi('answerCallbackQuery', { callback_query_id: query.id, text: enabled ? 'Включено' : 'Выключено' }).catch(() => {});
        await telegramSend(`${TELEGRAM_FEATURE_LABELS[featureKey]}: ${enabled ? 'включено' : 'выключено'}`, telegramKeyboard());
      }
    }
    return;
  }

  const message = update.message;
  if (!message || !message.chat) return;
  if (String(message.chat.id) !== String(telegramState.chatId)) return;

  const text = cleanText(message.text);
  if (!text || text === '/start' || text === 'Меню') {
    await telegramShowMenu();
    return;
  }

  for (const [key, label] of Object.entries(TELEGRAM_FEATURE_LABELS)) {
    if (text === label) {
      await telegramHandleFeatureMessage(key);
      return;
    }
  }

  await telegramShowMenu();
}

async function telegramPollOnce() {
  if (!telegramState.running) return;
  try {
    const updates = await telegramApi('getUpdates', {
      offset: telegramState.offset,
      timeout: 1,
      allowed_updates: ['message', 'callback_query']
    });

    if (Array.isArray(updates)) {
      for (const update of updates) {
        telegramState.offset = Math.max(telegramState.offset, Number(update.update_id || 0) + 1);
        await telegramHandleUpdate(update);
      }
    }
  } catch (err) {
    log(`Telegram: ошибка: ${err.message || err}`);
  }
}

function startTelegramPolling() {
  if (telegramState.pollTimer) clearInterval(telegramState.pollTimer);
  telegramState.pollTimer = setInterval(() => {
    telegramPollOnce().catch((err) => log(`Telegram: ошибка polling: ${err.message || err}`));
  }, 1800);
}

async function startTelegram(payload = {}) {
  telegramState.token = cleanText(payload.token);
  telegramState.chatId = cleanText(payload.chatId);
  telegramState.features = {
    botNotifications: !!(payload.features && payload.features.botNotifications),
    chatNotifications: !!(payload.features && payload.features.chatNotifications),
    serverOnline: !!(payload.features && payload.features.serverOnline),
    playersOnline: !!(payload.features && payload.features.playersOnline)
  };

  if (!telegramState.scriptEnabled) throw new Error('Сначала включи скрипт “ТГ-приложение” во вкладке Скрипты.');
  if (!telegramState.token) throw new Error('Укажи токен Telegram-бота.');
  if (!telegramState.chatId) throw new Error('Укажи свой Chat ID.');

  const me = await telegramApi('getMe', {});
  telegramState.running = true;
  telegramState.offset = 0;
  telegramState.lastPlayersText = '';
  startTelegramPolling();
  sendTelegramStatus();
  log(`Telegram: запущен бот @${me.username || me.first_name || 'unknown'}.`);
  await telegramSend('BotsShink Telegram запущен. Нажми /start или кнопку Меню.', telegramKeyboard());
  return { ok: true, message: `Telegram запущен: @${me.username || me.first_name || 'unknown'}` };
}

function stopTelegram() {
  if (telegramState.pollTimer) clearInterval(telegramState.pollTimer);
  telegramState.pollTimer = null;
  telegramState.running = false;
  sendTelegramStatus();
  log('Telegram: остановлен.');
  return { ok: true, message: 'Telegram остановлен.' };
}

function telegramNotifyBot(message) {
  if (!telegramState.running || !telegramState.features.botNotifications) return;
  telegramSend(`BotsShink\n${message}`).catch((err) => log(`Telegram: не отправлено уведомление о боте: ${err.message || err}`));
}

function telegramNotifyChat(username, message, botName) {
  if (!telegramState.running || !telegramState.features.chatNotifications) return;
  telegramSend(`Чат Minecraft${botName ? ` (${botName})` : ''}\n${username}: ${message}`).catch((err) => log(`Telegram: не отправлено сообщение чата: ${err.message || err}`));
}

function telegramMaybeNotifyPlayers() {
  if (!telegramState.running || !telegramState.features.playersOnline) return;
  const now = Date.now();
  if (now - telegramState.lastPlayersAt < 15000) return;
  const text = getPlayersText();
  if (text === telegramState.lastPlayersText) return;
  telegramState.lastPlayersText = text;
  telegramState.lastPlayersAt = now;
  telegramSend(`Игроки на сервере:\n${text}`).catch((err) => log(`Telegram: не отправлен список игроков: ${err.message || err}`));
}

function isValidNick(nick) {
  return /^[A-Za-z0-9_]{3,16}$/.test(nick);
}

function normalizeServerConfig(config) {
  const host = cleanText(config.host);
  const port = Number.parseInt(String(config.port || '25565'), 10);
  const version = cleanText(config.version) || false;
  const delaySeconds = Math.max(MIN_DELAY_SECONDS, Number.parseInt(String(config.delaySeconds || '15'), 10) || 15);

  if (!host) throw new Error('IP сервера не указан.');
  if (!Number.isFinite(port) || port < 1 || port > 65535) throw new Error('Порт должен быть числом от 1 до 65535.');

  return { host, port, version, delaySeconds };
}

function statusPayload(record) {
  return {
    username: record.username,
    status: record.status || 'offline',
    reason: record.reason || '',
    afkEnabled: !!record.afkEnabled,
    activeScripts: [...record.activeScripts.keys()]
  };
}

function sendBotStatuses() {
  const items = [...bots.values()].map(statusPayload);
  send('bot-statuses', items);
  const active = items.filter((b) => b.status === 'online').length;
  send('active-count', { active, total: items.length });
}

function setBotStatus(username, status, reason = '') {
  const record = bots.get(username);
  if (!record) return;
  const previousStatus = record.status;
  record.status = status;
  record.reason = reason;
  sendBotStatuses();

  if (previousStatus !== status && ['online', 'offline', 'error', 'kicked'].includes(status)) {
    const label = { online: 'онлайн', offline: 'отключён', error: 'ошибка', kicked: 'кикнут' }[status] || status;
    telegramNotifyBot(`${username}: ${label}${reason ? `\n${reason}` : ''}`);
  }
}

function readScriptSource(fullPath) {
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/);
  const first = (lines[0] || '').trim();
  if (first !== SCRIPT_MARKER) {
    throw new Error(`нет первой строки: ${SCRIPT_MARKER}`);
  }
  return { raw, executable: lines.slice(1).join('\n') };
}

function parseScriptMeta(fileName, fullPath) {
  try {
    const { raw } = readScriptSource(fullPath);
    const lines = raw.split(/\r?\n/).slice(0, 16);
    let displayName = fileName.replace(/\.js$/i, '').replace(/[_-]+/g, ' ');
    let hasTargetPlayer = false;
    let isGlobal = false;
    let isPinned = false;
    let createTab = '';

    for (const line of lines) {
      const nameMatch = line.match(/^\s*\/\/\s*BotSkripts-Name\s*:\s*(.+)\s*$/i);
      if (nameMatch) displayName = nameMatch[1].trim();

      const configMatch = line.match(/^\s*\/\/\s*BotSkripts-Config\s*:\s*(.+)\s*$/i);
      if (configMatch) {
        const parts = configMatch[1].split(',').map((s) => s.trim().toLowerCase());
        hasTargetPlayer = parts.includes('targetplayer') || parts.includes('target-player') || parts.includes('target_player');
      }

      const globalMatch = line.match(/^\s*\/\/\s*BotSkripts-Global\s*:\s*(.+)\s*$/i);
      if (globalMatch) isGlobal = ['true', 'yes', '1', 'on', 'да', 'вкл'].includes(globalMatch[1].trim().toLowerCase());

      const pinnedMatch = line.match(/^\s*\/\/\s*BotSkripts-Pinned\s*:\s*(.+)\s*$/i);
      if (pinnedMatch) isPinned = ['true', 'yes', '1', 'on', 'да', 'вкл'].includes(pinnedMatch[1].trim().toLowerCase());

      const tabMatch = line.match(/^\s*\/\/\s*BotSkripts-CreateTab\s*:\s*(.+)\s*$/i);
      if (tabMatch) createTab = tabMatch[1].trim();
    }

    return {
      fileName,
      displayName,
      fullPath,
      hasTargetPlayer,
      isGlobal,
      isPinned,
      createTab,
      valid: true,
      error: '',
      updatedAt: Date.now()
    };
  } catch (err) {
    return {
      fileName,
      displayName: fileName,
      fullPath,
      hasTargetPlayer: false,
      isGlobal: false,
      isPinned: false,
      createTab: '',
      valid: false,
      error: err.message || String(err),
      updatedAt: Date.now()
    };
  }
}

function loadScriptsFromFolder({ announce = false, reapply = false } = {}) {
  ensureFolders();
  const before = new Map(scripts);
  scripts.clear();

  const files = fs.readdirSync(SCRIPT_DIR).filter((file) => file.toLowerCase().endsWith('.js')).sort((a, b) => a.localeCompare(b));

  for (const fileName of files) {
    const fullPath = path.join(SCRIPT_DIR, fileName);
    const meta = parseScriptMeta(fileName, fullPath);
    scripts.set(fileName, meta);

    if (announce) {
      const prev = before.get(fileName);
      if (!prev || prev.valid !== meta.valid || prev.error !== meta.error || prev.displayName !== meta.displayName) {
        if (meta.valid) log(`Скрипт обновлён: ${meta.displayName}`);
        else log(`Скрипт пропущен: ${fileName}. Ошибка: ${meta.error}`);
      }
    }
  }

  send('scripts-list', [...scripts.values()].map((s) => ({
    fileName: s.fileName,
    displayName: s.displayName,
    hasTargetPlayer: s.hasTargetPlayer,
    isGlobal: !!s.isGlobal,
    isPinned: !!s.isPinned,
    createTab: s.createTab || '',
    valid: s.valid,
    error: s.error,
    updatedAt: s.updatedAt
  })));

  if (reapply) {
    reapplyActiveScriptsAfterReload();
  }
}

function scheduleScriptReload() {
  clearTimeout(scriptWatchTimer);
  scriptWatchTimer = setTimeout(() => {
    loadScriptsFromFolder({ announce: true, reapply: true });
  }, 300);
}

function startScriptWatcher() {
  ensureFolders();
  try {
    fs.watch(SCRIPT_DIR, { persistent: true }, scheduleScriptReload);
    log('Автообновление скриптов включено.');
  } catch (err) {
    log(`Автообновление скриптов не запустилось: ${err.message || err}`);
  }
}

function loadExecutableModule(meta) {
  const { executable } = readScriptSource(meta.fullPath);
  const scriptModule = new Module(meta.fullPath, module.parent);
  scriptModule.filename = meta.fullPath;
  scriptModule.paths = Module._nodeModulePaths(path.dirname(meta.fullPath));
  scriptModule._compile(executable, meta.fullPath);
  return scriptModule.exports;
}

function makeApi(record, fileName, options, runtime) {
  const bot = record.bot;

  const cleanup = (fn) => {
    if (typeof fn === 'function') runtime.cleanups.push(fn);
  };

  return {
    bot,
    username: record.username,
    fileName,
    options: { ...(options || {}) },
    getTargetPlayer: () => cleanText((options || {}).targetPlayer),
    log: (message) => log(`${record.username}: [${fileName}] ${message}`),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    registerCleanup: cleanup,
    setControl: (control, value) => {
      if (bot && bot.setControlState) bot.setControlState(control, !!value);
    },
    jump: async (holdMs = 250) => {
      if (!bot || !bot.setControlState) return;
      bot.setControlState('jump', true);
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      bot.setControlState('jump', false);
    },
    every: (ms, fn) => {
      const id = setInterval(() => {
        try {
          const result = fn();
          if (result && typeof result.catch === 'function') result.catch((err) => log(`${record.username}: [${fileName}] ошибка: ${err.message || err}`));
        } catch (err) {
          log(`${record.username}: [${fileName}] ошибка: ${err.message || err}`);
        }
      }, ms);
      cleanup(() => clearInterval(id));
      return id;
    },
    timeout: (ms, fn) => {
      const id = setTimeout(fn, ms);
      cleanup(() => clearTimeout(id));
      return id;
    },
    onSpawn: (fn) => {
      if (typeof fn !== 'function') return;
      if (bot.entity) {
        setImmediate(() => {
          try {
            const result = fn();
            if (result && typeof result.catch === 'function') result.catch((err) => log(`${record.username}: [${fileName}] ошибка: ${err.message || err}`));
          } catch (err) {
            log(`${record.username}: [${fileName}] ошибка: ${err.message || err}`);
          }
        });
      } else {
        bot.once('spawn', fn);
        cleanup(() => bot.removeListener('spawn', fn));
      }
    },
    onEnd: (fn) => {
      if (typeof fn !== 'function') return;
      bot.once('end', fn);
      cleanup(() => bot.removeListener('end', fn));
    },
    getNearestPlayer: () => getNearestPlayer(bot),
    getPlayerByName: (name) => getPlayerByName(bot, name),
    getTargetEntity: () => {
      const requested = cleanText((options || {}).targetPlayer);
      return requested ? getPlayerByName(bot, requested) : getNearestPlayer(bot);
    },
    stopAllMovement: () => stopAllMovement(bot)
  };
}

function stopAllMovement(bot) {
  if (!bot || !bot.setControlState) return;
  for (const key of ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak']) {
    bot.setControlState(key, false);
  }
}

function stopScript(record, fileName) {
  const runtime = record.activeScripts.get(fileName);
  if (!runtime) return;
  for (const fn of runtime.cleanups.splice(0)) {
    try { fn(); } catch (_) {}
  }
  stopAllMovement(record.bot);
  record.activeScripts.delete(fileName);
  log(`${record.username}: скрипт выключен: ${fileName}`);
  sendBotStatuses();
}

async function applyScript(record, fileName, options = {}) {
  if (!record || !record.bot) return;
  const meta = scripts.get(fileName);

  stopScript(record, fileName);

  if (!meta || !meta.valid) {
    log(`${record.username}: [${fileName}] не найден или неверный формат.`);
    return;
  }

  const runtime = { fileName, options: { ...options }, cleanups: [] };
  record.activeScripts.set(fileName, runtime);

  try {
    const exported = loadExecutableModule(meta);
    if (typeof exported !== 'function') throw new Error('module.exports должен быть функцией');

    const api = makeApi(record, fileName, options, runtime);
    const result = exported(api);
    if (result && typeof result.then === 'function') await result;

    log(`${record.username}: скрипт включён: ${meta.displayName}`);
  } catch (err) {
    record.activeScripts.delete(fileName);
    for (const fn of runtime.cleanups.splice(0)) {
      try { fn(); } catch (_) {}
    }
    log(`${record.username}: [${fileName}] ошибка загрузки: ${err.message || err}`);
  }

  sendBotStatuses();
}

function reapplyActiveScriptsAfterReload() {
  for (const record of bots.values()) {
    if (!record.bot || record.status !== 'online') continue;
    const active = [...record.activeScripts.values()].map((runtime) => ({ fileName: runtime.fileName, options: runtime.options || {} }));
    for (const item of active) {
      applyScript(record, item.fileName, item.options);
    }
  }
}

function getPlayerByName(bot, name) {
  if (!bot || !name) return null;
  const lower = String(name).toLowerCase();
  for (const entity of Object.values(bot.entities || {})) {
    if (!entity || entity.type !== 'player' || !entity.username) continue;
    if (entity.username.toLowerCase() === lower && entity.username !== bot.username) return entity;
  }
  return null;
}

function getNearestPlayer(bot) {
  if (!bot || !bot.entity) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const entity of Object.values(bot.entities || {})) {
    if (!entity || entity.type !== 'player' || !entity.username || entity.username === bot.username) continue;
    if (!entity.position) continue;
    const distance = bot.entity.position.distanceTo(entity.position);
    if (distance < nearestDistance) {
      nearest = entity;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function startAfk(record) {
  if (!record || !record.bot || record.afkTimer) return;
  record.afkYaw = 0;
  record.afkTimer = setInterval(async () => {
    try {
      const bot = record.bot;
      if (!bot || !bot.entity) return;
      record.afkYaw += Math.PI / 5;
      if (bot.look) await bot.look(record.afkYaw, 0, true);
      if (bot.setControlState && bot.entity.onGround) {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 300);
      }
    } catch (_) {}
  }, 8500);
  log(`${record.username}: AFK включен.`);
}

function stopAfk(record) {
  if (!record) return;
  if (record.afkTimer) clearInterval(record.afkTimer);
  record.afkTimer = null;
  if (record.bot && record.bot.setControlState) record.bot.setControlState('jump', false);
  log(`${record.username}: AFK выключен.`);
}

function stopBot(username) {
  const record = bots.get(username);
  if (!record) return;

  for (const fileName of [...record.activeScripts.keys()]) {
    stopScript(record, fileName);
  }
  stopAfk(record);

  if (record.bot) {
    try {
      record.bot.quit('Stopped from panel');
      log(`${username}: отправлена команда выхода.`);
    } catch (err) {
      try { record.bot.end(); } catch (_) {}
    }
  }

  setBotStatus(username, 'offline');
}

async function connectBot(config, botConfig, scriptAssignments) {
  const username = cleanText(botConfig.nick);
  if (!isValidNick(username)) throw new Error(`Ник "${username}" неверный. Нужно 3-16 символов: английские буквы, цифры или _. Точки и пробелы нельзя.`);

  if (bots.has(username) && bots.get(username).status === 'online') {
    log(`${username}: уже онлайн, пропускаю.`);
    return;
  }

  const record = {
    username,
    bot: null,
    status: 'connecting',
    reason: '',
    afkEnabled: !!botConfig.afkEnabled,
    afkTimer: null,
    afkYaw: 0,
    activeScripts: new Map(),
    desiredScripts: new Map(Object.entries(scriptAssignments || {}))
  };
  bots.set(username, record);
  sendBotStatuses();
  log(`${username}: подключение началось...`);

  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username,
    version: config.version || false,
    auth: 'offline',
    checkTimeoutInterval: 60 * 1000
  });

  record.bot = bot;

  bot.once('login', () => {
    log(`${username}: вошёл на сервер.`);
    telegramNotifyBot(`${username}: вошёл на сервер ${currentServerLabel}`);
  });

  bot.on('chat', (chatUsername, message) => {
    if (chatUsername && chatUsername !== username) telegramNotifyChat(chatUsername, message, username);
  });

  bot.once('spawn', async () => {
    setBotStatus(username, 'online');
    log(`${username}: появился в мире.`);
    if (record.afkEnabled) startAfk(record);

    for (const [fileName, options] of record.desiredScripts.entries()) {
      if (options && options.enabled) {
        await applyScript(record, fileName, options);
      }
    }
  });

  bot.on('kicked', (reason) => {
    const text = typeof reason === 'string' ? reason : JSON.stringify(reason);
    record.reason = text;
    setBotStatus(username, 'kicked', text);
    log(`${username}: кикнут. Причина: ${text}`);
  });

  bot.on('error', (err) => {
    const msg = err && err.message ? err.message : String(err);
    if (record.lastError === msg && Date.now() - (record.lastErrorAt || 0) < 1500) return;
    record.lastError = msg;
    record.lastErrorAt = Date.now();
    record.reason = msg;
    setBotStatus(username, 'error', msg);
    log(`${username}: ошибка: ${msg}`);
  });

  bot.once('end', () => {
    for (const fileName of [...record.activeScripts.keys()]) {
      stopScript(record, fileName);
    }
    stopAfk(record);
    record.bot = null;
    if (record.status !== 'kicked' && record.status !== 'error') setBotStatus(username, 'offline');
    log(`${username}: соединение закрыто.`);
  });
}

function sendKnownPlayers() {
  const byBot = {};
  const all = new Set();

  for (const record of bots.values()) {
    const list = [];
    const bot = record.bot;
    if (bot && bot.entities) {
      for (const entity of Object.values(bot.entities)) {
        if (entity && entity.type === 'player' && entity.username && entity.username !== record.username) {
          list.push(entity.username);
          all.add(entity.username);
        }
      }
    }
    byBot[record.username] = [...new Set(list)].sort((a, b) => a.localeCompare(b));
  }

  send('players-list', { all: [...all].sort((a, b) => a.localeCompare(b)), byBot });
  telegramMaybeNotifyPlayers();
}

function findLogo() {
  ensureFolders();
  const names = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp', 'icon.png'];
  for (const name of names) {
    const file = path.join(LOGO_DIR, name);
    if (fs.existsSync(file)) return pathToFileURL(file).toString();
  }
  return '';
}

ipcMain.handle('get-logo', () => findLogo());

ipcMain.handle('get-scripts', () => {
  loadScriptsFromFolder();
  return [...scripts.values()].map((s) => ({
    fileName: s.fileName,
    displayName: s.displayName,
    hasTargetPlayer: s.hasTargetPlayer,
    isGlobal: !!s.isGlobal,
    isPinned: !!s.isPinned,
    createTab: s.createTab || '',
    valid: s.valid,
    error: s.error,
    updatedAt: s.updatedAt
  }));
});

ipcMain.handle('open-scripts-folder', async () => {
  ensureFolders();
  await shell.openPath(SCRIPT_DIR);
  return SCRIPT_DIR;
});

ipcMain.handle('open-logo-folder', async () => {
  ensureFolders();
  await shell.openPath(LOGO_DIR);
  return LOGO_DIR;
});

ipcMain.handle('start-bots', async (_event, payload) => {
  try {
    const config = normalizeServerConfig(payload.server || {});
    currentServerLabel = `${config.host}:${config.port}`;
    const rows = Array.isArray(payload.bots) ? payload.bots : [];
    const assignments = payload.scriptAssignments || {};

    const nickRows = rows
      .map((row) => ({ nick: cleanText(row.nick), afkEnabled: !!row.afkEnabled }))
      .filter((row) => row.nick);

    const unique = new Set();
    for (const row of nickRows) {
      if (!isValidNick(row.nick)) throw new Error(`Ник "${row.nick}" неверный. Нужно 3-16 символов: английские буквы, цифры или _. Точки и пробелы нельзя.`);
      if (unique.has(row.nick.toLowerCase())) throw new Error(`Ник "${row.nick}" повторяется.`);
      unique.add(row.nick.toLowerCase());
    }

    if (!nickRows.length) throw new Error('Добавь хотя бы один ник бота.');
    if (nickRows.length > MAX_BOTS) throw new Error(`Слишком много ботов. Максимум: ${MAX_BOTS}.`);

    log(`Запуск ${nickRows.length} бот(ов) на ${config.host}:${config.port}...`);

    for (let i = 0; i < nickRows.length; i++) {
      const row = nickRows[i];
      const botAssignments = assignments[row.nick] || {};
      await connectBot(config, row, botAssignments);
      if (i < nickRows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, config.delaySeconds * 1000));
      }
    }

    return { ok: true, message: `Запущено подключение: ${nickRows.length} бот(ов).` };
  } catch (err) {
    uiError(err.message || String(err));
    return { ok: false, message: err.message || String(err) };
  }
});

ipcMain.handle('stop-bots', () => {
  const usernames = [...bots.keys()];
  if (!usernames.length) {
    uiError('Боты не запущены.');
    return { ok: false, message: 'Боты не запущены.' };
  }

  log(`Остановка ${usernames.length} бот(ов)...`);
  for (const username of usernames) stopBot(username);
  return { ok: true, message: `Остановлено: ${usernames.length} бот(ов).` };
});

ipcMain.handle('set-afk', (_event, { username, enabled }) => {
  const record = bots.get(username);
  if (!record) return { ok: false, message: 'Бот не найден.' };
  record.afkEnabled = !!enabled;
  if (record.bot && record.status === 'online') {
    if (enabled) startAfk(record);
    else stopAfk(record);
  }
  sendBotStatuses();
  return { ok: true };
});

ipcMain.handle('set-bot-script', async (_event, { username, fileName, enabled, options }) => {
  const record = bots.get(username);
  if (!record) {
    return { ok: false, message: 'Бот ещё не запущен. Настройка сохранится в UI и применится при запуске.' };
  }

  const opts = { ...(options || {}), enabled: !!enabled };
  if (enabled) {
    record.desiredScripts.set(fileName, opts);
    if (record.bot && record.status === 'online') await applyScript(record, fileName, opts);
  } else {
    record.desiredScripts.set(fileName, opts);
    stopScript(record, fileName);
  }

  return { ok: true };
});




ipcMain.handle('set-global-script', (_event, { scriptName, enabled }) => {
  if (scriptName !== 'telegram-app') return { ok: false, message: 'Неизвестный общий скрипт.' };
  telegramState.scriptEnabled = !!enabled;
  if (!telegramState.scriptEnabled && telegramState.running) stopTelegram();
  sendTelegramStatus();
  log(`Общий скрипт ТГ-приложение ${telegramState.scriptEnabled ? 'включён' : 'выключен'}.`);
  return { ok: true, status: telegramStatusPayload() };
});

ipcMain.handle('telegram-start', async (_event, payload) => {
  try {
    const result = await startTelegram(payload || {});
    return result;
  } catch (err) {
    uiError(err.message || String(err));
    return { ok: false, message: err.message || String(err) };
  }
});

ipcMain.handle('telegram-stop', () => stopTelegram());

ipcMain.handle('telegram-status', () => telegramStatusPayload());

ipcMain.handle('check-updates', async () => {
  try {
    return await checkForUpdates();
  } catch (err) {
    return {
      ok: false,
      hasUpdate: false,
      currentVersion: app.getVersion(),
      latestVersion: '',
      releaseUrl: GITHUB_RELEASES_URL,
      message: err.message || String(err)
    };
  }
});

ipcMain.handle('open-update-page', async (_event, url) => {
  const safeUrl = cleanText(url) || GITHUB_RELEASES_URL;
  if (!/^https:\/\/github\.com\/Yuka2241\/BotsShink\/releases/i.test(safeUrl)) {
    await shell.openExternal(GITHUB_RELEASES_URL);
    return { ok: true };
  }
  await shell.openExternal(safeUrl);
  return { ok: true };
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  return { ok: true };
});

ipcMain.handle('window-toggle-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { maximized: false };
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return { maximized: mainWindow.isMaximized() };
});

ipcMain.handle('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  return { ok: true };
});

app.whenReady().then(() => {
  ensureFolders();
  loadScriptsFromFolder({ announce: true });
  createWindow();
  startScriptWatcher();
  playerTimer = setInterval(sendKnownPlayers, 2500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  for (const username of [...bots.keys()]) stopBot(username);
  if (playerTimer) clearInterval(playerTimer);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
