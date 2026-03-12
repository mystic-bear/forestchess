(function (root, factory) {
  let deps;
  if (typeof module !== "undefined" && module.exports) {
    deps = {
      ...require("../../shared/i18n.js"),
      ...require("../../shared/utils.js"),
      ChessState: require("./chess-state.js")
    };
  } else {
    deps = root;
  }

  const api = factory(deps);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChessReview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";

  const translateUi = deps.translateUi;
  const getPlayerLabel = deps.getPlayerLabel;
  const formatStatusReason = deps.formatStatusReason;
  const ChessState = deps.ChessState;

  function t(language, key, params = {}) {
    return translateUi(language || "ko", key, params);
  }

  function getHistory(gameLike) {
    return Array.isArray(gameLike?.moveHistory)
      ? gameLike.moveHistory
      : Array.isArray(gameLike?.history)
        ? gameLike.history
        : [];
  }

  function getResultState(gameLike) {
    return gameLike?.resultState || (gameLike?.currentStatus?.terminal ? gameLike.currentStatus : null) || null;
  }

  function buildResultLine(gameLike, language) {
    const resultState = getResultState(gameLike);
    if (!resultState) return t(language, "review.resultOngoing");
    if (resultState.result === "1-0") return t(language, "review.resultWhiteWin", { reason: formatStatusReason(resultState, language) || t(language, "result.gameOver") });
    if (resultState.result === "0-1") return t(language, "review.resultBlackWin", { reason: formatStatusReason(resultState, language) || t(language, "result.gameOver") });
    return t(language, "review.resultDraw", { reason: formatStatusReason(resultState, language) || t(language, "result.draw") });
  }

  function buildTurningPointLine(gameLike, language) {
    const history = getHistory(gameLike);
    if (history.length === 0) return t(language, "review.turningPointShort");

    const earlyQueenMove = history.find((entry) => entry.movedPiece === "q" && entry.ply <= 10);
    const whiteCastled = history.some((entry) => entry.turn === "w" && /^O-O(-O)?/.test(entry.san || ""));
    const blackCastled = history.some((entry) => entry.turn === "b" && /^O-O(-O)?/.test(entry.san || ""));
    const checkMoves = history.filter((entry) => /[+#]/.test(entry.san || ""));

    if (earlyQueenMove) {
      return t(language, "review.turningPointQueen", {
        side: earlyQueenMove.turn === "w" ? getPlayerLabel("white", language) : getPlayerLabel("black", language),
        move: earlyQueenMove.san || earlyQueenMove.uci || "-"
      });
    }

    if (!whiteCastled || !blackCastled) {
      const side = !whiteCastled ? getPlayerLabel("white", language) : getPlayerLabel("black", language);
      return t(language, "review.turningPointCastle", { side });
    }

    if (checkMoves.length >= 3) {
      return t(language, "review.turningPointChecks", { count: checkMoves.length });
    }

    return t(language, "review.turningPointMoves", { count: history.length });
  }

  function buildNextTipLine(gameLike, language) {
    const history = getHistory(gameLike);
    const whiteCastled = history.some((entry) => entry.turn === "w" && /^O-O(-O)?/.test(entry.san || ""));
    const blackCastled = history.some((entry) => entry.turn === "b" && /^O-O(-O)?/.test(entry.san || ""));
    const earlyQueenMove = history.find((entry) => entry.movedPiece === "q" && entry.ply <= 10);

    if (!whiteCastled || !blackCastled) {
      return t(language, "review.tipCastle");
    }
    if (earlyQueenMove) {
      return t(language, "review.tipQueen");
    }
    if (history.length < 14) {
      return t(language, "review.tipDevelop");
    }
    return t(language, "review.tipSafety");
  }

  function buildReviewSummary(gameLike, language = "ko") {
    return [
      buildResultLine(gameLike, language),
      buildTurningPointLine(gameLike, language),
      buildNextTipLine(gameLike, language)
    ];
  }

  function buildReplayFrames(gameLike) {
    const history = getHistory(gameLike);
    const initialFen = gameLike?.chessGame?.initialFen || gameLike?.initialFen || history[0]?.fenBefore || ChessState.START_FEN;
    const frames = [{
      index: 0,
      ply: 0,
      fen: initialFen,
      san: null,
      turn: ChessState.parseFen(initialFen).turn,
      lastMove: null
    }];

    history.forEach((entry, index) => {
      frames.push({
        index: index + 1,
        ply: entry.ply || index + 1,
        fen: entry.fenAfter,
        san: entry.san || null,
        turn: ChessState.parseFen(entry.fenAfter).turn,
        lastMove: {
          san: entry.san || null,
          from: entry.from || null,
          to: entry.to || null
        }
      });
    });

    return frames;
  }

  function buildReviewLaunchPayload(moment) {
    if (!moment?.fen) return null;
    const state = ChessState.parseFen(moment.fen);
    return {
      fen: moment.fen,
      ply: moment.ply || 0,
      turn: state.turn,
      moveSan: moment.moveSan || null
    };
  }

  function buildCriticalMomentCards(analysisResult) {
    const moments = Array.isArray(analysisResult?.moments) ? analysisResult.moments : [];
    return moments.map((moment) => ({
      ...moment,
      id: `${moment.ply || 0}_${moment.playedUci || moment.bestUci || "moment"}`,
      launch: buildReviewLaunchPayload(moment)
    }));
  }

  return {
    buildReviewSummary,
    buildReplayFrames,
    buildCriticalMomentCards,
    buildReviewLaunchPayload
  };
});
