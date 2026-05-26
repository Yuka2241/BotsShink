Seleckt - BotSkripts
// BotSkripts-Name: Консоль
// BotSkripts-Global: true
// BotSkripts-Pinned: true
// BotSkripts-NoBotApply: true
// BotSkripts-CreateTab: Консоль

// Общий закреплённый модуль для вкладки "Консоль".
// Логику вкладки выполняет само приложение BotsShink.
module.exports = async function(api) {
  if (api && api.log) api.log('Консоль подключена к приложению.');
};
