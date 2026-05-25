Seleckt - BotSkripts
// BotSkripts-Name: Осматриваться вокруг

module.exports = async function(api) {
  let yaw = 0;
  api.log('Осматривание включено.');

  api.onSpawn(() => {
    api.every(1800, async () => {
      if (!api.bot.entity || !api.bot.look) return;
      yaw += Math.PI / 3;
      await api.bot.look(yaw, 0, true);
    });
  });

  api.registerCleanup(() => api.log('Осматривание выключено.'));
};
