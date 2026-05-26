Seleckt - BotSkripts
// BotSkripts-Name: Проверка обновления 1.35

// Тестовый скрипт для проверки, что обновление BotsShink 1.35.0 установилось.
// Безопасно: не пишет в чат, не спамит, делает только один короткий прыжок после входа бота.

module.exports = async function(api) {
  const bot = api.bot;

  async function runTest() {
    api.log('Проверка обновления 1.35.0: тестовый скрипт загружен и работает.');

    try {
      if (api.sleep) await api.sleep(700);

      if (api.jump) {
        await api.jump(300);
        api.log('Проверка обновления 1.35.0: бот сделал тестовый прыжок.');
        return;
      }

      if (bot && bot.setControlState) {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 300);
        api.log('Проверка обновления 1.35.0: бот сделал тестовый прыжок.');
      }
    } catch (err) {
      api.log('Проверка обновления 1.35.0: ошибка теста: ' + (err && err.message ? err.message : err));
    }
  }

  if (api.onSpawn) api.onSpawn(runTest);
  else await runTest();

  api.registerCleanup(() => {
    try { if (bot && bot.setControlState) bot.setControlState('jump', false); } catch (_) {}
    api.log('Проверка обновления 1.35.0: тестовый скрипт выключен.');
  });
};
