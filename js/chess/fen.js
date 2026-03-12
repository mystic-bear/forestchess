(function (root, factory) {
  const dependency = typeof module !== "undefined" && module.exports
    ? require("./chess-state.js")
    : root.ChessState;
  const api = factory(dependency);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChessFen = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ChessState) {
  "use strict";

  if (!ChessState) {
    throw new Error("ChessState is required before loading ChessFen");
  }

  return {
    START_FEN: ChessState.START_FEN,
    parseFen: ChessState.parseFen,
    serializeFen: ChessState.serializeFen,
    serializeBoard: ChessState.serializeBoard
  };
});
