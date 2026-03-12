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
  root.CoachDispatcher = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, ChessState) {
  "use strict";

  if (!ChessState) {
    throw new Error("CoachDispatcher requires ChessState");
  }

  const PIECE_THEME = constants.PIECE_THEME || {};
  const DEFAULT_LANGUAGE = constants.DEFAULT_LANGUAGE || "ko";
  const translateUi = constants.translateUi || ((language, key) => key);

  function getLanguage(gameStateOrLanguage) {
    if (typeof gameStateOrLanguage === "string") return gameStateOrLanguage;
    return gameStateOrLanguage?.language || DEFAULT_LANGUAGE;
  }

  function t(gameStateOrLanguage, key, params = {}) {
    return translateUi(getLanguage(gameStateOrLanguage), key, params);
  }

  function localize(value, language = DEFAULT_LANGUAGE) {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      return value[language] ?? value[DEFAULT_LANGUAGE] ?? value.en ?? Object.values(value)[0] ?? "";
    }
    return String(value);
  }

  function getPieceTheme(pieceType) {
    return PIECE_THEME[String(pieceType || "").toLowerCase()] || null;
  }

  function getPieceLabel(pieceType, language) {
    const theme = getPieceTheme(pieceType);
    if (!theme) return language === "ko" ? "말" : "piece";
    return `${localize(theme.animal, language)} (${localize(theme.chess, language)})`;
  }

  function getMoveFromAnalysis(fen, uci) {
    if (!fen || !uci) return null;
    const state = ChessState.parseFen(fen);
    return ChessState.parseUciMove(state, uci);
  }

  function getMoveSan(fen, move) {
    if (!move) return null;
    const state = ChessState.parseFen(fen);
    return ChessState.moveToSan(state, move);
  }

  function getPositionContext(fen) {
    const state = ChessState.parseFen(fen);
    const legalMoves = ChessState.generateLegalMoves(state);
    const inCheck = ChessState.isInCheck(state, state.turn);
    return { state, legalMoves, inCheck };
  }

  function getPlanTemplate(context, move, language) {
    if (context.inCheck) {
      return {
        direction: t(language, "coach.plan.check.direction"),
        reason: t(language, "coach.plan.check.reason"),
        threat: t(language, "coach.plan.check.threat")
      };
    }

    if (!move) {
      return {
        direction: t(language, "coach.plan.generic.direction"),
        reason: t(language, "coach.partialSetup"),
        threat: t(language, "coach.plan.generic.threat")
      };
    }

    if (move.flags.castle) {
      return {
        direction: t(language, "coach.plan.castle.direction"),
        reason: t(language, "coach.plan.castle.reason"),
        threat: t(language, "coach.plan.castle.threat")
      };
    }

    if (move.promotion) {
      return {
        direction: t(language, "coach.plan.promotion.direction"),
        reason: t(language, "coach.plan.promotion.reason"),
        threat: t(language, "coach.plan.promotion.threat")
      };
    }

    if (move.flags.capture || move.flags.enPassant) {
      return {
        direction: t(language, "coach.plan.capture.direction"),
        reason: t(language, "coach.plan.capture.reason"),
        threat: t(language, "coach.plan.capture.threat")
      };
    }

    if (move.piece && ChessState.pieceType(move.piece) === "p") {
      const toSquare = ChessState.indexToSquare(move.to);
      if (toSquare === "e4" || toSquare === "d4" || toSquare === "e5" || toSquare === "d5") {
        return {
          direction: t(language, "coach.plan.centerPawn.direction"),
          reason: t(language, "coach.plan.centerPawn.reason"),
          threat: t(language, "coach.plan.centerPawn.threat")
        };
      }
    }

    if (move.piece && ChessState.pieceType(move.piece) === "n") {
      return {
        direction: t(language, "coach.plan.knight.direction"),
        reason: t(language, "coach.plan.knight.reason"),
        threat: t(language, "coach.plan.knight.threat")
      };
    }

    if (move.piece && ChessState.pieceType(move.piece) === "b") {
      return {
        direction: t(language, "coach.plan.bishop.direction"),
        reason: t(language, "coach.plan.bishop.reason"),
        threat: t(language, "coach.plan.bishop.threat")
      };
    }

    return {
      direction: t(language, "coach.plan.generic.direction"),
      reason: t(language, "coach.plan.generic.reason"),
      threat: t(language, "coach.plan.generic.threat")
    };
  }

  function classifyConfidence(analysis) {
    if (Number.isInteger(analysis.scoreMate)) return "high";
    const entries = Array.isArray(analysis.multipv) ? analysis.multipv : [];
    if (entries.length < 2) return "medium";
    const first = entries[0];
    const second = entries[1];
    if (Number.isInteger(first?.scoreMate) || Number.isInteger(second?.scoreMate)) return "high";
    const gap = Math.abs((first?.scoreCp || 0) - (second?.scoreCp || 0));
    if (gap >= 90) return "high";
    if (gap >= 30) return "medium";
    return "low";
  }

  function buildAlternatives(fen, analysis, language) {
    const entries = Array.isArray(analysis.multipv) ? analysis.multipv.slice(1, 3) : [];
    const primaryCp = analysis.scoreCp || 0;
    return entries.map((entry) => {
      const move = getMoveFromAnalysis(fen, entry.pv?.[0] || entry.bestmove || entry.move);
      const gap = Math.abs(primaryCp - (entry.scoreCp || 0));
      let note = t(language, "coach.alt.playable");
      if (gap <= 20) note = t(language, "coach.alt.alsoGood");
      if (gap > 80) note = t(language, "coach.alt.lessSafe");
      return {
        moveUci: move?.uci || null,
        moveSan: move ? getMoveSan(fen, move) : null,
        note,
        scoreCp: entry.scoreCp ?? null,
        scoreMate: entry.scoreMate ?? null
      };
    }).filter((entry) => entry.moveUci);
  }

  function createStage(level, content, language) {
    const labelKey = level === 1
      ? "coach.stage.direction"
      : level === 2
        ? "coach.stage.candidate"
        : "coach.stage.exact";

    return {
      level,
      label: t(language, labelKey),
      title: content.title,
      summary: content.summary,
      leadText: content.leadText,
      reason: content.reason,
      steps: content.steps
    };
  }

  function buildHintPacket(gameState, analysis, options = {}) {
    const fen = gameState.fen;
    const language = getLanguage(gameState);
    const context = getPositionContext(fen);
    const move = getMoveFromAnalysis(fen, analysis.bestmove);
    const moveSan = move ? getMoveSan(fen, move) : null;
    const template = getPlanTemplate(context, move, language);
    const pieceType = move?.piece ? ChessState.pieceType(move.piece) : null;
    const pieceLabel = pieceType ? getPieceLabel(pieceType, language) : (language === "ko" ? "말" : "piece");
    const fromSquare = move ? ChessState.indexToSquare(move.from) : null;
    const toSquare = move ? ChessState.indexToSquare(move.to) : null;
    const availableStage = Math.max(1, Math.min(3, options.availableStage || 3));

    const stages = [
      createStage(1, {
        title: t(language, "coach.stage.direction"),
        summary: template.direction,
        leadText: template.direction,
        reason: template.reason,
        steps: [
          context.inCheck ? t(language, "coach.step.escapeOnly") : t(language, "coach.step.safetyFirst"),
          t(language, "coach.step.useNextStage")
        ]
      }, language)
    ];

    if (availableStage >= 2) {
      stages.push(createStage(2, {
        title: t(language, "coach.stage.candidate"),
        summary: move ? t(language, "coach.summary.candidatePiece", { piece: pieceLabel }) : t(language, "coach.plan.generic.direction"),
        leadText: move ? t(language, "coach.lead.candidatePiece", { piece: pieceLabel }) : t(language, "coach.plan.generic.direction"),
        reason: move
          ? t(language, "coach.reason.candidatePiece", { piece: pieceLabel })
          : template.reason,
        steps: move
          ? [
              t(language, "coach.step.findPiece", { piece: pieceLabel, from: fromSquare }),
              t(language, "coach.step.askFix")
            ]
          : [t(language, "coach.step.checkKingSafety"), t(language, "coach.step.checkLoosePieces")]
      }, language));
    }

    if (availableStage >= 3) {
      stages.push(createStage(3, {
        title: t(language, "coach.stage.exact"),
        summary: move ? t(language, "coach.summary.exactMove", { piece: pieceLabel, to: toSquare }) : t(language, "coach.summary.noMoveYet"),
        leadText: move
          ? t(language, "coach.lead.exactMove", {
              piece: pieceLabel,
              to: toSquare,
              sanPart: moveSan ? t(language, "coach.sanPart", { san: moveSan }) : ""
            })
          : t(language, "coach.lead.keepSafe"),
        reason: template.reason,
        steps: move
          ? [
              t(language, "coach.step.movePiece", { from: fromSquare, to: toSquare }),
              move.flags.capture || move.flags.enPassant
                ? t(language, "coach.step.captureSafe")
                : t(language, "coach.step.improveSafe")
            ]
          : [t(language, "coach.step.preferSafety"), t(language, "coach.step.developBeforeAttack")]
      }, language));
    }

    const activeStage = stages[stages.length - 1];
    return {
      title: t(language, "coach.title"),
      summary: activeStage.summary,
      leadText: activeStage.leadText,
      reason: activeStage.reason,
      steps: activeStage.steps,
      stages,
      availableStage,
      from: fromSquare,
      to: toSquare,
      moveUci: move?.uci || analysis.bestmove || null,
      moveSan,
      pieceType,
      pieceLabel,
      alternatives: buildAlternatives(fen, analysis, language),
      confidence: classifyConfidence(analysis),
      partial: !!options.partial,
      searchPhase: options.searchPhase || "final",
      truncationNote: options.truncationNote || null,
      systemUnavailable: false,
      threatSummary: template.threat,
      evalCp: analysis.scoreCp ?? null,
      evalMate: analysis.scoreMate ?? null,
      depth: analysis.depth ?? null
    };
  }

  function createImmediateHint(gameState) {
    const language = getLanguage(gameState);
    const context = getPositionContext(gameState.fen);
    const template = getPlanTemplate(context, null, language);
    return {
      title: t(language, "coach.title"),
      summary: template.direction,
      leadText: template.direction,
      reason: template.reason,
      steps: [
        context.inCheck ? t(language, "coach.step.checkEscapeFirst") : t(language, "coach.step.checkKingSafety"),
        t(language, "coach.step.analysisRunning")
      ],
      stages: [
        createStage(1, {
          title: t(language, "coach.stage.direction"),
          summary: template.direction,
          leadText: template.direction,
          reason: template.reason,
          steps: [
            context.inCheck ? t(language, "coach.step.escapeOnly") : t(language, "coach.step.safetyFirst"),
            t(language, "coach.step.analysisRunning")
          ]
        }, language)
      ],
      availableStage: 1,
      from: null,
      to: null,
      moveUci: null,
      moveSan: null,
      pieceType: null,
      pieceLabel: null,
      alternatives: [],
      confidence: "medium",
      partial: true,
      searchPhase: "setup",
      truncationNote: t(language, "coach.partialSetup"),
      systemUnavailable: false,
      threatSummary: template.threat,
      evalCp: null,
      evalMate: null,
      depth: null
    };
  }

  function createProgressHint(gameState, infoSnapshot) {
    const language = getLanguage(gameState);
    const uci = infoSnapshot?.bestmove || infoSnapshot?.pv?.[0] || null;
    if (!uci) return createImmediateHint(gameState);
    return buildHintPacket(gameState, {
      bestmove: uci,
      multipv: Array.isArray(infoSnapshot?.multipv) ? infoSnapshot.multipv : [infoSnapshot],
      scoreCp: infoSnapshot?.scoreCp ?? null,
      scoreMate: infoSnapshot?.scoreMate ?? null,
      depth: infoSnapshot?.depth ?? null
    }, {
      partial: true,
      searchPhase: "candidate",
      availableStage: 2,
      truncationNote: t(language, "coach.partialDeeper")
    });
  }

  function createUnavailableHint(message, gameStateOrLanguage) {
    const language = getLanguage(gameStateOrLanguage);
    return {
      title: t(language, "coach.unavailableTitle"),
      summary: t(language, "coach.unavailableSummary"),
      leadText: t(language, "coach.unavailableLead"),
      reason: message || t(language, "coach.unavailableReason"),
      steps: [t(language, "coach.unavailableStep1"), t(language, "coach.unavailableStep2")],
      stages: [
        createStage(1, {
          title: t(language, "coach.stage.direction"),
          summary: t(language, "coach.unavailableDirection"),
          leadText: t(language, "coach.unavailablePlayable"),
          reason: message || t(language, "coach.unavailableReason"),
          steps: [t(language, "coach.unavailableRetry1"), t(language, "coach.unavailableRetry2")]
        }, language)
      ],
      availableStage: 1,
      from: null,
      to: null,
      moveUci: null,
      moveSan: null,
      pieceType: null,
      pieceLabel: null,
      alternatives: [],
      confidence: "low",
      partial: false,
      searchPhase: "unavailable",
      truncationNote: null,
      systemUnavailable: true,
      threatSummary: null,
      evalCp: null,
      evalMate: null,
      depth: null
    };
  }

  return {
    buildHintPacket,
    createImmediateHint,
    createProgressHint,
    createUnavailableHint
  };
});
