"use strict";

const assert = require("node:assert/strict");
const ChessState = require("../js/chess/chess-state.js");
const ChessRules = require("../js/chess/rules.js");

function main() {
  const castleFen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  const castleState = ChessState.parseFen(castleFen);
  const castleMoves = ChessState.generateLegalMoves(castleState).map((move) => move.uci).sort();
  assert.ok(castleMoves.includes("e1g1"), "white kingside castle should be legal");
  assert.ok(castleMoves.includes("e1c1"), "white queenside castle should be legal");

  const enPassantGame = ChessRules.playMoves(["e2e4", "a7a6", "e4e5", "d7d5"]);
  const epMoves = ChessState.generateLegalMoves(enPassantGame.state).map((move) => move.uci);
  assert.ok(epMoves.includes("e5d6"), "en passant capture should be legal");
  const afterEnPassant = ChessRules.makeMove(enPassantGame, "e5d6");
  assert.equal(ChessState.serializeFen(afterEnPassant.state), "rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3");

  const promotionFen = "4k3/P7/8/8/8/8/7p/4K3 w - - 0 1";
  const promotionState = ChessState.parseFen(promotionFen);
  const promotionMoves = ChessState.generateLegalMoves(promotionState).filter((move) => move.from === ChessState.squareToIndex("a7"));
  assert.equal(promotionMoves.length, 4, "promotion should offer four choices");
  const queenPromotion = promotionMoves.find((move) => move.promotion === "q");
  assert.equal(ChessState.moveToSan(promotionState, queenPromotion), "a8=Q+");

  const checkmateGame = ChessRules.playMoves(["f2f3", "e7e5", "g2g4", "d8h4"]);
  const mateStatus = ChessRules.getGameStatus(checkmateGame);
  assert.equal(mateStatus.terminal, true, "fool's mate should end the game");
  assert.equal(mateStatus.reason, "checkmate");
  assert.equal(mateStatus.result, "0-1");

  const stalemateGame = ChessRules.createGame({ fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1" });
  const staleStatus = ChessRules.getGameStatus(stalemateGame);
  assert.equal(staleStatus.terminal, true, "stalemate should be terminal");
  assert.equal(staleStatus.reason, "stalemate");
  assert.equal(staleStatus.result, "1/2-1/2");

  console.log("PASS chess-special-rules-regression");
}

main();
