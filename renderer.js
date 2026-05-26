'use strict';

const state = {
  bots: [{ nick: 'Bot_1', afkEnabled: false }],
  statuses: [],
  scripts: [],
  players: { all: [], byBot: {} },
  assignments: loadJson('botScriptAssignments', {}),
  sidebarCollapsed: loadJson('sidebarCollapsed', false),
  updateInfo: null,
  telegram: loadJson('telegramSettings', {
    scriptEnabled: false,
    token: '',
    chatId: '',
    features: {
      botNotifications: false,
      chatNotifications: false,
      serverOnline: false,
      playersOnline: false
    }
  }),
  consoleApp: loadJson('consoleSettings', {
    scriptEnabled: false,
    history: []
  })
};

const $ = (id) => document.getElementById(id);

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || '') || fallback;
  } catch (_) {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getServerConfig() {
  const version = $('versionInput').value.trim();
  return {
    host: $('hostInput').value.trim(),
    port: Number($('portInput').value || 25565),
    version: !version || version.toLowerCase() === 'auto' ? '' : version,
    delaySeconds: Number($('delayInput').value || 15)
  };
}

function updateSidebarServer() {
  const cfg = getServerConfig();
  $('sidebarServer').textContent = `${cfg.host || 'не выбран'}:${cfg.port || ''}`;
}

function statusInfo(status) {
  const map = {
    online: 'Онлайн',
    connecting: 'Подключается',
    offline: 'Отключён',
    error: 'Ошибка',
    kicked: 'Кикнут'
  };
  return map[status] || 'Отключён';
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 4200);
}

function addLog(line) {
  const output = $('logOutput');
  output.textContent += `${line}\n`;
  output.scrollTop = output.scrollHeight;
}

function syncBotsFromRows() {
  const rows = [...document.querySelectorAll('.bot-row')];
  state.bots = rows.map((row) => ({
    nick: row.querySelector('.nick-input').value.trim(),
    afkEnabled: row.querySelector('.afk-toggle').classList.contains('active')
  }));
  saveJson('botRows', state.bots);
}

function ensureAssignment(username, fileName) {
  if (!state.assignments[username]) state.assignments[username] = {};
  if (!state.assignments[username][fileName]) {
    state.assignments[username][fileName] = { enabled: false, targetPlayer: '' };
  }
  return state.assignments[username][fileName];
}

function migrateAssignmentsForNickChange(oldNick, newNick) {
  if (!oldNick || !newNick || oldNick === newNick) return;
  if (state.assignments[oldNick] && !state.assignments[newNick]) {
    state.assignments[newNick] = state.assignments[oldNick];
    delete state.assignments[oldNick];
    saveJson('botScriptAssignments', state.assignments);
  }
}

function renderBotRows() {
  const container = $('botRows');
  container.innerHTML = '';

  if (!Array.isArray(state.bots) || state.bots.length === 0) {
    state.bots = [{ nick: 'Bot_1', afkEnabled: false }];
    saveJson('botRows', state.bots);
  }

  state.bots.forEach((bot, index) => {
    const row = document.createElement('div');
    row.className = 'bot-row';
    row.innerHTML = `
      <label>
        <span>Ник бота</span>
        <input class="nick-input" type="text" value="${escapeHtml(bot.nick || '')}" placeholder="Bot_1" />
      </label>
      <button class="afk-toggle ${bot.afkEnabled ? 'active' : ''}" type="button">AFK</button>
      <button class="symbol-button ${index === 0 ? 'add' : 'remove'}" type="button" title="${index === 0 ? 'Добавить бота' : 'Удалить бота'}">${index === 0 ? '✦' : '━'}</button>
    `;

    const input = row.querySelector('.nick-input');
    const afk = row.querySelector('.afk-toggle');
    const symbol = row.querySelector('.symbol-button');

    let previousNick = bot.nick || '';
    input.addEventListener('input', () => {
      migrateAssignmentsForNickChange(previousNick, input.value.trim());
      previousNick = input.value.trim();
      syncBotsFromRows();
      renderBotCards();
    });

    afk.addEventListener('click', async () => {
      afk.classList.toggle('active');
      syncBotsFromRows();
      const nick = input.value.trim();
      if (nick) await window.botPanel.setAfk({ username: nick, enabled: afk.classList.contains('active') });
      renderBotCards();
    });

    symbol.addEventListener('click', () => {
      if (index === 0) {
        state.bots.push({ nick: `Bot_${state.bots.length + 1}`, afkEnabled: false });
      } else {
        const nick = input.value.trim();
        if (nick) delete state.assignments[nick];
        state.bots.splice(index, 1);
      }
      saveJson('botScriptAssignments', state.assignments);
      saveJson('botRows', state.bots);
      renderBotRows();
      renderBotCards();
    });

    container.appendChild(row);
  });

  renderBotCards();
}

function renderHomeStatuses() {
  const list = $('homeStatusList');
  const bots = state.bots.map((row) => row.nick).filter(Boolean);
  const statusByName = new Map(state.statuses.map((item) => [item.username, item]));
  const names = [...new Set([...bots, ...state.statuses.map((s) => s.username)])];

  if (!names.length) {
    list.className = 'status-list empty';
    list.textContent = 'Пока нет запущенных ботов.';
    return;
  }

  list.className = 'status-list';
  list.innerHTML = names.map((name) => {
    const current = statusByName.get(name) || { status: 'offline', reason: '', activeScripts: [] };
    const label = statusInfo(current.status);
    const activeScripts = current.activeScripts && current.activeScripts.length ? current.activeScripts.join(', ') : 'нет';
    return `
      <div class="status-item">
        <div class="status-main">
          <strong>${escapeHtml(name)}</strong>
          <p>Скрипты: ${escapeHtml(activeScripts)}${current.reason ? ` · ${escapeHtml(current.reason)}` : ''}</p>
        </div>
        <span class="badge ${escapeHtml(current.status)}">${label}</span>
      </div>
    `;
  }).join('');
}

function renderBotCards() {
  const container = $('botCards');
  const validScripts = state.scripts.filter((script) => script.valid);
  const botNames = state.bots.map((b) => b.nick.trim()).filter(Boolean);

  if (!botNames.length) {
    container.className = 'bot-cards empty';
    container.textContent = 'Добавь хотя бы один ник.';
    return;
  }

  if (!validScripts.length) {
    container.className = 'bot-cards empty';
    container.textContent = 'Скрипты не найдены. Открой папку BotSkripts и добавь .js файл.';
    return;
  }

  container.className = 'bot-cards';
  container.innerHTML = '';

  for (const username of botNames) {
    const status = state.statuses.find((item) => item.username === username) || { status: 'offline' };
    const label = statusInfo(status.status);

    const card = document.createElement('div');
    card.className = 'bot-card';
    card.innerHTML = `
      <div class="bot-card-header">
        <div>
          <strong>${escapeHtml(username)}</strong>
          <p>Назначай скрипты только этому боту.</p>
        </div>
        <span class="badge ${escapeHtml(status.status)}">${label}</span>
      </div>
      <div class="assignments"></div>
    `;

    const assignmentsBox = card.querySelector('.assignments');

    for (const script of validScripts) {
      const assignment = ensureAssignment(username, script.fileName);
      const row = document.createElement('div');
      row.className = 'script-assignment';

      const targetOptions = getTargetOptions(username, assignment.targetPlayer);
      row.innerHTML = `
        <div class="script-name">
          <strong>${escapeHtml(script.displayName)}</strong>
          <small>${escapeHtml(script.fileName)}</small>
        </div>
        <div class="target-holder">
          ${script.hasTargetPlayer ? `<select class="target-select">${targetOptions}</select>` : '<span class="hint">Без выбора игрока</span>'}
        </div>
        <div class="script-actions">
          <button class="toggle-symbol on ${assignment.enabled ? 'active' : ''}" type="button" title="Включить">✦</button>
          <button class="toggle-symbol off ${assignment.enabled ? '' : 'active'}" type="button" title="Выключить">━</button>
        </div>
      `;

      const select = row.querySelector('.target-select');
      const onBtn = row.querySelector('.toggle-symbol.on');
      const offBtn = row.querySelector('.toggle-symbol.off');

      if (select) {
        select.addEventListener('change', async () => {
          assignment.targetPlayer = select.value;
          saveJson('botScriptAssignments', state.assignments);
          if (assignment.enabled) {
            await window.botPanel.setBotScript({ username, fileName: script.fileName, enabled: true, options: assignment });
          }
        });
      }

      onBtn.addEventListener('click', async () => {
        assignment.enabled = true;
        if (select) assignment.targetPlayer = select.value;
        saveJson('botScriptAssignments', state.assignments);
        await window.botPanel.setBotScript({ username, fileName: script.fileName, enabled: true, options: assignment });
        renderBotCards();
      });

      offBtn.addEventListener('click', async () => {
        assignment.enabled = false;
        if (select) assignment.targetPlayer = select.value;
        saveJson('botScriptAssignments', state.assignments);
        await window.botPanel.setBotScript({ username, fileName: script.fileName, enabled: false, options: assignment });
        renderBotCards();
      });

      assignmentsBox.appendChild(row);
    }

    container.appendChild(card);
  }
}

function getTargetOptions(username, selected) {
  const own = state.players.byBot[username] || [];
  const all = [...new Set([...(own || []), ...(state.players.all || [])])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const values = ['', ...all];
  return values.map((name) => {
    const label = name ? name : 'Ближайший игрок';
    return `<option value="${escapeHtml(name)}" ${selected === name ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function isTelegramScript(script) {
  const tab = String(script.createTab || '').trim().toLowerCase();
  const name = String(script.displayName || '').trim().toLowerCase();
  const file = String(script.fileName || '').trim().toLowerCase();
  return tab === 'телега' || tab === 'telegram' || name.includes('тг') || name.includes('telegram') || file.includes('telegram');
}

function isConsoleScript(script) {
  const tab = String(script.createTab || '').trim().toLowerCase();
  const name = String(script.displayName || '').trim().toLowerCase();
  const file = String(script.fileName || '').trim().toLowerCase();
  return tab === 'консоль' || tab === 'console' || name.includes('консоль') || name.includes('console') || file.includes('console');
}

function renderScriptList() {
  const validScripts = state.scripts.filter((script) => script.valid);
  const pinnedScripts = validScripts.filter((script) => script.isPinned || script.isGlobal || script.createTab);
  const normalScriptItems = state.scripts.filter((script) => !(script.isPinned || script.isGlobal || script.createTab));
  $('scriptCount').textContent = String(validScripts.length);
  const container = $('scriptList');

  container.className = 'script-list';

  const pinnedHtml = pinnedScripts.length ? pinnedScripts.map((script, index) => {
    const enabled = isTelegramScript(script) ? !!state.telegram.scriptEnabled : (isConsoleScript(script) ? !!state.consoleApp.scriptEnabled : false);
    const tabText = script.createTab ? ` · вкладка: ${escapeHtml(script.createTab)}` : '';
    return `
      <div class="script-item pinned-script">
        <div>
          <strong>${escapeHtml(script.displayName)}</strong>
          <p>Закреплённый общий скрипт${tabText}. ${escapeHtml(script.fileName)}</p>
        </div>
        <div class="script-actions">
          <button class="toggle-symbol on pinned-on" data-index="${index}" type="button" title="Включить">✦</button>
          <button class="toggle-symbol off pinned-off" data-index="${index}" type="button" title="Выключить">━</button>
        </div>
      </div>
    `.replace('toggle-symbol on pinned-on', `toggle-symbol on pinned-on ${enabled ? 'active' : ''}`)
     .replace('toggle-symbol off pinned-off', `toggle-symbol off pinned-off ${enabled ? '' : 'active'}`);
  }).join('') : '';

  const normalScripts = normalScriptItems.length ? normalScriptItems.map((script) => `
    <div class="script-item">
      <div>
        <strong>${escapeHtml(script.displayName)}</strong>
        <p>${escapeHtml(script.fileName)}${script.hasTargetPlayer ? ' · выбор игрока включён' : ''}</p>
        ${script.valid ? '' : `<p class="script-invalid">Ошибка: ${escapeHtml(script.error)}</p>`}
      </div>
      <span class="badge ${script.valid ? 'ready' : 'invalid'}">${script.valid ? 'Готов' : 'Ошибка'}</span>
    </div>
  `).join('') : '<div class="empty">Обычные скрипты не найдены.</div>';

  container.innerHTML = `${pinnedHtml}${normalScripts}`;

  container.querySelectorAll('.pinned-on').forEach((button) => {
    button.addEventListener('click', async () => {
      const script = pinnedScripts[Number(button.dataset.index)];
      if (isTelegramScript(script)) {
        state.telegram.scriptEnabled = true;
        saveTelegramSettings();
        await window.botPanel.setGlobalScript({ scriptName: 'telegram-app', enabled: true });
        updateTelegramVisibility();
        renderScriptList();
      } else if (isConsoleScript(script)) {
        state.consoleApp.scriptEnabled = true;
        saveConsoleSettings();
        await window.botPanel.setGlobalScript({ scriptName: 'console-app', enabled: true });
        updateConsoleVisibility();
        renderScriptList();
      } else {
        showToast('Этот общий скрипт требует отдельного обработчика в приложении.');
      }
    });
  });

  container.querySelectorAll('.pinned-off').forEach((button) => {
    button.addEventListener('click', async () => {
      const script = pinnedScripts[Number(button.dataset.index)];
      if (isTelegramScript(script)) {
        state.telegram.scriptEnabled = false;
        saveTelegramSettings();
        await window.botPanel.setGlobalScript({ scriptName: 'telegram-app', enabled: false });
        updateTelegramVisibility();
        renderScriptList();
      } else if (isConsoleScript(script)) {
        state.consoleApp.scriptEnabled = false;
        saveConsoleSettings();
        await window.botPanel.setGlobalScript({ scriptName: 'console-app', enabled: false });
        updateConsoleVisibility();
        renderScriptList();
      }
    });
  });

  renderBotCards();
}

function saveTelegramSettings() {
  saveJson('telegramSettings', state.telegram);
}

function updateTelegramVisibility() {
  const button = $('telegramTabButton');
  const panel = $('telegram');
  if (!button || !panel) return;
  const visible = !!state.telegram.scriptEnabled;
  button.classList.toggle('hidden', !visible);
  if (!visible && panel.classList.contains('active')) {
    const homeBtn = document.querySelector('.tab-button[data-tab="home"]');
    if (homeBtn) homeBtn.click();
  }
}

function saveConsoleSettings() {
  saveJson('consoleSettings', state.consoleApp);
}

function updateConsoleVisibility() {
  const button = $('consoleTabButton');
  const panel = $('console');
  if (!button || !panel) return;
  const visible = !!state.consoleApp.scriptEnabled;
  button.classList.toggle('hidden', !visible);
  if (!visible && panel.classList.contains('active')) {
    const homeBtn = document.querySelector('.tab-button[data-tab="home"]');
    if (homeBtn) homeBtn.click();
  }
  setConsoleStatus({ scriptEnabled: visible });
}

function addConsoleLine(line) {
  const output = $('consoleOutput');
  if (!output) return;
  const stamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
  const text = `[${stamp}] ${line}`;
  state.consoleApp.history = [...(state.consoleApp.history || []), text].slice(-200);
  saveConsoleSettings();
  output.textContent = state.consoleApp.history.join('\n');
  output.scrollTop = output.scrollHeight;
}

function renderConsoleHistory() {
  const output = $('consoleOutput');
  if (!output) return;
  output.textContent = (state.consoleApp.history || []).join('\n');
  output.scrollTop = output.scrollHeight;
}

function setConsoleStatus(status) {
  const badge = $('consoleStatusBadge');
  if (!badge) return;
  const enabled = status && typeof status.scriptEnabled === 'boolean' ? status.scriptEnabled : !!state.consoleApp.scriptEnabled;
  badge.textContent = enabled ? 'Готово' : 'Отключено';
}

async function runConsoleCommand() {
  const input = $('consoleCommandInput');
  if (!input) return;
  const command = input.value.trim();
  if (!command) return;
  addConsoleLine(`> ${command}`);
  const result = await window.botPanel.runConsoleCommand(command);
  addConsoleLine(result && result.message ? result.message : 'Команда выполнена.');
  if (result && result.ok) input.value = '';
}

function renderTelegramSettings() {
  const token = $('telegramTokenInput');
  const chatId = $('telegramChatIdInput');
  if (token) token.value = state.telegram.token || '';
  if (chatId) chatId.value = state.telegram.chatId || '';

  document.querySelectorAll('.telegram-feature-row').forEach((row) => {
    const key = row.dataset.feature;
    const active = !!(state.telegram.features && state.telegram.features[key]);
    row.classList.toggle('active', active);
    const btn = row.querySelector('.telegram-feature-toggle');
    if (btn) btn.textContent = active ? 'Вкл' : 'Выкл';
  });

  updateTelegramVisibility();
}

function collectTelegramSettings() {
  state.telegram.token = $('telegramTokenInput').value.trim();
  state.telegram.chatId = $('telegramChatIdInput').value.trim();
  saveTelegramSettings();
  return {
    token: state.telegram.token,
    chatId: state.telegram.chatId,
    features: state.telegram.features
  };
}

function setTelegramStatus(status) {
  const badge = $('telegramStatusBadge');
  if (!badge) return;
  if (status && status.running) {
    badge.textContent = 'Запущено';
  } else if (state.telegram.scriptEnabled) {
    badge.textContent = 'Готово';
  } else {
    badge.textContent = 'Остановлено';
  }
  if (status && status.features) {
    state.telegram.features = { ...state.telegram.features, ...status.features };
    saveTelegramSettings();
    renderTelegramSettings();
  }
}

async function startTelegram() {
  const payload = collectTelegramSettings();
  const result = await window.botPanel.startTelegram(payload);
  if (result && result.message) addLog(`UI: ${result.message}`);
  const status = await window.botPanel.getTelegramStatus();
  setTelegramStatus(status);
}

async function stopTelegram() {
  const result = await window.botPanel.stopTelegram();
  if (result && result.message) addLog(`UI: ${result.message}`);
  const status = await window.botPanel.getTelegramStatus();
  setTelegramStatus(status);
}

function refreshCounts() {
  const online = state.statuses.filter((item) => item.status === 'online').length;
  const total = new Set([...state.bots.map((b) => b.nick).filter(Boolean), ...state.statuses.map((s) => s.username)]).size;
  $('onlineCount').textContent = String(online);
  $('totalCount').textContent = String(total);
  $('sidebarActive').textContent = `${online} / ${total}`;
}

async function startBots() {
  syncBotsFromRows();
  updateSidebarServer();
  const payload = {
    server: getServerConfig(),
    bots: state.bots,
    scriptAssignments: state.assignments
  };
  const result = await window.botPanel.startBots(payload);
  if (result && result.message) addLog(`UI: ${result.message}`);
}

async function stopBots() {
  const result = await window.botPanel.stopBots();
  if (result && result.message) addLog(`UI: ${result.message}`);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function applySidebarState() {
  const shell = document.querySelector('.app-shell');
  const button = $('sidebarToggleBtn');
  if (!shell || !button) return;

  shell.classList.toggle('sidebar-collapsed', !!state.sidebarCollapsed);
  button.classList.toggle('active', !!state.sidebarCollapsed);
  button.title = state.sidebarCollapsed ? 'Показать боковую панель' : 'Скрыть боковую панель';
  button.setAttribute('aria-label', state.sidebarCollapsed ? 'Показать боковую панель' : 'Скрыть боковую панель');
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  saveJson('sidebarCollapsed', state.sidebarCollapsed);
  applySidebarState();
}

function initTabs() {
  document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
      button.classList.add('active');
      $(button.dataset.tab).classList.add('active');
    });
  });
}



function setUpdateBanner(info, mode = 'hidden') {
  const banner = $('updateBanner');
  const title = $('updateTitle');
  const text = $('updateText');
  const openBtn = $('updateOpenBtn');
  if (!banner || !title || !text || !openBtn) return;

  state.updateInfo = info || null;
  banner.classList.remove('hidden', 'available', 'neutral', 'error');

  if (mode === 'hidden') {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.add(mode);
  if (info && info.hasUpdate) {
    title.textContent = `Доступно обновление ${info.latestVersion || ''}`.trim();
    const asset = info.assetName ? ` Файл: ${info.assetName}.` : '';
    text.textContent = `Текущая версия: ${info.currentVersion}. Новая версия: ${info.latestVersion}.${asset}`;
    openBtn.textContent = 'Скачать с GitHub';
    return;
  }

  if (info && info.ok === false) {
    title.textContent = 'Не удалось проверить обновления';
    text.textContent = info.message || 'Проверь интернет и GitHub Releases.';
    openBtn.textContent = 'Открыть GitHub';
    return;
  }

  title.textContent = 'Обновлений нет';
  text.textContent = (info && info.message) || 'Установлена последняя версия.';
  openBtn.textContent = 'Открыть GitHub';
}

async function checkUpdates(manual = false) {
  if (manual) {
    setUpdateBanner({ ok: true, message: 'Проверяем GitHub Releases...' }, 'neutral');
    addLog('UI: проверка обновлений...');
  }

  const info = await window.botPanel.checkUpdates();
  state.updateInfo = info;

  if (info && info.hasUpdate) {
    setUpdateBanner(info, 'available');
    addLog(`UI: доступно обновление ${info.latestVersion}.`);
    return;
  }

  if (info && info.ok === false) {
    if (manual) {
      setUpdateBanner(info, 'error');
      showToast(info.message || 'Не удалось проверить обновления.');
      addLog(`UI ERROR: ${info.message || 'не удалось проверить обновления.'}`);
    }
    return;
  }

  if (manual) {
    setUpdateBanner(info, 'neutral');
    showToast((info && info.message) || 'Обновлений нет.');
    addLog(`UI: ${(info && info.message) || 'обновлений нет.'}`);
  }
}

function initWindowControls() {
  const minBtn = $('windowMinBtn');
  const maxBtn = $('windowMaxBtn');
  const closeBtn = $('windowCloseBtn');

  minBtn.addEventListener('click', () => window.botPanel.minimizeWindow());
  maxBtn.addEventListener('click', () => window.botPanel.toggleMaximizeWindow());
  closeBtn.addEventListener('click', () => window.botPanel.closeWindow());
}

function updateWindowState(stateInfo) {
  const maxBtn = $('windowMaxBtn');
  if (!maxBtn) return;
  const maximized = !!(stateInfo && stateInfo.maximized);
  maxBtn.textContent = maximized ? '❐' : '□';
  maxBtn.title = maximized ? 'Восстановить' : 'Развернуть';
  maxBtn.setAttribute('aria-label', maximized ? 'Восстановить' : 'Развернуть');
}

function bindClick(id, handler) {
  const el = $(id);
  if (el) el.addEventListener('click', handler);
}

function initEvents() {
  for (const id of ['startBtn', 'startBtn2']) $(id).addEventListener('click', startBots);
  $('sidebarToggleBtn').addEventListener('click', toggleSidebar);
  $('checkUpdateBtn').addEventListener('click', () => checkUpdates(true));
  bindClick('telegramStartBtn', startTelegram);
  bindClick('telegramStopBtn', stopTelegram);
  bindClick('consoleRunBtn', runConsoleCommand);
  bindClick('consoleClearBtn', () => {
    state.consoleApp.history = [];
    saveConsoleSettings();
    renderConsoleHistory();
  });
  const consoleCommandInput = $('consoleCommandInput');
  if (consoleCommandInput) {
    consoleCommandInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') runConsoleCommand();
    });
  }
  document.querySelectorAll('.telegram-feature-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.telegram-feature-row');
      if (!row) return;
      const key = row.dataset.feature;
      state.telegram.features[key] = !state.telegram.features[key];
      saveTelegramSettings();
      renderTelegramSettings();
    });
  });
  for (const id of ['telegramTokenInput', 'telegramChatIdInput']) {
    const input = $(id);
    if (input) input.addEventListener('input', () => {
      state.telegram.token = $('telegramTokenInput').value.trim();
      state.telegram.chatId = $('telegramChatIdInput').value.trim();
      saveTelegramSettings();
    });
  }
  $('updateCloseBtn').addEventListener('click', () => setUpdateBanner(null, 'hidden'));
  $('updateOpenBtn').addEventListener('click', async () => {
    const url = state.updateInfo && (state.updateInfo.releaseUrl || state.updateInfo.assetUrl);
    await window.botPanel.openUpdatePage(url);
  });
  for (const id of ['stopBtn', 'stopBtn2']) $(id).addEventListener('click', stopBots);

  bindClick('openScriptsBtn', async () => {
    await window.botPanel.openScriptsFolder();
    addLog('UI: Открыта папка BotSkripts.');
  });

  bindClick('openLogoBtn', async () => {
    await window.botPanel.openLogoFolder();
    addLog('UI: Открыта папка logo.');
  });

  bindClick('refreshScriptsBtn', async () => {
    state.scripts = await window.botPanel.getScripts();
    renderScriptList();
    addLog('UI: список скриптов обновлён.');
  });

  bindClick('clearLogBtn', () => {
    $('logOutput').textContent = '';
  });

  ['hostInput', 'portInput', 'versionInput', 'delayInput'].forEach((id) => {
    $(id).addEventListener('input', () => {
      updateSidebarServer();
      saveJson('serverConfig', getServerConfig());
    });
  });
}

async function restoreSaved() {
  const savedBots = loadJson('botRows', null);
  if (Array.isArray(savedBots) && savedBots.length) state.bots = savedBots;

  const cfg = loadJson('serverConfig', null);
  if (cfg) {
    $('hostInput').value = cfg.host || '127.0.0.1';
    $('portInput').value = cfg.port || 25565;
    $('versionInput').value = cfg.version || 'auto';
    $('delayInput').value = cfg.delaySeconds || 15;
  }

  const logo = await window.botPanel.getLogo();
  const image = $('logoImage');
  const fallback = $('logoFallback');
  if (logo && image && fallback) {
    image.src = logo;
    image.style.display = 'block';
    fallback.style.display = 'none';
  }

  if (!Array.isArray(state.bots) || state.bots.length === 0) {
    state.bots = [{ nick: 'Bot_1', afkEnabled: false }];
    saveJson('botRows', state.bots);
  }

  state.scripts = await window.botPanel.getScripts();
}

function initIpc() {
  window.botPanel.onLog(addLog);
  window.botPanel.onUiError((message) => {
    addLog(`UI ERROR: ${message}`);
    showToast(message);
  });
  window.botPanel.onScriptsList((scripts) => {
    state.scripts = scripts;
    renderScriptList();
  });
  window.botPanel.onBotStatuses((items) => {
    state.statuses = items;
    renderHomeStatuses();
    refreshCounts();
    renderBotCards();
  });
  window.botPanel.onActiveCount(({ active, total }) => {
    $('sidebarActive').textContent = `${active} / ${total}`;
    $('onlineCount').textContent = String(active);
    $('totalCount').textContent = String(total);
  });
  window.botPanel.onPlayersList((players) => {
    state.players = players || { all: [], byBot: {} };
    renderBotCards();
  });
  window.botPanel.onWindowState(updateWindowState);
  window.botPanel.onTelegramStatus(setTelegramStatus);
  window.botPanel.onConsoleStatus((status) => {
    if (status && typeof status.scriptEnabled === 'boolean') {
      state.consoleApp.scriptEnabled = status.scriptEnabled;
      saveConsoleSettings();
    }
    updateConsoleVisibility();
    setConsoleStatus(status);
  });
}

(async function main() {
  initTabs();
  initWindowControls();
  initEvents();
  initIpc();
  await restoreSaved();
  updateSidebarServer();
  applySidebarState();
  renderBotRows();
  renderScriptList();
  renderTelegramSettings();
  renderConsoleHistory();
  updateConsoleVisibility();
  await window.botPanel.setGlobalScript({ scriptName: 'telegram-app', enabled: !!state.telegram.scriptEnabled });
  await window.botPanel.setGlobalScript({ scriptName: 'console-app', enabled: !!state.consoleApp.scriptEnabled });
  renderHomeStatuses();
  refreshCounts();
  setTimeout(() => checkUpdates(false), 1500);
})();
