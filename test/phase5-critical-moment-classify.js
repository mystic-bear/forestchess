const assert = require("node:assert/strict");

const ReviewDispatcher = require("../worker/review-dispatcher.js");

const card = ReviewDispatcher.buildMomentCard({
  ply: 17,
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
  moveSan: "g4",
  playedUci: "g2g4",
  bestUci: "g2g3",
  bestSan: "g3",
  evalBeforeCp: 40,
  evalAfterCp: 260,
  swingCp: 320,
  inCheckBefore: true,
  playedPieceType: "p",
  bestPieceType: "k",
  bestMove: { flags: { castle: true } },
  playedMove: { flags: {} },
  missedMate: true
}, "ko");

assert.ok(card.category, "category should be assigned");
assert.ok(card.theme, "theme should be assigned");
assert.ok(card.summary.trim().length > 0);
assert.ok(card.explanation.trim().length > 0);
assert.equal(card.category, "blunder");
assert.equal(card.theme, "king-safety");

console.log("phase5-critical-moment-classify: ok");
