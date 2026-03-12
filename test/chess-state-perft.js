"use strict";

const assert = require("node:assert/strict");
const ChessState = require("../js/chess/chess-state.js");

const CASES = [
  {
    name: "startpos depth 1",
    fen: ChessState.START_FEN,
    depth: 1,
    expected: 20
  },
  {
    name: "startpos depth 2",
    fen: ChessState.START_FEN,
    depth: 2,
    expected: 400
  },
  {
    name: "startpos depth 3",
    fen: ChessState.START_FEN,
    depth: 3,
    expected: 8902
  },
  {
    name: "startpos depth 4",
    fen: ChessState.START_FEN,
    depth: 4,
    expected: 197281
  },
  {
    name: "kiwipete depth 3",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    depth: 3,
    expected: 97862
  },
  {
    name: "position 3 depth 3",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    depth: 3,
    expected: 2812
  }
];

function main() {
  CASES.forEach((testCase) => {
    const actual = ChessState.perft(testCase.fen, testCase.depth);
    assert.equal(actual, testCase.expected, `${testCase.name} should match the reference node count`);
  });

  console.log("PASS chess-state-perft");
}

main();
