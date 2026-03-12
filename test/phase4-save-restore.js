const assert = require("node:assert/strict");

const { Game } = require("../js/game.js");
const { SaveManager, createMemoryStorage } = require("../js/persistence/save-manager.js");
const ChessState = require("../js/chess/chess-state.js");

const saveManager = new SaveManager({ storage: createMemoryStorage() });

const game = new Game({ saveManager });
game.startFromSetup();
game.applyHumanMove({ from: ChessState.squareToIndex("e2"), to: ChessState.squareToIndex("e4") });
game.applyHumanMove({ from: ChessState.squareToIndex("e7"), to: ChessState.squareToIndex("e5") });
game.applyHumanMove({ from: ChessState.squareToIndex("g1"), to: ChessState.squareToIndex("f3") });

const saved = saveManager.loadLatest();
assert.ok(saved, "latest save should exist");
assert.equal(saved.moveHistoryUci.length, 3);

const resumed = new Game({ saveManager });
const ok = resumed.resumeSavedGame();
assert.equal(ok, true, "resume should succeed");
assert.equal(resumed.getCurrentFen(), game.getCurrentFen(), "resumed FEN should match");
assert.equal(resumed.moveHistory.length, game.moveHistory.length, "history length should match");
assert.equal(resumed.currentState.turn, game.currentState.turn, "side to move should match");

console.log("phase4-save-restore: ok");
