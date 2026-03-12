const assert = require("node:assert/strict");

const { Game } = require("../js/game.js");
const { SaveManager, createMemoryStorage } = require("../js/persistence/save-manager.js");
const ChessState = require("../js/chess/chess-state.js");
const { PLAYER_ANIMALS } = require("../shared/constants.js");

assert.ok(Array.isArray(PLAYER_ANIMALS) && PLAYER_ANIMALS.length >= 16, "player animal pool should contain at least 16 entries");

const saveManager = new SaveManager({ storage: createMemoryStorage() });

const game = new Game({ saveManager });
game.setupPlayerAnimals = { white: "koala", black: "owl" };
game.startFromSetup();
game.applyHumanMove({ from: ChessState.squareToIndex("e2"), to: ChessState.squareToIndex("e4") });
game.applyHumanMove({ from: ChessState.squareToIndex("e7"), to: ChessState.squareToIndex("e5") });

const latest = saveManager.loadLatest();
assert.deepEqual(latest.setupPlayerAnimals, { white: "koala", black: "owl" }, "autosave should persist player animals");

const resumed = new Game({ saveManager });
assert.equal(resumed.resumeSavedGame(), true, "resume should succeed");
assert.deepEqual(resumed.setupPlayerAnimals, { white: "koala", black: "owl" }, "resume should restore player animals");

const archiveGame = new Game({ saveManager: new SaveManager({ storage: createMemoryStorage() }) });
archiveGame.setupPlayerAnimals = { white: "penguin", black: "tiger" };
archiveGame.startFromSetup();
archiveGame.applyHumanMove({ from: ChessState.squareToIndex("f2"), to: ChessState.squareToIndex("f3") });
archiveGame.applyHumanMove({ from: ChessState.squareToIndex("e7"), to: ChessState.squareToIndex("e5") });
archiveGame.applyHumanMove({ from: ChessState.squareToIndex("g2"), to: ChessState.squareToIndex("g4") });
archiveGame.applyHumanMove({ from: ChessState.squareToIndex("d8"), to: ChessState.squareToIndex("h4") });

const archived = archiveGame.saveManager.listFinishedGames();
assert.equal(archived.length, 1, "finished game should be archived");
assert.deepEqual(archived[0].setupPlayerAnimals, { white: "penguin", black: "tiger" }, "archive should persist player animals");

console.log("phase5-player-animals-persistence: ok");
