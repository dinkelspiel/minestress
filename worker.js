const { parentPort, workerData } = require("worker_threads");
const mineflayer = require("mineflayer");

const { config, startIndex, count } = workerData;
const bots = [];

function createBot(index) {
  const username = `${config.prefix}${index}`;

  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username,
    version: config.version,
    hideErrors: true,
  });

  bot._client.on("error", () => {});

  bot.once("spawn", () => {
    parentPort.postMessage({ type: "spawned", username });
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
