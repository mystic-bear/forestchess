const assert = require("node:assert/strict");

const { Game } = require("../js/game.js");
const { SaveManager, createMemoryStorage } = require("../js/persistence/save-manager.js");
const ChessState = require("../js/chess/chess-state.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const saveManager = new SaveManager({ storage: createMemoryStorage() });
  const pendingBridge = {
    available: true,
    lastError: null,
    cancelPending() {},
    chooseMove() {
      return new Promise(() => {});
    },
    getHint() {
      return Promise.reject(new Error("unused"));
    }
  };

  const setupGame = new Game({ saveManager, aiBridge: pendingBridge });
  setupGame.setupPlayers.black = "AI-1";
  setupGame.startFromSetup();
  setupGame.applyHumanMove({
    from: ChessState.squareToIndex("e2"),
    to: ChessState.squareToIndex("e4")
  });

  const saved = saveManager.loadLatest();
  assert.ok(saved, "save should exist before resume");
  assert.equal(saved.whitePlayerType, "HUMAN");
  assert.equal(saved.blackPlayerType, "AI-1");
  assert.equal(saved.moveHistoryUci.length, 1);

  let chooseMoveCalls = 0;
  const resumeBridge = {
    available: true,
    lastError: null,
    cancelPending() {},
    chooseMove() {
      chooseMoveCalls += 1;
      return Promise.resolve({
        move: {
          uci: "e7e5"
        }
      });
    },
    getHint() {
      return Promise.reject(new Error("unused"));
    }
  };

  const resumedGame = new Game({ saveManager, aiBridge: resumeBridge });
  const ok = resumedGame.resumeSavedGame();
  assert.equal(ok, true, "resume should succeed");

  await wait(10);

  assert.equal(chooseMoveCalls, 1, "resume should restart AI thinking when it is AI to move");
  assert.equal(resumedGame.moveHistory.length, 2, "AI move should be applied after resume");
  assert.equal(resumedGame.moveHistory[1].uci, "e7e5");
  assert.equal(resumedGame.currentState.turn, "w");

  console.log("phase4-autosave-resume: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
