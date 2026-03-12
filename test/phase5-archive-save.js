const assert = require("node:assert/strict");

const { Game } = require("../js/game.js");
const { SaveManager, createMemoryStorage } = require("../js/persistence/save-manager.js");
const ChessState = require("../js/chess/chess-state.js");

const saveManager = new SaveManager({ storage: createMemoryStorage() });
const game = new Game({ saveManager });

game.startFromSetup();
game.applyHumanMove({ from: ChessState.squareToIndex("f2"), to: ChessState.squareToIndex("f3") });
game.applyHumanMove({ from: ChessState.squareToIndex("e7"), to: ChessState.squareToIndex("e5") });
game.applyHumanMove({ from: ChessState.squareToIndex("g2"), to: ChessState.squareToIndex("g4") });
game.applyHumanMove({ from: ChessState.squareToIndex("d8"), to: ChessState.squareToIndex("h4") });

assert.equal(game.isGameOver(), true, "game should be finished");
const archive = saveManager.listFinishedGames();
assert.equal(archive.length, 1, "finished game should be archived");
assert.equal(saveManager.loadLatest(), null, "latest save should be cleared after archival");

const loaded = saveManager.loadFinishedGame(archive[0].id);
assert.ok(loaded, "archived game should be loadable");
assert.equal(loaded.result, "0-1");

const deleted = saveManager.deleteFinishedGame(archive[0].id);
assert.equal(deleted, true, "archived game should be deletable");
assert.equal(saveManager.listFinishedGames().length, 0);

console.log("phase5-archive-save: ok");
