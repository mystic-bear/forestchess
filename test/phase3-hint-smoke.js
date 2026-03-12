const assert = require("node:assert/strict");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const ChessState = require("../js/chess/chess-state.js");

async function main() {
  const fen = "rnbqkbnr/pppp1ppp/8/4p3/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 1 2";
  const legalMoves = new Set(ChessState.generateLegalMoves(ChessState.parseFen(fen)).map((move) => move.uci));
  const worker = new Worker(path.resolve(__dirname, "..", "worker", "ai-worker.js"));

  let sawPartial = false;
  const hint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("hint timeout")), 25000);
    worker.on("message", (message) => {
      if (message.type === "ready") {
        worker.postMessage({
          type: "getHint",
          id: "hint-smoke",
          stateVersion: 9,
          allowPartial: true,
          gameState: { fen }
        });
        return;
      }

      if (message.type === "partialHint") {
        sawPartial = true;
        return;
      }

      if (message.type === "hintResult") {
        clearTimeout(timeout);
        resolve(message.hint);
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
  assert.equal(sawPartial, true);
  assert.ok(hint);
  assert.equal(hint.availableStage, 3);
  assert.ok(Array.isArray(hint.stages));
  assert.ok(hint.stages.length >= 3);
  if (hint.moveUci) {
    assert.ok(legalMoves.has(hint.moveUci), `illegal hint move: ${hint.moveUci}`);
  }
  console.log("phase3-hint-smoke: ok", hint.moveUci || "no-move");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
