Seleckt - BotSkripts
// BotSkripts-Name: Бесконечные прыжки

module.exports = async function(api) {
  api.log('Бесконечные прыжки включены.');

  api.onSpawn(() => {
    api.every(750, async () => {
      if (!api.bot.entity || !api.bot.entity.onGround) return;
      await api.jump(260);
    });
  });

  api.registerCleanup(() => {
    api.setControl('jump', false);
    api.log('Бесконечные прыжки выключены.');
  });
};
