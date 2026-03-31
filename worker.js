const { parentPort, workerData } = require("worker_threads");
const mineflayer = require("mineflayer");
const mcData = require("minecraft-data");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");

const { config, startIndex, count } = workerData;
const bots = [];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createBot(index) {
  const username = `${config.prefix}${index}`;

  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username,
    version: config.version,
    hideErrors: true,
  });

  bot.loadPlugin(pathfinder);
  bot._client.on("error", () => {});

  bot.once("spawn", () => {
    parentPort.postMessage({ type: "spawned", username });

    const data = mcData(bot.version);
    const moves = new Movements(bot, data);
    moves.allowSprinting = true;
    bot.pathfinder.setMovements(moves);

    scheduleWander(bot);
    scheduleDig(bot, data);
  });

  bot.on("kicked", (reason) => {
    parentPort.postMessage({ type: "kicked", username, reason });
  });

  bot.on("error", () => {});

  bot.on("end", () => {
    parentPort.postMessage({ type: "disconnected", username });
  });

  bots.push(bot);
}

function scheduleWander(bot) {
  const wander = () => {
    if (!bot.entity) return;
    const pos = bot.entity.position;
    const x = pos.x + randInt(-30, 30);
    const z = pos.z + randInt(-30, 30);
    try {
      bot.pathfinder.setGoal(new goals.GoalNear(x, pos.y, z, 2), false);
    } catch (_) {}
    setTimeout(wander, randInt(5000, 15000));
  };
  setTimeout(wander, randInt(2000, 6000));
}

function scheduleDig(bot, data) {
  const breakable = new Set(
    Object.values(data.blocksByName)
      .filter((b) => b.diggable && b.hardness != null && b.hardness > 0 && b.hardness <= 2.5)
      .map((b) => b.id),
  );

  const dig = async () => {
    if (!bot.entity) return;
    try {
      const target = bot.findBlock({
        matching: (block) => breakable.has(block.type),
        maxDistance: 4,
      });
      if (target) await bot.dig(target);
    } catch (_) {}
    setTimeout(dig, randInt(4000, 12000));
  };
  setTimeout(dig, randInt(5000, 15000));
}

async function run() {
  for (let i = 0; i < count; i++) {
    createBot(startIndex + i);
    if (i < count - 1) {
      await new Promise((r) => setTimeout(r, config.spawnDelay));
    }
  }
}

parentPort.on("message", (msg) => {
  if (msg === "quit") {
    for (const bot of bots) {
      try { bot.quit(); } catch (_) {}
    }
    process.exit();
  }
});

run();
