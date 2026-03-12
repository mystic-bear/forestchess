const assert = require("node:assert/strict");

const { Game } = require("../js/game.js");
const ChessState = require("../js/chess/chess-state.js");

const game = new Game();
game.startFromSetup();
game.applyHumanMove({ from: ChessState.squareToIndex("e2"), to: ChessState.squareToIndex("e4") });
game.applyHumanMove({ from: ChessState.squareToIndex("e7"), to: ChessState.squareToIndex("e5") });
game.applyHumanMove({ from: ChessState.squareToIndex("g1"), to: ChessState.squareToIndex("f3") });

const pgn = game.buildPgnText();
assert.match(pgn, /\[Event "Forest Chess Casual"\]/);
assert.match(pgn, /\[White "사람"|\[White "Human"/);
assert.match(pgn, /\[Result "\*"\]/);
assert.match(pgn, /1\. e4 e5 2\. Nf3 \*/);

console.log("phase4-pgn-export: ok");
