const assert = require("node:assert/strict");
const path = require("node:path");
const { Worker } = require("node:worker_threads");

async function main() {
  const workerPath = path.resolve(__dirname, "..", "worker", "ai-worker.js");
  const worker = new Worker(workerPath);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("worker ready timeout")), 15000);
    worker.on("message", (message) => {
      if (message.type !== "ready") return;
      clearTimeout(timeout);
      resolve();
    });
    worker.on("error", reject);
  });

  await worker.terminate();
  assert.ok(true);
  console.log("phase3-worker-bootstrap: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
