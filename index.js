const mineflayer = require("mineflayer");

const CONFIG = {
  host: process.env.MC_HOST || "localhost",
  port: parseInt(process.env.MC_PORT) || 25565,
  version: process.env.MC_VERSION || undefined,
  botCount: parseInt(process.env.BOT_COUNT) || 10,
  spawnDelay: parseInt(process.env.SPAWN_DELAY) || 200,
  prefix: process.env.BOT_PREFIX || "StressBot_",
};

const bots = [];

function createBot(index) {
  const username = `${CONFIG.prefix}${index}`;

  const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username,
    version: CONFIG.version,
    hideErrors: true,
  });

  bot._client.on("error", () => {});

  bot.once("spawn", () => {
    console.log(`[+] ${username} spawned`);
  });

  bot.on("kicked", (reason) => {
    console.log(`[!] ${username} kicked: ${reason}`);
  });

  bot.on("error", () => {});

  bot.on("end", () => {
    console.log(`[-] ${username} disconnected`);
  });

  bots.push(bot);
  return bot;
}

async function start() {
  console.log(
    `Starting ${CONFIG.botCount} bots on ${CONFIG.host}:${CONFIG.port}`,
  );

  for (let i = 0; i < CONFIG.botCount; i++) {
    createBot(i);
    if (i < CONFIG.botCount - 1) {
      await new Promise((r) => setTimeout(r, CONFIG.spawnDelay));
    }
  }
}

process.on("SIGINT", () => {
  console.log("\nDisconnecting all bots...");
  for (const bot of bots) {
    try {
      bot.quit();
    } catch (_) {}
  }
  process.exit();
});

start();
