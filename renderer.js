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
  discord: loadJson('discordSettings', {
    scriptEnabled: false,
    useBot: true,
    token: '',
    webhook: '',
    guildId: '',
    channelId: '',
    features: {
      botNotifications: false,
      chatNotifications: false,
      serverOnline: false,
      playersOnline: false
    }
  }),
  consoleApp: loadJson('consoleSettings', {
    scriptEnabled: false,
    history: [],
    logs: []
  }),
  ui: loadJson('uiSettings', {
    theme: 'matte',
    blur: false,
    dots: true,
    compact: false,
    panelOpacity: 48,
    dotSpeed: 'normal',
    uiScale: 'normal',
    customizeMode: 'none',
    customColor: '#ffffff',
    customOpacity: 65
  }),
  navGroups: loadJson('navGroups', {
    integrations: true,
    tools: true
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
  const text = String(line || '').trim();
  if (!text) return;
  const logs = state.consoleApp.logs || [];
  if (logs[logs.length - 1] !== text) logs.push(text);
  state.consoleApp.logs = logs.slice(-500);
  saveConsoleSettings();
  renderConsoleLogs();
  addConsoleNotification(text);
}

function smartConsoleAdvice(text) {
  const value = String(text || '').toLowerCase();
  if (value.includes('econnrefused')) return 'Совет: сервер не принимает подключение. Проверь IP, порт и включён ли сервер.';
  if (value.includes('connection throttled')) return 'Совет: сервер ограничивает частые входы. Увеличь задержку между входами.';
  if (value.includes('invalid') && value.includes('ник')) return 'Совет: ник должен быть 3–16 символов, только английские буквы, цифры или _.';
  if (value.includes('no space left') || value.includes('enospc')) return 'Совет: на диске мало места. Освободи 5–10 ГБ и повтори действие.';
  if (value.includes('telegram') && value.includes('ошибка')) return 'Совет: проверь токен Telegram-бота, Chat ID и доступ к интернету.';
  return '';
}

function addConsoleNotification(line) {
  const text = String(line || '').trim();
  if (!text) return;
  const history = state.consoleApp.history || [];
  const next = [...history];
  if (next[next.length - 1] !== text) next.push(text);
  const advice = smartConsoleAdvice(text);
  if (advice && next[next.length - 1] !== advice) next.push(advice);
  state.consoleApp.history = next.slice(-300);
  saveConsoleSettings();
  renderConsoleHistory();
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
    list.innerHTML = emptyStateHtml('Боты ещё не запущены', 'Добавь ники во вкладке Боты и нажми Запуск.', 'Боты');
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
  const validScripts = state.scripts.filter((script) => script.valid && !(script.isGlobal || script.isPinned || script.createTab || script.noBotApply));
  const botNames = state.bots.map((b) => b.nick.trim()).filter(Boolean);

  if (!botNames.length) {
    container.className = 'bot-cards empty';
    container.innerHTML = emptyStateHtml('Боты ещё не созданы', 'Добавь первый ник, чтобы назначать ему скрипты.', 'Добавить');
    return;
  }

  if (!validScripts.length) {
    container.className = 'bot-cards empty';
    container.innerHTML = emptyStateHtml('Нет доступных скриптов', 'Открой папку BotSkripts и добавь .js файл.', 'Скрипты');
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

function isDiscordScript(script) {
  const tab = String(script.createTab || '').trim().toLowerCase();
  const name = String(script.displayName || '').trim().toLowerCase();
  const file = String(script.fileName || '').trim().toLowerCase();
  return tab === 'дискорд' || tab === 'discord' || name.includes('дискорд') || name.includes('discord') || file.includes('discord');
}

function renderScriptList() {
  const validScripts = state.scripts.filter((script) => script.valid);
  const pinnedScripts = validScripts.filter((script) => script.isPinned || script.isGlobal || script.createTab);
  const normalScriptItems = state.scripts.filter((script) => !(script.isPinned || script.isGlobal || script.createTab));
  $('scriptCount').textContent = String(validScripts.length);
  const container = $('scriptList');

  container.className = 'script-list';

  const pinnedHtml = pinnedScripts.length ? pinnedScripts.map((script, index) => {
    const enabled = isTelegramScript(script) ? !!state.telegram.scriptEnabled : (isConsoleScript(script) ? !!state.consoleApp.scriptEnabled : (isDiscordScript(script) ? !!state.discord.scriptEnabled : false));
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
  `).join('') : emptyStateHtml('Обычных скриптов нет', 'Закреплённые модули работают отдельно, а обычные .js можно добавить в BotSkripts.', 'JS');

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
        addConsoleLine('Консоль включена. Системные уведомления уже сохранены в истории.');
        updateConsoleVisibility();
        renderScriptList();
      } else if (isDiscordScript(script)) {
        state.discord.scriptEnabled = true;
        saveDiscordSettings();
        await window.botPanel.setGlobalScript({ scriptName: 'discord-app', enabled: true });
        updateDiscordVisibility();
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
        addConsoleLine('Консоль выключена. Уведомления продолжат сохраняться в истории.');
        updateConsoleVisibility();
        renderScriptList();
      } else if (isDiscordScript(script)) {
        state.discord.scriptEnabled = false;
        saveDiscordSettings();
        await window.botPanel.setGlobalScript({ scriptName: 'discord-app', enabled: false });
        updateDiscordVisibility();
        renderScriptList();
      }
    });
  });

  renderBotCards();
}

function saveTelegramSettings() {
  saveJson('telegramSettings', state.telegram);
}

function saveDiscordSettings() {
  saveJson('discordSettings', state.discord);
}

function updateTelegramVisibility() {
  const button = $('telegramTabButton');
  const panel = $('telegram');
  if (!button || !panel) return;
  const visible = !!state.telegram.scriptEnabled;
  button.classList.toggle('hidden', !visible);
  if (visible && state.navGroups.integrations === false) { state.navGroups.integrations = true; saveNavGroups(); applyNavGroupState(); }
  if (!visible && panel.classList.contains('active')) {
    activateTab('home');
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
  if (visible && state.navGroups.tools === false) { state.navGroups.tools = true; saveNavGroups(); applyNavGroupState(); }
  if (!visible && panel.classList.contains('active')) {
    activateTab('home');
  }
  setConsoleStatus({ scriptEnabled: visible });
  renderConsoleHistory();
  renderConsoleLogs();
}


function updateDiscordVisibility() {
  const button = $('discordTabButton');
  const panel = $('discord');
  if (!button || !panel) return;
  const visible = !!state.discord.scriptEnabled;
  button.classList.toggle('hidden', !visible);
  if (visible && state.navGroups.integrations === false) {
    state.navGroups.integrations = true;
    saveNavGroups();
    applyNavGroupState();
  }
  if (!visible && panel.classList.contains('active')) {
    activateTab('home');
  }
  setDiscordStatus({ scriptEnabled: visible, running: false, features: state.discord.features });
}

function addConsoleLine(line) {
  const output = $('consoleOutput');
  if (!output) return;
  const stamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
  const text = `[${stamp}] ${line}`;
  state.consoleApp.history = [...(state.consoleApp.history || []), text].slice(-300);
  saveConsoleSettings();
  output.textContent = state.consoleApp.history.join('\n');
  output.scrollTop = output.scrollHeight;
}

function renderConsoleHistory() {
  const output = $('consoleOutput');
  if (!output) return;
  const lines = state.consoleApp.history || [];
  output.textContent = lines.length ? lines.join('\n') : 'Консоль готова. Включи скрипт “Консоль” во вкладке “Скрипты”, затем используй команды: help, bots, say "ник" "сообщение".';
  output.scrollTop = output.scrollHeight;
}

function renderConsoleLogs() {
  const output = $('consoleLogsOutput');
  if (!output) return;
  const lines = state.consoleApp.logs || [];
  output.textContent = lines.length ? lines.join('\n') : 'Логи пока пустые. Системные уведомления будут появляться здесь автоматически.';
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


function updateDiscordModeFields() {
  const useBot = state.discord.useBot !== false;
  document.querySelectorAll('.discord-bot-field').forEach((el) => el.classList.toggle('hidden', !useBot));
  document.querySelectorAll('.discord-webhook-field').forEach((el) => el.classList.toggle('hidden', useBot));
  const note = $('discordModeNote');
  if (note) {
    note.textContent = useBot
      ? 'Режим бота: введи токен Discord-бота, ID сервера и ID канала. Webhook в этом режиме скрыт и не используется.'
      : 'Режим Webhook: введи Webhook канала и ID сервера. Токен бота и ID канала скрыты и не используются.';
  }
  const hint = $('discordModeHint');
  if (hint) {
    hint.textContent = useBot
      ? 'Сейчас включён режим Discord-бота. Он пишет в канал через Bot Token.'
      : 'Сейчас включён режим Webhook. Он пишет в канал через Webhook без токена бота.';
  }
  const modeButton = $('discordBotModeToggle');
  if (modeButton) {
    modeButton.classList.toggle('active', useBot);
    modeButton.textContent = useBot ? 'Вкл' : 'Выкл';
  }
}

function renderDiscordSettings() {
  const d = state.discord || {};
  const ids = {
    discordTokenInput: d.token || '',
    discordWebhookInput: d.webhook || '',
    discordGuildIdInput: d.guildId || '',
    discordChannelIdInput: d.channelId || ''
  };
  for (const [id, value] of Object.entries(ids)) {
    const input = $(id);
    if (input) input.value = value;
  }
  updateDiscordModeFields();
  document.querySelectorAll('.discord-feature-row').forEach((row) => {
    const key = row.dataset.feature;
    const active = !!(state.discord.features && state.discord.features[key]);
    const btn = row.querySelector('.discord-feature-toggle');
    setToggleButton(btn, active);
  });
  updateDiscordVisibility();
}

function collectDiscordSettings() {
  state.discord.token = ($('discordTokenInput')?.value || '').trim();
  state.discord.webhook = ($('discordWebhookInput')?.value || '').trim();
  state.discord.guildId = ($('discordGuildIdInput')?.value || '').trim();
  state.discord.channelId = ($('discordChannelIdInput')?.value || '').trim();
  saveDiscordSettings();
  return {
    useBot: state.discord.useBot !== false,
    token: state.discord.token,
    webhook: state.discord.webhook,
    guildId: state.discord.guildId,
    channelId: state.discord.channelId,
    features: state.discord.features
  };
}

function setDiscordStatus(status) {
  const badge = $('discordStatusBadge');
  if (!badge) return;
  if (status && status.running) badge.textContent = 'Запущено';
  else if (state.discord.scriptEnabled) badge.textContent = 'Готово';
  else badge.textContent = 'Остановлено';
  if (status && status.features) {
    state.discord.features = { ...state.discord.features, ...status.features };
    saveDiscordSettings();
    renderDiscordSettings();
  }
}

async function startDiscord() {
  const result = await window.botPanel.startDiscord(collectDiscordSettings());
  if (result && result.message) addLog(`UI: ${result.message}`);
  if (result && result.ok === false) showToast(result.message || 'Discord не запущен.');
  const status = await window.botPanel.getDiscordStatus();
  setDiscordStatus(status);
}

async function stopDiscord() {
  const result = await window.botPanel.stopDiscord();
  if (result && result.message) addLog(`UI: ${result.message}`);
  const status = await window.botPanel.getDiscordStatus();
  setDiscordStatus(status);
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



function emptyStateHtml(title, text, label = 'Пусто') {
  return `
    <div class="empty-state">
      <div class="empty-state-mark">${escapeHtml(label).slice(0, 2)}</div>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function saveUiSettings() {
  saveJson('uiSettings', state.ui);
}

function setToggleButton(button, enabled) {
  if (!button) return;
  button.classList.toggle('active', !!enabled);
  button.textContent = enabled ? 'Вкл' : 'Выкл';
}

function applyUiSettings() {
  const ui = state.ui || {};
  document.body.classList.toggle('theme-white', ui.theme === 'white');
  document.body.classList.toggle('theme-matte', ui.theme !== 'white');
  document.body.classList.toggle('bg-blur-enabled', !!ui.blur);
  document.body.classList.toggle('dots-disabled', !ui.dots);
  document.body.classList.toggle('compact-mode', !!ui.compact);
  document.body.classList.toggle('ui-large', ui.uiScale === 'large');
  document.body.dataset.dotSpeed = ui.dotSpeed || 'normal';
  document.documentElement.style.setProperty('--panel-alpha', `${Math.max(35, Math.min(95, Number(ui.panelOpacity || 48))) / 100}`);
  document.documentElement.style.setProperty('--custom-color', ui.customColor || '#ffffff');
  document.documentElement.style.setProperty('--custom-opacity', `${Math.max(20, Math.min(100, Number(ui.customOpacity || 65))) / 100}`);
  document.body.dataset.customizeMode = ui.customizeMode || 'none';

  const themeSelect = $('themeSelect');
  const panelOpacity = $('panelOpacityInput');
  const dotSpeed = $('dotSpeedSelect');
  const uiScale = $('uiScaleSelect');
  const customizeMode = $('customizeModeSelect');
  const customColor = $('customColorInput');
  const customOpacity = $('customOpacityInput');
  if (themeSelect) themeSelect.value = ui.theme || 'matte';
  if (panelOpacity) panelOpacity.value = String(ui.panelOpacity || 48);
  if (dotSpeed) dotSpeed.value = ui.dotSpeed || 'normal';
  if (uiScale) uiScale.value = ui.uiScale || 'normal';
  if (customizeMode) customizeMode.value = ui.customizeMode || 'none';
  if (customColor) customColor.value = ui.customColor || '#ffffff';
  if (customOpacity) customOpacity.value = String(ui.customOpacity || 65);
  const controls = $('customizeControls');
  if (controls) controls.classList.toggle('hidden', (ui.customizeMode || 'none') === 'none');
  setToggleButton($('blurToggle'), !!ui.blur);
  setToggleButton($('dotsToggle'), ui.dots !== false);
  setToggleButton($('compactToggle'), !!ui.compact);
}

function initSettingsEvents() {
  const themeSelect = $('themeSelect');
  if (themeSelect) themeSelect.addEventListener('change', () => {
    state.ui.theme = themeSelect.value;
    saveUiSettings();
    applyUiSettings();
  });

  const panelOpacity = $('panelOpacityInput');
  if (panelOpacity) panelOpacity.addEventListener('input', () => {
    state.ui.panelOpacity = Number(panelOpacity.value || 48);
    saveUiSettings();
    applyUiSettings();
  });

  const dotSpeed = $('dotSpeedSelect');
  if (dotSpeed) dotSpeed.addEventListener('change', () => {
    state.ui.dotSpeed = dotSpeed.value;
    saveUiSettings();
    applyUiSettings();
  });

  const uiScale = $('uiScaleSelect');
  const customizeMode = $('customizeModeSelect');
  const customColor = $('customColorInput');
  const customOpacity = $('customOpacityInput');
  if (uiScale) uiScale.addEventListener('change', () => {
    state.ui.uiScale = uiScale.value;
    saveUiSettings();
    applyUiSettings();
  });

  bindClick('blurToggle', () => {
    state.ui.blur = !state.ui.blur;
    saveUiSettings();
    applyUiSettings();
  });

  bindClick('dotsToggle', () => {
    state.ui.dots = state.ui.dots === false;
    saveUiSettings();
    applyUiSettings();
  });

  bindClick('compactToggle', () => {
    state.ui.compact = !state.ui.compact;
    saveUiSettings();
    applyUiSettings();
  });
  if (customizeMode) customizeMode.addEventListener('change', () => {
    state.ui.customizeMode = customizeMode.value || 'none';
    saveUiSettings();
    applyUiSettings();
  });

  if (customColor) customColor.addEventListener('input', () => {
    state.ui.customColor = customColor.value || '#ffffff';
    saveUiSettings();
    applyUiSettings();
  });

  if (customOpacity) customOpacity.addEventListener('input', () => {
    state.ui.customOpacity = Number(customOpacity.value || 65);
    saveUiSettings();
    applyUiSettings();
  });


  bindClick('settingsResetBtn', () => {
    state.ui = { theme: 'matte', blur: false, dots: true, compact: false, panelOpacity: 48, dotSpeed: 'normal', uiScale: 'normal', customizeMode: 'none', customColor: '#ffffff', customOpacity: 65 };
    saveUiSettings();
    applyUiSettings();
    showToast('Настройки интерфейса сброшены.');
  });
}


function saveNavGroups() {
  saveJson('navGroups', state.navGroups);
}

function applyNavGroupState() {
  document.querySelectorAll('.nav-group.collapsible').forEach((group) => {
    const key = group.dataset.navGroup;
    const isOpen = state.navGroups[key] !== false;
    const toggle = group.querySelector('.nav-group-toggle');
    group.classList.toggle('nav-group-open', isOpen);
    group.classList.toggle('nav-group-collapsed', !isOpen);
    if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

function toggleNavGroup(key) {
  state.navGroups[key] = state.navGroups[key] === false;
  saveNavGroups();
  applyNavGroupState();
}

function initNavGroups() {
  document.querySelectorAll('.nav-group-toggle').forEach((button) => {
    button.addEventListener('click', () => toggleNavGroup(button.dataset.navToggle));
  });
  applyNavGroupState();
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

function activateTab(tabId) {
  const panel = $(tabId);
  if (!panel) return;
  document.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  panel.classList.add('active');
  const button = document.querySelector(`.tab-button[data-tab="${CSS.escape(tabId)}"]`);
  if (button) button.classList.add('active');
  saveJson('lastActiveTab', tabId);
}

function initTabs() {
  document.querySelectorAll('.tab-button[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      if (!target) return;
      activateTab(target);
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


function initScriptDragDrop() {
  const overlay = $('dropOverlay');
  let dragDepth = 0;

  function showOverlay() {
    if (overlay) overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    if (overlay) overlay.classList.add('hidden');
  }

  function hasFiles(event) {
    return event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files');
  }

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    showOverlay();
  });

  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    showOverlay();
  });

  window.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) hideOverlay();
  });

  window.addEventListener('drop', async (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    hideOverlay();

    const files = Array.from(event.dataTransfer.files || []);
    const paths = files.map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      showToast('Не удалось получить путь к файлу. Используй кнопку Загрузить.');
      addLog('UI ERROR: не удалось получить путь к перетаскиваемому файлу.');
      return;
    }

    const result = await window.botPanel.importScripts(paths);
    const imported = result && result.imported ? result.imported : [];
    const skipped = result && result.skipped ? result.skipped : [];

    if (imported.length) {
      state.scripts = await window.botPanel.getScripts();
      renderScriptList();
      showToast(`Скрипт добавлен: ${imported.join(', ')}`);
      addLog(`UI: импортировано скриптов: ${imported.join(', ')}`);
    }
    if (skipped.length) {
      showToast('Некоторые файлы пропущены. Подробности в логах.');
      addLog(`UI: импорт пропущен: ${skipped.join('; ')}`);
    }
  });
}

function initEvents() {
  for (const id of ['startBtn', 'startBtn2']) $(id).addEventListener('click', startBots);
  $('sidebarToggleBtn').addEventListener('click', toggleSidebar);
  $('checkUpdateBtn').addEventListener('click', () => checkUpdates(true));
  bindClick('telegramStartBtn', startTelegram);
  bindClick('telegramStopBtn', stopTelegram);
  bindClick('discordStartBtn', startDiscord);
  bindClick('discordStopBtn', stopDiscord);
  bindClick('scriptsGuideBtn', () => $('scriptsGuideCard')?.classList.toggle('hidden'));
  bindClick('scriptsGuideCloseBtn', () => $('scriptsGuideCard')?.classList.add('hidden'));
  bindClick('consoleRunBtn', runConsoleCommand);
  bindClick('consoleClearBtn', () => {
    const active = document.querySelector('.console-section-tab.active')?.dataset.consoleSection || 'general';
    if (active === 'logs') {
      state.consoleApp.logs = [];
      renderConsoleLogs();
    } else {
      state.consoleApp.history = [];
      renderConsoleHistory();
    }
    saveConsoleSettings();
  });
  document.querySelectorAll('.console-section-tab').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.console-section-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.console-section-output').forEach((o) => o.classList.remove('active'));
      button.classList.add('active');
      const output = document.querySelector(`[data-console-output="${button.dataset.consoleSection}"]`);
      if (output) output.classList.add('active');
      renderConsoleHistory();
      renderConsoleLogs();
    });
  });
  const consoleCommandInput = $('consoleCommandInput');
  if (consoleCommandInput) {
    consoleCommandInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') runConsoleCommand();
    });
  }
  document.querySelectorAll('.quick-command').forEach((button) => {
    button.addEventListener('click', () => {
      const input = $('consoleCommandInput');
      if (!input) return;
      input.value = button.dataset.command || '';
      input.focus();
    });
  });

  document.querySelectorAll('.discord-feature-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.discord-feature-row');
      if (!row) return;
      const key = row.dataset.feature;
      state.discord.features[key] = !state.discord.features[key];
      saveDiscordSettings();
      renderDiscordSettings();
    });
  });
  bindClick('discordBotModeToggle', () => {
    state.discord.useBot = state.discord.useBot === false;
    saveDiscordSettings();
    renderDiscordSettings();
  });
  for (const id of ['discordTokenInput', 'discordWebhookInput', 'discordGuildIdInput', 'discordChannelIdInput']) {
    const input = $(id);
    if (input) input.addEventListener('input', () => {
      collectDiscordSettings();
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
    if (!$('versionInput').value) $('versionInput').value = 'auto';
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
  window.botPanel.onDiscordStatus(setDiscordStatus);
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
  initNavGroups();
  initWindowControls();
  initEvents();
  initScriptDragDrop();
  initSettingsEvents();
  initIpc();
  await restoreSaved();
  updateSidebarServer();
  applyUiSettings();
  applySidebarState();
  renderBotRows();
  renderScriptList();
  renderTelegramSettings();
  renderDiscordSettings();
  renderConsoleHistory();
  renderConsoleLogs();
  updateConsoleVisibility();
  updateDiscordVisibility();
  await window.botPanel.setGlobalScript({ scriptName: 'telegram-app', enabled: !!state.telegram.scriptEnabled });
  await window.botPanel.setGlobalScript({ scriptName: 'console-app', enabled: !!state.consoleApp.scriptEnabled });
  await window.botPanel.setGlobalScript({ scriptName: 'discord-app', enabled: !!state.discord.scriptEnabled });
  renderHomeStatuses();
  refreshCounts();
  setTimeout(() => checkUpdates(false), 1500);
})();
