const assert = require("node:assert/strict");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const ChessState = require("../js/chess/chess-state.js");

async function main() {
  const fen = "rn1qkbnr/pppb1ppp/3pp3/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 2 5";
  const legalMoves = new Set(ChessState.generateLegalMoves(ChessState.parseFen(fen)).map((move) => move.uci));
  const worker = new Worker(path.resolve(__dirname, "..", "worker", "ai-worker.js"));

  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("chooseMove timeout")), 20000);
    worker.on("message", (message) => {
      if (message.type === "ready") {
        worker.postMessage({
          type: "chooseMove",
          id: "choose-smoke",
          stateVersion: 11,
          aiLevel: 3,
          allowPartial: true,
          gameState: { fen }
        });
        return;
      }

      if (message.type === "moveResult") {
        clearTimeout(timeout);
        resolve(message.move);
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
  assert.ok(result);
  assert.ok(legalMoves.has(result.uci), `illegal move from engine: ${result.uci}`);
  assert.ok(result.san);
  console.log("phase3-choosemove-smoke: ok", result.uci, result.enginePath || "no-engine-path");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
