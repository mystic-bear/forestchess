const assert = require("node:assert/strict");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const ChessState = require("../js/chess/chess-state.js");

async function main() {
  const worker = new Worker(path.resolve(__dirname, "..", "worker", "ai-worker.js"));

  const review = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("review analysis timeout")), 60000);
    worker.on("message", (message) => {
      if (message.type === "ready") {
        worker.postMessage({
          type: "analyzeGame",
          id: "review-smoke",
          stateVersion: 21,
          reviewTarget: {
            gameId: "review-smoke",
            initialFen: ChessState.START_FEN,
            moveHistoryUci: ["f2f3", "e7e5", "g2g4", "d8h4"],
            language: "en",
            maxMoments: 3
          }
        });
        return;
      }

      if (message.type === "reviewResult") {
        clearTimeout(timeout);
        resolve(message.review);
        return;
      }

      if (message.type === "error") {
        clearTimeout(timeout);
        const error = new Error(message.message || "worker error");
        error.code = message.code;
        reject(error);
      }
    });
    worker.on("error", reject);
  });

  await worker.terminate();
  assert.ok(review);
  assert.ok(Array.isArray(review.moments));
  assert.ok(review.moments.length >= 1, "analysis should produce at least one critical moment");
  assert.ok(review.moments[0].category);
  assert.ok(review.moments[0].theme);
  assert.ok(review.moments[0].summary);
  console.log("phase5-review-analysis-smoke: ok", review.moments.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
