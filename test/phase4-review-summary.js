const assert = require("node:assert/strict");

const ChessRules = require("../js/chess/rules.js");
const { buildReviewSummary } = require("../js/chess/review.js");

function assertSummary(summary, label) {
  assert.ok(Array.isArray(summary), `${label}: summary should be an array`);
  assert.equal(summary.length, 3, `${label}: summary should contain three lines`);
  summary.forEach((line, index) => {
    assert.equal(typeof line, "string", `${label}: line ${index + 1} should be a string`);
    assert.ok(line.trim().length > 0, `${label}: line ${index + 1} should not be empty`);
  });
}

const checkmateGame = ChessRules.playMoves(["f2f3", "e7e5", "g2g4", "d8h4"]);
checkmateGame.resultState = {
  terminal: true,
  result: "0-1",
  reason: "checkmate"
};
assertSummary(buildReviewSummary(checkmateGame, "ko"), "checkmate");

const stalemateLike = {
  resultState: {
    terminal: true,
    result: "1/2-1/2",
    reason: "stalemate"
  },
  moveHistory: []
};
assertSummary(buildReviewSummary(stalemateLike, "ko"), "stalemate");

const fiftyMoveLike = {
  resultState: {
    terminal: true,
    result: "1/2-1/2",
    reason: "fifty-move-rule"
  },
  moveHistory: []
};
assertSummary(buildReviewSummary(fiftyMoveLike, "ko"), "fifty-move");

const repetitionLike = {
  resultState: {
    terminal: true,
    result: "1/2-1/2",
    reason: "threefold-repetition"
  },
  moveHistory: []
};
assertSummary(buildReviewSummary(repetitionLike, "ko"), "threefold");

console.log("phase4-review-summary: ok");
