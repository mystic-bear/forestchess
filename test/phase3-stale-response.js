const assert = require("node:assert/strict");
const { Game } = require("../js/game.js");

function createNoopUi() {
  return {
    updateAll() {},
    showScreen() {},
    hideSetup() {},
    renderStart() {},
    renderSetup() {},
    toast() {}
  };
}

class FakeBridge {
  constructor() {
    this.available = true;
    this.lastError = null;
    this.pendingHint = null;
  }

  chooseMove() {
    return Promise.reject(new Error("chooseMove not used in stale test"));
  }

  getHint(gameState, stateVersion) {
    return new Promise((resolve, reject) => {
      this.pendingHint = { gameState, stateVersion, resolve, reject };
    });
  }

  cancelPending() {}
}

async function main() {
  const bridge = new FakeBridge();
  const game = new Game({ aiBridge: bridge, ui: createNoopUi() });
  game.startFromSetup();

  const oldVersion = game.stateVersion;
  game.requestHint();
  assert.ok(game.lastHintSession);
  assert.equal(game.lastHintSession.stateVersion, oldVersion);

  const move = game.currentLegalMoves[0];
  game.applyHumanMove(move);
  const newVersion = game.stateVersion;
  assert.notEqual(newVersion, oldVersion);
  assert.equal(game.lastHintSession, null);

  bridge.pendingHint.resolve({
    stateVersion: oldVersion,
    hint: {
      availableStage: 3,
      stages: [
        { level: 1, summary: "old", leadText: "old", reason: "old", steps: [] }
      ]
    }
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(game.stateVersion, newVersion);
  assert.equal(game.lastHintSession, null);
  console.log("phase3-stale-response: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
