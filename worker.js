const { parentPort, workerData } = require("worker_threads");
const mineflayer = require("mineflayer");
const mcData = require("minecraft-data");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");

const { config, startIndex, count } = workerData;
const bots = [];
const RECONNECT_DELAY = 5000;
let quitting = false;

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

    try {
      const data = mcData(bot.version);
      const moves = new Movements(bot, data);
      moves.allowSprinting = true;
      bot.pathfinder.setMovements(moves);
      scheduleBehavior(bot, data);
    } catch (err) {
      parentPort.postMessage({ type: "warn", username, message: `behavior init failed: ${err.message}` });
    }
  });

  let lastReason = null;

  bot._client.on("disconnect", (packet) => {
    try { lastReason = JSON.parse(packet.reason)?.text || JSON.parse(packet.reason)?.translate || packet.reason; } catch (_) { lastReason = packet.reason; }
  });

  bot._client.on("kick_disconnect", (packet) => {
    try { lastReason = JSON.parse(packet.reason)?.text || JSON.parse(packet.reason)?.translate || packet.reason; } catch (_) { lastReason = packet.reason; }
  });

  bot.on("kicked", (reason) => {
    try { lastReason = JSON.parse(reason)?.text || JSON.parse(reason)?.translate || reason; } catch (_) { lastReason = reason; }
    parentPort.postMessage({ type: "kicked", username, reason: lastReason });
  });

  bot.on("error", (err) => {
    lastReason = err.message;
  });

  bot.on("end", (reason) => {
    const endReason = lastReason || reason || "unknown";
    parentPort.postMessage({ type: "disconnected", username, reason: endReason });
    const i = bots.indexOf(bot);
    if (i !== -1) bots.splice(i, 1);
    if (!quitting) setTimeout(() => createBot(index), RECONNECT_DELAY);
  });

  bots.push(bot);
}

function scheduleBehavior(bot, data) {
  const breakable = new Set(
    Object.values(data.blocksByName)
      .filter((b) => b.diggable && b.hardness != null && b.hardness > 0 && b.hardness <= 2.5)
      .map((b) => b.id),
  );

  const tick = () => {
    if (!bot.entity) return;

    const roll = Math.random();

    if (roll < 0.35) {
      const pos = bot.entity.position;
      const x = pos.x + randInt(-20, 20);
      const z = pos.z + randInt(-20, 20);
      try { bot.pathfinder.setGoal(new goals.GoalNear(x, pos.y, z, 2), false); } catch (_) {}
    } else if (roll < 0.50) {
      const target = bot.findBlock({ matching: (b) => breakable.has(b.type), maxDistance: 4 });
      if (target) bot.dig(target).catch(() => {});
    } else if (roll < 0.55) {
      const yaw = Math.random() * Math.PI * 2;
      bot.look(yaw, 0, false);
    }

    setTimeout(tick, randInt(3000, 20000));
  };

  setTimeout(tick, randInt(2000, 30000));
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
    quitting = true;
    for (const bot of bots) {
      try { bot.quit(); } catch (_) {}
    }
    process.exit();
  }
});

run();
