Seleckt - BotSkripts
// BotSkripts-Name: Проверка обновления

// update_test_plugin_v1_28.js
// Безопасный тестовый скрипт для проверки, что обновление через GitHub Release установилось.
// Он ничего не спамит в чат: только пишет в лог приложения и делает один короткий прыжок после входа бота.

module.exports = async function(api) {
  const bot = api.bot || api.mineflayerBot || api.client;

  async function testUpdatePlugin() {
    api.log('Проверка обновления: новый скрипт v1.28.0 загружен и работает.');

    try {
      if (api.sleep) await api.sleep(800);

      if (api.jump) {
        await api.jump(350);
        api.log('Проверка обновления: бот сделал тестовый прыжок.');
        return;
      }

      if (bot && bot.setControlState) {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 350);
        api.log('Проверка обновления: бот сделал тестовый прыжок.');
      }
    } catch (err) {
      api.log('Проверка обновления: ошибка тестового прыжка: ' + (err.message || err));
    }
  }

  if (api.onSpawn) {
    api.onSpawn(testUpdatePlugin);
  } else {
    await testUpdatePlugin();
  }
};
