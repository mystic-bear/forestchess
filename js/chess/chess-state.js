(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChessState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const WHITE = "w";
  const BLACK = "b";
  const FILES = "abcdefgh";
  const STANDARD_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const PROMOTIONS = ["q", "r", "b", "n"];
  const KNIGHT_DELTAS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  const KING_DELTAS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  const BISHOP_DIRS = [
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  const ROOK_DIRS = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];

  function otherColor(color) {
    return color === WHITE ? BLACK : WHITE;
  }

  function fileOf(index) {
    return index % 8;
  }

  function rankOf(index) {
    return Math.floor(index / 8);
  }

  function indexFromCoords(file, rank) {
    return rank * 8 + file;
  }

  function onBoard(file, rank) {
    return file >= 0 && file < 8 && rank >= 0 && rank < 8;
  }

  function indexToSquare(index) {
    if (!Number.isInteger(index) || index < 0 || index >= 64) {
      throw new Error(`Invalid board index: ${index}`);
    }
    return `${FILES[fileOf(index)]}${8 - rankOf(index)}`;
  }

  function squareToIndex(square) {
    if (square === "-" || square == null) return -1;
    if (typeof square !== "string" || square.length !== 2) {
      throw new Error(`Invalid square: ${square}`);
    }
    const file = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    if (file < 0 || !Number.isInteger(rank) || rank < 1 || rank > 8) {
      throw new Error(`Invalid square: ${square}`);
    }
    return indexFromCoords(file, 8 - rank);
  }

  function createEmptyBoard() {
    return Array(64).fill(null);
  }

  function pieceColor(piece) {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? WHITE : BLACK;
  }

  function pieceType(piece) {
    return piece ? piece.toLowerCase() : null;
  }

  function sameMove(left, right) {
    return !!left && !!right
      && left.from === right.from
      && left.to === right.to
      && (left.promotion || null) === (right.promotion || null);
  }

  function cloneCastling(castling) {
    return {
      K: !!castling?.K,
      Q: !!castling?.Q,
      k: !!castling?.k,
      q: !!castling?.q
    };
  }

  function castlingToString(castling) {
    const text = [
      castling?.K ? "K" : "",
      castling?.Q ? "Q" : "",
      castling?.k ? "k" : "",
      castling?.q ? "q" : ""
    ].join("");
    return text || "-";
  }

  function cloneState(state) {
    return {
      board: state.board.slice(),
      turn: state.turn,
      castling: cloneCastling(state.castling),
      enPassant: state.enPassant,
      halfmoveClock: state.halfmoveClock,
      fullmoveNumber: state.fullmoveNumber
    };
  }

  function validateState(state) {
    if (!state || !Array.isArray(state.board) || state.board.length !== 64) {
      throw new Error("Invalid board state");
    }
    if (state.turn !== WHITE && state.turn !== BLACK) {
      throw new Error(`Invalid turn: ${state.turn}`);
    }

    let whiteKings = 0;
    let blackKings = 0;

    for (let index = 0; index < 64; index += 1) {
      const piece = state.board[index];
      if (!piece) continue;
      if (!/^[prnbqkPRNBQK]$/.test(piece)) {
        throw new Error(`Invalid piece: ${piece}`);
      }
      if (piece === "K") whiteKings += 1;
      if (piece === "k") blackKings += 1;
      if (pieceType(piece) === "p") {
        const rank = rankOf(index);
        if (rank === 0 || rank === 7) {
          throw new Error("Pawns cannot remain on the first or eighth rank");
        }
      }
    }

    if (whiteKings !== 1 || blackKings !== 1) {
      throw new Error("Board must contain exactly one king for each side");
    }

    if (!Number.isInteger(state.enPassant) || state.enPassant < -1 || state.enPassant >= 64) {
      throw new Error(`Invalid en passant square: ${state.enPassant}`);
    }

    if (state.enPassant >= 0) {
      const epRank = rankOf(state.enPassant);
      if (epRank !== 2 && epRank !== 5) {
        throw new Error("En passant square must be on rank 3 or 6");
      }
    }

    if (!Number.isInteger(state.halfmoveClock) || state.halfmoveClock < 0) {
      throw new Error(`Invalid halfmove clock: ${state.halfmoveClock}`);
    }

    if (!Number.isInteger(state.fullmoveNumber) || state.fullmoveNumber < 1) {
      throw new Error(`Invalid fullmove number: ${state.fullmoveNumber}`);
    }

    return state;
  }

  function parseFen(fen) {
    if (typeof fen !== "string" || !fen.trim()) {
      throw new Error("FEN must be a non-empty string");
    }

    const parts = fen.trim().split(/\s+/);
    if (parts.length !== 6) {
      throw new Error(`Invalid FEN: ${fen}`);
    }

    const [boardPart, turnPart, castlingPart, enPassantPart, halfmovePart, fullmovePart] = parts;
    const rows = boardPart.split("/");
    if (rows.length !== 8) {
      throw new Error(`Invalid FEN rows: ${fen}`);
    }

    const board = createEmptyBoard();
    let index = 0;

    rows.forEach((row) => {
      let width = 0;
      for (const token of row) {
        if (/\d/.test(token)) {
          const emptyCount = Number(token);
          width += emptyCount;
          index += emptyCount;
          continue;
        }
        if (!/^[prnbqkPRNBQK]$/.test(token)) {
          throw new Error(`Invalid FEN token: ${token}`);
        }
        board[index] = token;
        index += 1;
        width += 1;
      }
      if (width !== 8) {
        throw new Error(`Invalid FEN row width: ${row}`);
      }
    });

    const castling = { K: false, Q: false, k: false, q: false };
    if (castlingPart !== "-") {
      for (const token of castlingPart) {
        if (!Object.prototype.hasOwnProperty.call(castling, token)) {
          throw new Error(`Invalid castling token: ${token}`);
        }
        castling[token] = true;
      }
    }

    return validateState({
      board,
      turn: turnPart,
      castling,
      enPassant: squareToIndex(enPassantPart),
      halfmoveClock: Number(halfmovePart),
      fullmoveNumber: Number(fullmovePart)
    });
  }

  function serializeFen(state) {
    validateState(state);

    const rows = [];
    for (let rank = 0; rank < 8; rank += 1) {
      let empty = 0;
      let row = "";
      for (let file = 0; file < 8; file += 1) {
        const piece = state.board[indexFromCoords(file, rank)];
        if (!piece) {
          empty += 1;
          continue;
        }
        if (empty > 0) {
          row += String(empty);
          empty = 0;
        }
        row += piece;
      }
      if (empty > 0) row += String(empty);
      rows.push(row);
    }

    return [
      rows.join("/"),
      state.turn,
      castlingToString(state.castling),
      state.enPassant >= 0 ? indexToSquare(state.enPassant) : "-",
      String(state.halfmoveClock),
      String(state.fullmoveNumber)
    ].join(" ");
  }

  function createInitialState() {
    return parseFen(STANDARD_START_FEN);
  }

  function getPositionKey(state) {
    return [
      serializeBoard(state.board),
      state.turn,
      castlingToString(state.castling),
      state.enPassant >= 0 ? indexToSquare(state.enPassant) : "-"
    ].join(" ");
  }

  function serializeBoard(board) {
    const rows = [];
    for (let rank = 0; rank < 8; rank += 1) {
      let empty = 0;
      let row = "";
      for (let file = 0; file < 8; file += 1) {
        const piece = board[indexFromCoords(file, rank)];
        if (!piece) {
          empty += 1;
          continue;
        }
        if (empty > 0) {
          row += String(empty);
          empty = 0;
        }
        row += piece;
      }
      if (empty > 0) row += String(empty);
      rows.push(row);
    }
    return rows.join("/");
  }

  function findKing(state, color) {
    const king = color === WHITE ? "K" : "k";
    for (let index = 0; index < 64; index += 1) {
      if (state.board[index] === king) return index;
    }
    return -1;
  }

  function isSquareAttacked(state, square, byColor) {
    const board = state.board;
    const file = fileOf(square);
    const rank = rankOf(square);

    if (byColor === WHITE) {
      if (file > 0) {
        const attacker = square + 7;
        if (attacker < 64 && board[attacker] === "P") return true;
      }
      if (file < 7) {
        const attacker = square + 9;
        if (attacker < 64 && board[attacker] === "P") return true;
      }
    } else {
      if (file > 0) {
        const attacker = square - 9;
        if (attacker >= 0 && board[attacker] === "p") return true;
      }
      if (file < 7) {
        const attacker = square - 7;
        if (attacker >= 0 && board[attacker] === "p") return true;
      }
    }

    const knight = byColor === WHITE ? "N" : "n";
    for (const [fileDelta, rankDelta] of KNIGHT_DELTAS) {
      const nextFile = file + fileDelta;
      const nextRank = rank + rankDelta;
      if (!onBoard(nextFile, nextRank)) continue;
      const attacker = indexFromCoords(nextFile, nextRank);
      if (board[attacker] === knight) return true;
    }

    if (isSlidingAttack(board, file, rank, BISHOP_DIRS, byColor, ["b", "q"])) return true;
    if (isSlidingAttack(board, file, rank, ROOK_DIRS, byColor, ["r", "q"])) return true;

    const king = byColor === WHITE ? "K" : "k";
    for (const [fileDelta, rankDelta] of KING_DELTAS) {
      const nextFile = file + fileDelta;
      const nextRank = rank + rankDelta;
      if (!onBoard(nextFile, nextRank)) continue;
      const attacker = indexFromCoords(nextFile, nextRank);
      if (board[attacker] === king) return true;
    }

    return false;
  }

  function isSlidingAttack(board, file, rank, directions, byColor, attackers) {
    for (const [fileDelta, rankDelta] of directions) {
      let nextFile = file + fileDelta;
      let nextRank = rank + rankDelta;

      while (onBoard(nextFile, nextRank)) {
        const index = indexFromCoords(nextFile, nextRank);
        const piece = board[index];
        if (!piece) {
          nextFile += fileDelta;
          nextRank += rankDelta;
          continue;
        }
        if (pieceColor(piece) !== byColor) break;
        if (attackers.includes(pieceType(piece))) return true;
        break;
      }
    }
    return false;
  }

  function isInCheck(state, color) {
    const kingSquare = findKing(state, color);
    if (kingSquare < 0) {
      throw new Error(`Missing king for color ${color}`);
    }
    return isSquareAttacked(state, kingSquare, otherColor(color));
  }

  function createMove(state, from, to, extra = {}) {
    const piece = state.board[from];
    const promotion = extra.promotion || null;
    const captured = extra.enPassant
      ? state.board[extra.enPassantCaptureSquare]
      : state.board[to];

    return {
      from,
      to,
      piece,
      color: pieceColor(piece),
      captured: captured || null,
      promotion,
      rookFrom: extra.rookFrom ?? null,
      rookTo: extra.rookTo ?? null,
      enPassantCaptureSquare: extra.enPassantCaptureSquare ?? null,
      flags: {
        capture: !!captured,
        enPassant: !!extra.enPassant,
        castle: extra.castle || null,
        pawnDouble: !!extra.pawnDouble,
        promotion: !!promotion
      },
      uci: `${indexToSquare(from)}${indexToSquare(to)}${promotion || ""}`
    };
  }

  function generateLegalMoves(state) {
    validateState(state);
    const color = state.turn;
    const pseudoMoves = generatePseudoLegalMoves(state);
    const legalMoves = [];

    for (const move of pseudoMoves) {
      const nextState = applyMove(state, move);
      if (!isInCheck(nextState, color)) {
        legalMoves.push(move);
      }
    }

    return legalMoves;
  }

  function generatePseudoLegalMoves(state) {
    const moves = [];
    const color = state.turn;

    for (let index = 0; index < 64; index += 1) {
      const piece = state.board[index];
      if (!piece || pieceColor(piece) !== color) continue;

      switch (pieceType(piece)) {
        case "p":
          generatePawnMoves(state, index, color, moves);
          break;
        case "n":
          generateStepMoves(state, index, color, KNIGHT_DELTAS, moves);
          break;
        case "b":
          generateSlidingMoves(state, index, color, BISHOP_DIRS, moves);
          break;
        case "r":
          generateSlidingMoves(state, index, color, ROOK_DIRS, moves);
          break;
        case "q":
          generateSlidingMoves(state, index, color, BISHOP_DIRS.concat(ROOK_DIRS), moves);
          break;
        case "k":
          generateStepMoves(state, index, color, KING_DELTAS, moves);
          generateCastleMoves(state, index, color, moves);
          break;
        default:
          break;
      }
    }

    return moves;
  }

  function generatePawnMoves(state, index, color, moves) {
    const file = fileOf(index);
    const rank = rankOf(index);
    const direction = color === WHITE ? -8 : 8;
    const startRank = color === WHITE ? 6 : 1;
    const promotionRank = color === WHITE ? 0 : 7;
    const nextIndex = index + direction;

    if (nextIndex >= 0 && nextIndex < 64 && !state.board[nextIndex]) {
      if (rankOf(nextIndex) === promotionRank) {
        PROMOTIONS.forEach((promotion) => {
          moves.push(createMove(state, index, nextIndex, { promotion }));
        });
      } else {
        moves.push(createMove(state, index, nextIndex));
        const doubleStep = index + direction * 2;
        if (rank === startRank && !state.board[doubleStep]) {
          moves.push(createMove(state, index, doubleStep, { pawnDouble: true }));
        }
      }
    }

    const captureTargets = color === WHITE
      ? [
          { fileDelta: -1, indexDelta: -9 },
          { fileDelta: 1, indexDelta: -7 }
        ]
      : [
          { fileDelta: -1, indexDelta: 7 },
          { fileDelta: 1, indexDelta: 9 }
        ];

    captureTargets.forEach(({ fileDelta, indexDelta }) => {
      const nextFile = file + fileDelta;
      if (nextFile < 0 || nextFile > 7) return;
      const target = index + indexDelta;
      if (target < 0 || target >= 64) return;

      const targetPiece = state.board[target];
      const isCapture = targetPiece && pieceColor(targetPiece) === otherColor(color);
      const isEnPassant = target === state.enPassant;
      if (!isCapture && !isEnPassant) return;

      const extra = isEnPassant
        ? { enPassant: true, enPassantCaptureSquare: color === WHITE ? target + 8 : target - 8 }
        : {};

      if (rankOf(target) === promotionRank) {
        PROMOTIONS.forEach((promotion) => {
          moves.push(createMove(state, index, target, { ...extra, promotion }));
        });
        return;
      }

      moves.push(createMove(state, index, target, extra));
    });
  }

  function generateStepMoves(state, index, color, deltas, moves) {
    const file = fileOf(index);
    const rank = rankOf(index);

    deltas.forEach(([fileDelta, rankDelta]) => {
      const nextFile = file + fileDelta;
      const nextRank = rank + rankDelta;
      if (!onBoard(nextFile, nextRank)) return;
      const target = indexFromCoords(nextFile, nextRank);
      const targetPiece = state.board[target];
      if (targetPiece && pieceColor(targetPiece) === color) return;
      moves.push(createMove(state, index, target));
    });
  }

  function generateSlidingMoves(state, index, color, directions, moves) {
    const startFile = fileOf(index);
    const startRank = rankOf(index);

    directions.forEach(([fileDelta, rankDelta]) => {
      let nextFile = startFile + fileDelta;
      let nextRank = startRank + rankDelta;

      while (onBoard(nextFile, nextRank)) {
        const target = indexFromCoords(nextFile, nextRank);
        const targetPiece = state.board[target];

        if (!targetPiece) {
          moves.push(createMove(state, index, target));
        } else {
          if (pieceColor(targetPiece) !== color) {
            moves.push(createMove(state, index, target));
          }
          break;
        }

        nextFile += fileDelta;
        nextRank += rankDelta;
      }
    });
  }

  function generateCastleMoves(state, index, color, moves) {
    const board = state.board;
    if (isInCheck(state, color)) return;

    if (color === WHITE && index === squareToIndex("e1")) {
      if (state.castling.K
        && board[squareToIndex("h1")] === "R"
        && !board[squareToIndex("f1")]
        && !board[squareToIndex("g1")]
        && !isSquareAttacked(state, squareToIndex("f1"), BLACK)
        && !isSquareAttacked(state, squareToIndex("g1"), BLACK)) {
        moves.push(createMove(state, index, squareToIndex("g1"), {
          castle: "K",
          rookFrom: squareToIndex("h1"),
          rookTo: squareToIndex("f1")
        }));
      }

      if (state.castling.Q
        && board[squareToIndex("a1")] === "R"
        && !board[squareToIndex("d1")]
        && !board[squareToIndex("c1")]
        && !board[squareToIndex("b1")]
        && !isSquareAttacked(state, squareToIndex("d1"), BLACK)
        && !isSquareAttacked(state, squareToIndex("c1"), BLACK)) {
        moves.push(createMove(state, index, squareToIndex("c1"), {
          castle: "Q",
          rookFrom: squareToIndex("a1"),
          rookTo: squareToIndex("d1")
        }));
      }
    }

    if (color === BLACK && index === squareToIndex("e8")) {
      if (state.castling.k
        && board[squareToIndex("h8")] === "r"
        && !board[squareToIndex("f8")]
        && !board[squareToIndex("g8")]
        && !isSquareAttacked(state, squareToIndex("f8"), WHITE)
        && !isSquareAttacked(state, squareToIndex("g8"), WHITE)) {
        moves.push(createMove(state, index, squareToIndex("g8"), {
          castle: "k",
          rookFrom: squareToIndex("h8"),
          rookTo: squareToIndex("f8")
        }));
      }

      if (state.castling.q
        && board[squareToIndex("a8")] === "r"
        && !board[squareToIndex("d8")]
        && !board[squareToIndex("c8")]
        && !board[squareToIndex("b8")]
        && !isSquareAttacked(state, squareToIndex("d8"), WHITE)
        && !isSquareAttacked(state, squareToIndex("c8"), WHITE)) {
        moves.push(createMove(state, index, squareToIndex("c8"), {
          castle: "q",
          rookFrom: squareToIndex("a8"),
          rookTo: squareToIndex("d8")
        }));
      }
    }
  }

  function clearCastlingBySquare(castling, square, piece) {
    if (piece === "R") {
      if (square === squareToIndex("a1")) castling.Q = false;
      if (square === squareToIndex("h1")) castling.K = false;
    }
    if (piece === "r") {
      if (square === squareToIndex("a8")) castling.q = false;
      if (square === squareToIndex("h8")) castling.k = false;
    }
  }

  function applyMove(state, move) {
    const next = cloneState(state);
    const movingPiece = next.board[move.from];
    const movingType = pieceType(movingPiece);
    const movingColor = pieceColor(movingPiece);

    next.board[move.from] = null;

    if (move.flags.enPassant) {
      next.board[move.enPassantCaptureSquare] = null;
    }

    const promotedPiece = move.promotion
      ? (movingColor === WHITE ? move.promotion.toUpperCase() : move.promotion)
      : movingPiece;
    next.board[move.to] = promotedPiece;

    if (move.flags.castle) {
      next.board[move.rookTo] = next.board[move.rookFrom];
      next.board[move.rookFrom] = null;
    }

    if (movingType === "k") {
      if (movingColor === WHITE) {
        next.castling.K = false;
        next.castling.Q = false;
      } else {
        next.castling.k = false;
        next.castling.q = false;
      }
    }

    if (movingType === "r") {
      clearCastlingBySquare(next.castling, move.from, movingPiece);
    }

    if (move.captured && pieceType(move.captured) === "r") {
      const captureSquare = move.flags.enPassant ? move.enPassantCaptureSquare : move.to;
      clearCastlingBySquare(next.castling, captureSquare, move.captured);
    }

    next.enPassant = -1;
    if (movingType === "p" && Math.abs(move.to - move.from) === 16) {
      next.enPassant = Math.floor((move.to + move.from) / 2);
    }

    next.halfmoveClock = (movingType === "p" || move.captured) ? 0 : state.halfmoveClock + 1;
    next.fullmoveNumber = state.fullmoveNumber + (state.turn === BLACK ? 1 : 0);
    next.turn = otherColor(state.turn);

    return next;
  }

  function moveToUci(move) {
    return move.uci;
  }

  function parseUciMove(state, uci) {
    const normalized = String(uci || "").trim().toLowerCase();
    if (!normalized) return null;
    return generateLegalMoves(state).find((move) => move.uci === normalized) || null;
  }

  function moveToSan(state, move) {
    if (!move) throw new Error("Move is required");
    const legalMoves = generateLegalMoves(state);
    const resolvedMove = legalMoves.find((candidate) => sameMove(candidate, move));
    if (!resolvedMove) {
      throw new Error(`Illegal move: ${move.uci || move}`);
    }

    if (resolvedMove.flags.castle === "K" || resolvedMove.flags.castle === "k") {
      return appendCheckSuffix(state, resolvedMove, "O-O");
    }
    if (resolvedMove.flags.castle === "Q" || resolvedMove.flags.castle === "q") {
      return appendCheckSuffix(state, resolvedMove, "O-O-O");
    }

    const movingType = pieceType(resolvedMove.piece);
    const destination = indexToSquare(resolvedMove.to);
    const isCapture = resolvedMove.flags.capture;
    let san = movingType === "p" ? "" : resolvedMove.piece.toUpperCase();

    if (movingType === "p") {
      if (isCapture) san += FILES[fileOf(resolvedMove.from)];
    } else {
      const collisions = legalMoves.filter((candidate) =>
        !sameMove(candidate, resolvedMove)
        && candidate.to === resolvedMove.to
        && candidate.piece === resolvedMove.piece
      );

      if (collisions.length > 0) {
        const sameFileCollision = collisions.some((candidate) => fileOf(candidate.from) === fileOf(resolvedMove.from));
        const sameRankCollision = collisions.some((candidate) => rankOf(candidate.from) === rankOf(resolvedMove.from));

        if (sameFileCollision && sameRankCollision) {
          san += indexToSquare(resolvedMove.from);
        } else if (sameFileCollision) {
          san += String(8 - rankOf(resolvedMove.from));
        } else {
          san += FILES[fileOf(resolvedMove.from)];
        }
      }
    }

    if (isCapture) san += "x";
    san += destination;

    if (resolvedMove.promotion) {
      san += `=${resolvedMove.promotion.toUpperCase()}`;
    }

    return appendCheckSuffix(state, resolvedMove, san);
  }

  function appendCheckSuffix(state, move, prefix) {
    const nextState = applyMove(state, move);
    if (!isInCheck(nextState, nextState.turn)) return prefix;
    const replyMoves = generateLegalMoves(nextState);
    return `${prefix}${replyMoves.length === 0 ? "#" : "+"}`;
  }

  function perft(stateOrFen, depth) {
    const state = typeof stateOrFen === "string" ? parseFen(stateOrFen) : cloneState(stateOrFen);
    if (!Number.isInteger(depth) || depth < 0) {
      throw new Error(`Invalid perft depth: ${depth}`);
    }
    if (depth === 0) return 1;

    const legalMoves = generateLegalMoves(state);
    if (depth === 1) return legalMoves.length;

    let nodes = 0;
    for (const move of legalMoves) {
      nodes += perft(applyMove(state, move), depth - 1);
    }
    return nodes;
  }

  return {
    WHITE,
    BLACK,
    FILES,
    START_FEN: STANDARD_START_FEN,
    PROMOTIONS,
    otherColor,
    createInitialState,
    cloneState,
    validateState,
    parseFen,
    serializeFen,
    serializeBoard,
    getPositionKey,
    squareToIndex,
    indexToSquare,
    pieceColor,
    pieceType,
    findKing,
    isSquareAttacked,
    isInCheck,
    generateLegalMoves,
    applyMove,
    moveToUci,
    parseUciMove,
    moveToSan,
    perft
  };
});
