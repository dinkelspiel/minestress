const { Worker } = require("worker_threads");
const os = require("os");
const path = require("path");

const CONFIG = {
  host: process.env.MC_HOST || "localhost",
  port: parseInt(process.env.MC_PORT) || 25565,
  version: process.env.MC_VERSION || undefined,
  botCount: parseInt(process.env.BOT_COUNT) || 10,
  spawnDelay: parseInt(process.env.SPAWN_DELAY) || 200,
  prefix: process.env.BOT_PREFIX || "StressBot_",
  threads: parseInt(process.env.THREADS) || os.cpus().length,
};

const workers = [];

function start() {
  const threadCount = Math.min(CONFIG.threads, CONFIG.botCount);
  const perThread = Math.floor(CONFIG.botCount / threadCount);
  const remainder = CONFIG.botCount % threadCount;

  console.log(
    `Starting ${CONFIG.botCount} bots across ${threadCount} threads on ${CONFIG.host}:${CONFIG.port}`,
  );

  let offset = 0;
  for (let t = 0; t < threadCount; t++) {
    const count = perThread + (t < remainder ? 1 : 0);

    const worker = new Worker(path.join(__dirname, "worker.js"), {
      workerData: {
        config: CONFIG,
        startIndex: offset,
        count,
      },
    });

    worker.on("message", (msg) => {
      if (msg.type === "spawned") console.log(`[+] ${msg.username} spawned`);
      else if (msg.type === "kicked")
        console.log(`[!] ${msg.username} kicked: ${msg.reason}`);
      else if (msg.type === "disconnected")
        console.log(`[-] ${msg.username} disconnected`);
    });

    worker.on("error", (err) => {
      console.log(`[!] thread ${t} error: ${err.message}`);
    });

    workers.push(worker);
    offset += count;
  }
}

process.on("SIGINT", () => {
  console.log("\nDisconnecting all bots...");
  for (const w of workers) {
    w.postMessage("quit");
  }
  setTimeout(() => process.exit(), 1000);
});

start();
