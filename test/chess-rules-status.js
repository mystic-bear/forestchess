"use strict";

const assert = require("node:assert/strict");
const ChessRules = require("../js/chess/rules.js");

function main() {
  const historyGame = ChessRules.playMoves(["e2e4", "e7e5", "g1f3", "b8c6"]);
  assert.equal(historyGame.history.length, 4, "history should record each ply");
  assert.deepEqual(
    historyGame.history.map((entry) => entry.san),
    ["e4", "e5", "Nf3", "Nc6"],
    "history should preserve SAN order"
  );

  const threefoldGame = ChessRules.playMoves([
    "g1f3", "g8f6",
    "f3g1", "f6g8",
    "g1f3", "g8f6",
    "f3g1", "f6g8"
  ]);
  const threefoldStatus = ChessRules.getGameStatus(threefoldGame);
  assert.equal(threefoldStatus.canClaimThreefold, true, "threefold repetition should be claimable");
  assert.equal(threefoldStatus.reason, "threefold-repetition");

  const fiftyMoveGame = ChessRules.createGame({ fen: "4k3/8/8/8/8/8/3K4/R7 w - - 100 50" });
  const fiftyStatus = ChessRules.getGameStatus(fiftyMoveGame);
  assert.equal(fiftyStatus.canClaimFiftyMove, true, "50-move draw should be claimable");
  assert.equal(fiftyStatus.reason, "fifty-move-rule");

  const bareKings = ChessRules.createGame({ fen: "8/8/8/8/8/8/4K3/7k w - - 0 1" });
  assert.equal(ChessRules.isInsufficientMaterial(bareKings), true, "king vs king should be insufficient material");

  const bishopsSameColor = ChessRules.createGame({ fen: "8/8/8/8/b7/8/2B1K3/7k w - - 0 1" });
  assert.equal(
    ChessRules.isInsufficientMaterial(bishopsSameColor),
    true,
    "same-colored bishops should be insufficient material"
  );

  const bishopAndKnight = ChessRules.createGame({ fen: "8/8/8/8/8/8/2B1K3/5N1k w - - 0 1" });
  assert.equal(
    ChessRules.isInsufficientMaterial(bishopAndKnight),
    false,
    "bishop and knight can force mate and are not insufficient material"
  );

  console.log("PASS chess-rules-status");
}

main();
