(function (root, factory) {
  const dependency = typeof module !== "undefined" && module.exports
    ? require("./chess-state.js")
    : root.ChessState;
  const api = factory(dependency);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChessRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ChessState) {
  "use strict";

  if (!ChessState) {
    throw new Error("ChessState is required before loading ChessRules");
  }

  function cloneGame(game) {
    return {
      initialFen: game.initialFen,
      state: ChessState.cloneState(game.state),
      history: game.history.map((entry) => ({ ...entry })),
      positionCounts: { ...game.positionCounts }
    };
  }

  function createGame(options = {}) {
    const baseState = options.state
      ? ChessState.cloneState(options.state)
      : options.fen
        ? ChessState.parseFen(options.fen)
        : ChessState.createInitialState();
    const initialFen = ChessState.serializeFen(baseState);
    const positionKey = ChessState.getPositionKey(baseState);

    return {
      initialFen,
      state: baseState,
      history: [],
      positionCounts: {
        [positionKey]: 1
      }
    };
  }

  function getCurrentState(input) {
    return input?.state ? input.state : input;
  }

  function getPositionCounts(input) {
    return input?.positionCounts || null;
  }

  function getMaterialProfile(state) {
    const pieces = {
      w: { pawns: 0, knights: 0, bishops: [], rooks: 0, queens: 0 },
      b: { pawns: 0, knights: 0, bishops: [], rooks: 0, queens: 0 }
    };

    state.board.forEach((piece, index) => {
      if (!piece) return;
      const color = ChessState.pieceColor(piece);
      const type = ChessState.pieceType(piece);
      if (type === "k") return;
      if (type === "p") pieces[color].pawns += 1;
      if (type === "n") pieces[color].knights += 1;
      if (type === "r") pieces[color].rooks += 1;
      if (type === "q") pieces[color].queens += 1;
      if (type === "b") {
        const file = index % 8;
        const rank = Math.floor(index / 8);
        pieces[color].bishops.push((file + rank) % 2);
      }
    });

    return pieces;
  }

  function hasMajorOrPawnMaterial(profile) {
    return profile.pawns > 0 || profile.rooks > 0 || profile.queens > 0;
  }

  function minorCount(profile) {
    return profile.knights + profile.bishops.length;
  }

  function isInsufficientMaterial(input) {
    const state = getCurrentState(input);
    const material = getMaterialProfile(state);
    const white = material.w;
    const black = material.b;

    if (hasMajorOrPawnMaterial(white) || hasMajorOrPawnMaterial(black)) return false;

    const whiteMinors = minorCount(white);
    const blackMinors = minorCount(black);

    if (whiteMinors === 0 && blackMinors === 0) return true;
    if (whiteMinors === 1 && blackMinors === 0 && (white.knights === 1 || white.bishops.length === 1)) return true;
    if (blackMinors === 1 && whiteMinors === 0 && (black.knights === 1 || black.bishops.length === 1)) return true;
    if (white.knights === 2 && white.bishops.length === 0 && blackMinors === 0) return true;
    if (black.knights === 2 && black.bishops.length === 0 && whiteMinors === 0) return true;

    if (white.knights === 0 && black.knights === 0 && white.bishops.length === 1 && black.bishops.length === 1) {
      return white.bishops[0] === black.bishops[0];
    }

    return false;
  }

  function getRepetitionCount(input) {
    const state = getCurrentState(input);
    const counts = getPositionCounts(input);
    const positionKey = ChessState.getPositionKey(state);
    if (counts && typeof counts[positionKey] === "number") return counts[positionKey];
    return 1;
  }

  function canClaimThreefoldRepetition(input) {
    return getRepetitionCount(input) >= 3;
  }

  function canClaimFiftyMoveDraw(input) {
    const state = getCurrentState(input);
    return state.halfmoveClock >= 100;
  }

  function getGameStatus(input) {
    const state = getCurrentState(input);
    const legalMoves = ChessState.generateLegalMoves(state);
    const inCheck = ChessState.isInCheck(state, state.turn);
    const checkmate = inCheck && legalMoves.length === 0;
    const stalemate = !inCheck && legalMoves.length === 0;
    const insufficientMaterial = isInsufficientMaterial(state);
    const canClaimThreefold = canClaimThreefoldRepetition(input);
    const canClaimFiftyMove = canClaimFiftyMoveDraw(state);

    let terminal = false;
    let result = null;
    let reason = null;

    if (checkmate) {
      terminal = true;
      result = state.turn === ChessState.WHITE ? "0-1" : "1-0";
      reason = "checkmate";
    } else if (stalemate) {
      terminal = true;
      result = "1/2-1/2";
      reason = "stalemate";
    } else if (insufficientMaterial) {
      terminal = true;
      result = "1/2-1/2";
      reason = "insufficient-material";
    } else if (canClaimThreefold) {
      reason = "threefold-repetition";
    } else if (canClaimFiftyMove) {
      reason = "fifty-move-rule";
    }

    return {
      legalMoves,
      legalMoveCount: legalMoves.length,
      inCheck,
      checkmate,
      stalemate,
      insufficientMaterial,
      canClaimThreefold,
      canClaimFiftyMove,
      terminal,
      result,
      reason
    };
  }

  function makeHistoryEntry(game, move, nextState) {
    const ply = game.history.length + 1;
    return {
      ply,
      turn: game.state.turn,
      san: ChessState.moveToSan(game.state, move),
      uci: ChessState.moveToUci(move),
      fenBefore: ChessState.serializeFen(game.state),
      fenAfter: ChessState.serializeFen(nextState),
      movedPiece: ChessState.pieceType(move.piece),
      capturedPiece: ChessState.pieceType(move.captured),
      promotion: move.promotion || null,
      from: ChessState.indexToSquare(move.from),
      to: ChessState.indexToSquare(move.to)
    };
  }

  function makeMove(game, moveOrUci) {
    const nextGame = cloneGame(game);
    const move = typeof moveOrUci === "string"
      ? ChessState.parseUciMove(nextGame.state, moveOrUci)
      : ChessState.generateLegalMoves(nextGame.state).find((candidate) => (
          candidate.from === moveOrUci.from
          && candidate.to === moveOrUci.to
          && (candidate.promotion || null) === (moveOrUci.promotion || null)
        )) || null;

    if (!move) {
      throw new Error(`Illegal move: ${moveOrUci}`);
    }

    const nextState = ChessState.applyMove(nextGame.state, move);
    const historyEntry = makeHistoryEntry(nextGame, move, nextState);
    nextGame.state = nextState;
    nextGame.history.push(historyEntry);

    const positionKey = ChessState.getPositionKey(nextState);
    nextGame.positionCounts[positionKey] = (nextGame.positionCounts[positionKey] || 0) + 1;
    return nextGame;
  }

  function playMoves(moves, options = {}) {
    let game = createGame(options);
    moves.forEach((move) => {
      game = makeMove(game, move);
    });
    return game;
  }

  return {
    createGame,
    cloneGame,
    makeMove,
    playMoves,
    getGameStatus,
    getRepetitionCount,
    canClaimThreefoldRepetition,
    canClaimFiftyMoveDraw,
    isInsufficientMaterial
  };
});
