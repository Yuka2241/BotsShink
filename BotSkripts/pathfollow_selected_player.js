Seleckt - BotSkripts
// BotSkripts-Name: Умная ходьба за игроком
// BotSkripts-Config: targetPlayer

const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const minecraftData = require('minecraft-data');

module.exports = async function(api) {
  const bot = api.bot;
  const FOLLOW_DISTANCE = 2.3;
  const REBUILD_EVERY_MS = 650;
  const TARGET_TOO_FAR = 64;
  const LOOK_HEIGHT = 1.55;
  let lastGoalKey = '';
  let warnedNoTarget = false;

  function safeLoadPathfinder() {
    try {
      if (!bot.pathfinder) bot.loadPlugin(pathfinder);
    } catch (_) {}
  }

  function configureMovements() {
    const mcData = minecraftData(bot.version);
    const movements = new Movements(bot, mcData);

    // Безопасные настройки: бот строит путь, но не ломает и не ставит блоки.
    movements.canDig = false;
    movements.canOpenDoors = true;
    movements.allow1by1towers = false;
    movements.allowSprinting = true;

    // Небольшой паркур и подъём на блоки. Названия полей есть не во всех версиях,
    // поэтому проверяем перед установкой.
    if ('allowParkour' in movements) movements.allowParkour = true;
    if ('maxDropDown' in movements) movements.maxDropDown = 1;
    if ('dontCreateFlow' in movements) movements.dontCreateFlow = true;
    if ('liquidCost' in movements) movements.liquidCost = 100;
    if ('entityCost' in movements) movements.entityCost = 1;

    bot.pathfinder.setMovements(movements);
  }

  function isBlockDangerous(block) {
    if (!block) return true;
    const name = String(block.name || '').toLowerCase();
    return name.includes('lava') || name.includes('fire') || name.includes('cactus') || name.includes('magma') || name.includes('campfire');
  }

  function nearbySafetyCheck() {
    if (!bot.entity || !bot.blockAt) return true;
    const pos = bot.entity.position;

    // Проверяем блок под ногами и рядом: если впереди яма глубже 1 блока или опасный блок — pathfinder перестроит путь.
    const offsets = [
      [0, -1, 0], [1, -1, 0], [-1, -1, 0], [0, -1, 1], [0, -1, -1],
      [1, -2, 0], [-1, -2, 0], [0, -2, 1], [0, -2, -1]
    ];

    for (const [x, y, z] of offsets) {
      const block = bot.blockAt(pos.offset(x, y, z));
      if (isBlockDangerous(block)) return false;
    }

    return true;
  }

  function goalKeyFor(entity) {
    if (!entity || !entity.position) return '';
    const p = entity.position;
    return `${Math.floor(p.x / 2)}:${Math.floor(p.y)}:${Math.floor(p.z / 2)}`;
  }

  async function tick() {
    if (!bot.entity || !bot.pathfinder) return;

    const target = api.getTargetEntity();
    if (!target || !target.position) {
      if (!warnedNoTarget) {
        api.log('Цель не найдена. Выбери игрока в UI или оставь “Ближайший игрок”.');
        warnedNoTarget = true;
      }
      bot.pathfinder.setGoal(null);
      api.stopAllMovement();
      return;
    }
    warnedNoTarget = false;

    const distance = bot.entity.position.distanceTo(target.position);
    if (distance > TARGET_TOO_FAR) {
      bot.pathfinder.setGoal(null);
      api.stopAllMovement();
      return;
    }

    try {
      if (bot.lookAt) await bot.lookAt(target.position.offset(0, LOOK_HEIGHT, 0), true);
    } catch (_) {}

    if (!nearbySafetyCheck()) {
      api.stopAllMovement();
      // Не идём напрямую, просим pathfinder пересчитать маршрут аккуратнее.
      lastGoalKey = '';
    }

    const key = goalKeyFor(target);
    if (key !== lastGoalKey || !bot.pathfinder.isMoving()) {
      lastGoalKey = key;
      bot.pathfinder.setGoal(new goals.GoalFollow(target, FOLLOW_DISTANCE), true);
    }
  }

  api.onSpawn(() => {
    safeLoadPathfinder();
    configureMovements();
    api.log('Умная ходьба включена: обход блоков, проверка ям, подъём на 1 блок, простой паркур.');
    api.every(REBUILD_EVERY_MS, tick);
  });

  api.registerCleanup(() => {
    try { if (bot.pathfinder) bot.pathfinder.setGoal(null); } catch (_) {}
    api.stopAllMovement();
    api.log('Умная ходьба выключена.');
  });
};
