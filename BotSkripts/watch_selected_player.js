Seleckt - BotSkripts
// BotSkripts-Name: Смотреть на игрока
// BotSkripts-Config: targetPlayer

module.exports = async function(api) {
  const LOOK_HEIGHT = 1.55;

  api.log('Слежение глазами включено. Если игрок не выбран, используется ближайший.');

  api.onSpawn(() => {
    api.every(250, async () => {
      const target = api.getTargetEntity();
      if (!target || !target.position || !api.bot.lookAt) return;
      await api.bot.lookAt(target.position.offset(0, LOOK_HEIGHT, 0), true);
    });
  });

  api.registerCleanup(() => api.log('Слежение глазами выключено.'));
};
