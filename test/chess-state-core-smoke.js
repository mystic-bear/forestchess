"use strict";

const assert = require("node:assert/strict");
const ChessState = require("../js/chess/chess-state.js");

function main() {
  const initial = ChessState.createInitialState();
  assert.equal(
    ChessState.serializeFen(initial),
    ChessState.START_FEN,
    "initial state should serialize to the standard start FEN"
  );

  const customFen = "r3k2r/pppq1ppp/2npbn2/4p3/4P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 5 8";
  assert.equal(
    ChessState.serializeFen(ChessState.parseFen(customFen)),
    customFen,
    "custom FEN should round-trip cleanly"
  );

  const e4 = ChessState.parseUciMove(initial, "e2e4");
  assert.ok(e4, "e2e4 should be legal in the initial position");
  assert.equal(ChessState.moveToSan(initial, e4), "e4", "e2e4 should serialize to SAN e4");

  const afterE4 = ChessState.applyMove(initial, e4);
  assert.equal(
    ChessState.serializeFen(afterE4),
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "e2e4 should update turn, en passant, and clocks correctly"
  );

  const castleState = ChessState.parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const whiteCastle = ChessState.parseUciMove(castleState, "e1g1");
  const blackCastle = ChessState.parseUciMove(ChessState.applyMove(castleState, whiteCastle), "e8c8");

  assert.ok(whiteCastle, "white kingside castle should be legal");
  assert.ok(blackCastle, "black queenside castle should be legal after white castles");
  assert.equal(ChessState.moveToSan(castleState, whiteCastle), "O-O", "white kingside castle SAN should be O-O");
  assert.equal(
    ChessState.moveToSan(ChessState.applyMove(castleState, whiteCastle), blackCastle),
    "O-O-O",
    "black queenside castle SAN should be O-O-O"
  );

  console.log("PASS chess-state-core-smoke");
}

main();
