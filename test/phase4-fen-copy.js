const assert = require("node:assert/strict");

const { Game } = require("../js/game.js");
const ChessState = require("../js/chess/chess-state.js");

const game = new Game();
game.startFromSetup();
game.applyHumanMove({ from: ChessState.squareToIndex("e2"), to: ChessState.squareToIndex("e4") });

const fen = game.copyFen();
assert.equal(fen, game.getCurrentFen(), "copyFen should return current FEN");
assert.match(fen, /^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b KQkq e3 0 1$/);

console.log("phase4-fen-copy: ok");
