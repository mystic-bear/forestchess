const assert = require("node:assert/strict");

const { Game } = require("../js/game.js");
const { SaveManager, createMemoryStorage } = require("../js/persistence/save-manager.js");
const ChessState = require("../js/chess/chess-state.js");

const saveManager = new SaveManager({ storage: createMemoryStorage() });
const game = new Game({ saveManager });

game.startFromSetup();
game.applyHumanMove({ from: ChessState.squareToIndex("e2"), to: ChessState.squareToIndex("e4") });

assert.ok(saveManager.loadLatest(), "in-progress game should exist in latest-save");
assert.equal(saveManager.listFinishedGames().length, 0, "archive should be empty before finish");

game.applyHumanMove({ from: ChessState.squareToIndex("e7"), to: ChessState.squareToIndex("e5") });
game.applyHumanMove({ from: ChessState.squareToIndex("d1"), to: ChessState.squareToIndex("h5") });
game.applyHumanMove({ from: ChessState.squareToIndex("b8"), to: ChessState.squareToIndex("c6") });
game.applyHumanMove({ from: ChessState.squareToIndex("f1"), to: ChessState.squareToIndex("c4") });
game.applyHumanMove({ from: ChessState.squareToIndex("g8"), to: ChessState.squareToIndex("f6") });
game.applyHumanMove({ from: ChessState.squareToIndex("h5"), to: ChessState.squareToIndex("f7") });

assert.equal(game.isGameOver(), true, "game should finish");
assert.equal(saveManager.loadLatest(), null, "latest-save should be cleared after terminal archive");
assert.equal(saveManager.listFinishedGames().length, 1, "finished game should stay in archive");

console.log("phase5-archive-resume-separation: ok");
