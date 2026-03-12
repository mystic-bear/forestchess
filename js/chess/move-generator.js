(function (root, factory) {
  const dependency = typeof module !== "undefined" && module.exports
    ? require("./chess-state.js")
    : root.ChessState;
  const api = factory(dependency);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChessMoveGenerator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ChessState) {
  "use strict";

  if (!ChessState) {
    throw new Error("ChessState is required before loading ChessMoveGenerator");
  }

  function generateLegalUciMoves(state) {
    return ChessState.generateLegalMoves(state).map((move) => ChessState.moveToUci(move));
  }

  function findLegalMove(state, predicate) {
    return ChessState.generateLegalMoves(state).find(predicate) || null;
  }

  return {
    generateLegalMoves: ChessState.generateLegalMoves,
    generateLegalUciMoves,
    parseUciMove: ChessState.parseUciMove,
    moveToUci: ChessState.moveToUci,
    findLegalMove,
    isSquareAttacked: ChessState.isSquareAttacked,
    isInCheck: ChessState.isInCheck
  };
});
