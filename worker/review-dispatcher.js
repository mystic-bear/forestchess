(function (root, factory) {
  let constants = null;
  let ChessStateRef = null;

  if (typeof module !== "undefined" && module.exports) {
    constants = {
      ...require("../shared/i18n.js"),
      ...require("../shared/constants.js")
    };
    ChessStateRef = require("../js/chess/chess-state.js");
  } else {
    constants = root;
    ChessStateRef = root.ChessState;
  }

  const api = factory(constants, ChessStateRef);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ReviewDispatcher = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, ChessState) {
  "use strict";

  if (!ChessState) {
    throw new Error("ReviewDispatcher requires ChessState");
  }

  const DEFAULT_LANGUAGE = constants.DEFAULT_LANGUAGE || "ko";
  const translateUi = constants.translateUi || ((language, key) => key);

  function t(language, key, params = {}) {
    return translateUi(language || DEFAULT_LANGUAGE, key, params);
  }

  function scoreValue(cp, mate) {
    if (Number.isInteger(mate)) {
      return mate > 0 ? 10000 - mate : -10000 - mate;
    }
    return Number.isFinite(cp) ? cp : 0;
  }

  function classifyCategory(moment) {
    if (moment.playedUci && moment.bestUci && moment.playedUci === moment.bestUci) {
      return "best";
    }
    if (moment.missedMate) return "blunder";
    if ((moment.swingCp || 0) >= 260) return "blunder";
    if ((moment.swingCp || 0) >= 110) return "mistake";
    return "turning-point";
  }

  function classifyTheme(moment) {
    if (moment.inCheckBefore || moment.bestMove?.flags?.castle || moment.playedPieceType === "k") {
      return "king-safety";
    }
    if (moment.ply <= 12 && (moment.playedPieceType === "q" || moment.bestPieceType === "n" || moment.bestPieceType === "b")) {
      return "development";
    }
    if (moment.bestMove?.flags?.capture && !(moment.playedMove?.flags?.capture || moment.playedMove?.flags?.enPassant)) {
      return "hanging-piece";
    }
    if (moment.bestMove?.flags?.capture || moment.bestMove?.flags?.promotion || /[+#]/.test(moment.bestSan || "")) {
      return "missed-tactic";
    }
    return moment.ply <= 12 ? "opening" : "development";
  }

  function buildSummary(moment, language) {
    const categoryLabel = t(language, `analysis.category.${moment.category}`);
    return t(language, "analysis.card.summary", {
      ply: moment.ply,
      category: categoryLabel
    });
  }

  function buildExplanation(moment, language) {
    const themeLabel = t(language, `analysis.theme.${moment.theme}`);
    return t(language, "analysis.card.explanation", {
      played: moment.moveSan || moment.playedUci || "-",
      best: moment.bestSan || moment.bestUci || "-",
      theme: themeLabel
    });
  }

  function buildRetryPrompt(language) {
    return t(language, "analysis.card.retry");
  }

  function buildMomentCard(rawMoment, language = DEFAULT_LANGUAGE) {
    const category = classifyCategory(rawMoment);
    const theme = classifyTheme(rawMoment);
    const moment = {
      ply: rawMoment.ply || 0,
      fen: rawMoment.fen,
      moveSan: rawMoment.moveSan || null,
      playedUci: rawMoment.playedUci || null,
      bestUci: rawMoment.bestUci || null,
      bestSan: rawMoment.bestSan || null,
      evalBeforeCp: Number.isFinite(rawMoment.evalBeforeCp) ? rawMoment.evalBeforeCp : null,
      evalAfterCp: Number.isFinite(rawMoment.evalAfterCp) ? rawMoment.evalAfterCp : null,
      swingCp: Number.isFinite(rawMoment.swingCp) ? rawMoment.swingCp : 0,
      category,
      theme
    };

    return {
      ...moment,
      summary: buildSummary(moment, language),
      explanation: buildExplanation(moment, language),
      retryPrompt: buildRetryPrompt(language)
    };
  }

  function buildOverall(target, moments, language = DEFAULT_LANGUAGE) {
    const historyLength = Array.isArray(target?.moveHistoryUci) ? target.moveHistoryUci.length : 0;
    const themeCounts = new Map();
    moments.forEach((moment) => {
      themeCounts.set(moment.theme, (themeCounts.get(moment.theme) || 0) + 1);
    });
    const strongestTheme = [...themeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "development";

    return {
      openingNote: historyLength <= 16
        ? t(language, "analysis.overall.openingShort")
        : t(language, "analysis.overall.opening", { theme: t(language, `analysis.theme.${strongestTheme}`) }),
      middleGameNote: t(language, "analysis.overall.middle", { theme: t(language, `analysis.theme.${strongestTheme}`) }),
      endingNote: t(language, "analysis.overall.ending")
    };
  }

  function buildReviewResult(target, rawMoments, language = DEFAULT_LANGUAGE) {
    const moments = rawMoments.map((entry) => buildMomentCard(entry, language));
    return {
      gameId: target.gameId || null,
      moments,
      overall: buildOverall(target, moments, language)
    };
  }

  function computeSwingFromAnalysis(beforeAnalysis, afterAnalysis, playedEntry) {
    const bestScore = scoreValue(beforeAnalysis?.scoreCp, beforeAnalysis?.scoreMate);
    const playedCandidate = Array.isArray(beforeAnalysis?.multipv)
      ? beforeAnalysis.multipv.find((entry) => {
          const moveUci = entry?.move || entry?.bestmove || entry?.pv?.[0] || null;
          return moveUci && moveUci === playedEntry?.uci;
        })
      : null;
    if (playedCandidate) {
      return Math.abs(bestScore - scoreValue(playedCandidate.scoreCp, playedCandidate.scoreMate));
    }
    const afterScore = scoreValue(afterAnalysis?.scoreCp, afterAnalysis?.scoreMate);
    return Math.abs(bestScore + afterScore);
  }

  return {
    buildReviewResult,
    buildMomentCard,
    computeSwingFromAnalysis
  };
});
