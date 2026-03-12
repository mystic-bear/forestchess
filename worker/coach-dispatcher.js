(function (root, factory) {
  let constants = null;
  let ChessStateRef = null;

  if (typeof module !== "undefined" && module.exports) {
    constants = require("../shared/constants.js");
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

  function getPieceTheme(pieceType) {
    return PIECE_THEME[String(pieceType || "").toLowerCase()] || null;
  }

  function getPieceLabel(pieceType) {
    const theme = getPieceTheme(pieceType);
    if (!theme) return "piece";
    return `${theme.animal} (${theme.chess})`;
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

  function getPlanTemplate(context, move) {
    if (context.inCheck) {
      return {
        direction: "Get out of check before looking for anything ambitious.",
        reason: "The king is under attack, so only check escapes are legal.",
        threat: "Ignoring the check loses immediately."
      };
    }

    if (!move) {
      return {
        direction: "Look for the safest active move in the position.",
        reason: "The engine is still building a deeper answer.",
        threat: "Watch for loose pieces and king safety first."
      };
    }

    if (move.flags.castle) {
      return {
        direction: "Secure the king and connect the rooks.",
        reason: "Castling improves king safety and activates a rook at the same time.",
        threat: "Leaving the king in the center invites tactics."
      };
    }

    if (move.promotion) {
      return {
        direction: "Push the pawn through and convert it immediately.",
        reason: "Promotion changes the balance of the game right away.",
        threat: "Delaying the promotion can waste the biggest advantage on the board."
      };
    }

    if (move.flags.capture || move.flags.enPassant) {
      return {
        direction: "Take the clean gain while it is available.",
        reason: "The move wins material or removes a dangerous piece without breaking the position.",
        threat: "If you skip it, the opponent may save the target."
      };
    }

    if (move.piece && ChessState.pieceType(move.piece) === "p") {
      const toSquare = ChessState.indexToSquare(move.to);
      if (toSquare === "e4" || toSquare === "d4" || toSquare === "e5" || toSquare === "d5") {
        return {
          direction: "Claim the center with a useful pawn move.",
          reason: "Central pawns create room for the rest of the pieces.",
          threat: "Ignoring the center makes development harder later."
        };
      }
    }

    if (move.piece && ChessState.pieceType(move.piece) === "n") {
      return {
        direction: "Develop a knight toward active central squares.",
        reason: "Knights become much stronger when they help control the center.",
        threat: "Slow development gives the opponent easier attacks."
      };
    }

    if (move.piece && ChessState.pieceType(move.piece) === "b") {
      return {
        direction: "Improve the bishop and increase long-range pressure.",
        reason: "A developed bishop supports king safety and future tactics.",
        threat: "Passive bishops can leave key diagonals uncovered."
      };
    }

    return {
      direction: "Improve the least active piece without creating a weakness.",
      reason: "The best move makes the whole position healthier.",
      threat: "Loose or slow moves can give the opponent easy targets."
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

  function buildAlternatives(fen, analysis) {
    const entries = Array.isArray(analysis.multipv) ? analysis.multipv.slice(1, 3) : [];
    const primaryCp = analysis.scoreCp || 0;
    return entries.map((entry) => {
      const move = getMoveFromAnalysis(fen, entry.pv?.[0] || entry.bestmove || entry.move);
      const gap = Math.abs(primaryCp - (entry.scoreCp || 0));
      let note = "Playable";
      if (gap <= 20) note = "Also good";
      if (gap > 80) note = "Less safe";
      return {
        moveUci: move?.uci || null,
        moveSan: move ? getMoveSan(fen, move) : null,
        note,
        scoreCp: entry.scoreCp ?? null,
        scoreMate: entry.scoreMate ?? null
      };
    }).filter((entry) => entry.moveUci);
  }

  function createStage(level, content) {
    return {
      level,
      label: level === 1 ? "Direction" : level === 2 ? "Candidate" : "Exact move",
      title: content.title,
      summary: content.summary,
      leadText: content.leadText,
      reason: content.reason,
      steps: content.steps
    };
  }

  function buildHintPacket(gameState, analysis, options = {}) {
    const fen = gameState.fen;
    const context = getPositionContext(fen);
    const move = getMoveFromAnalysis(fen, analysis.bestmove);
    const moveSan = move ? getMoveSan(fen, move) : null;
    const template = getPlanTemplate(context, move);
    const pieceType = move?.piece ? ChessState.pieceType(move.piece) : null;
    const pieceLabel = pieceType ? getPieceLabel(pieceType) : "piece";
    const fromSquare = move ? ChessState.indexToSquare(move.from) : null;
    const toSquare = move ? ChessState.indexToSquare(move.to) : null;
    const availableStage = Math.max(1, Math.min(3, options.availableStage || 3));

    const stages = [
      createStage(1, {
        title: "Direction",
        summary: template.direction,
        leadText: template.direction,
        reason: template.reason,
        steps: [
          context.inCheck ? "Only check escapes are legal now." : "Start with king safety and loose pieces.",
          "Use the next stage if you want a piece recommendation."
        ]
      })
    ];

    if (availableStage >= 2) {
      stages.push(createStage(2, {
        title: "Candidate piece",
        summary: move ? `Start by checking ${pieceLabel}.` : "Start with the safest active piece.",
        leadText: move ? `${pieceLabel} is the first piece to inspect.` : "Check the safest active piece first.",
        reason: move
          ? `${pieceLabel} addresses the main problem without creating a new one.`
          : template.reason,
        steps: move
          ? [
              `Find ${pieceLabel} on ${fromSquare}.`,
              "Ask what it fixes: safety, center control, or defense."
            ]
          : ["Check king safety.", "Check loose pieces."]
      }));
    }

    if (availableStage >= 3) {
      stages.push(createStage(3, {
        title: "Exact move",
        summary: move ? `Play ${pieceLabel} to ${toSquare}.` : "The coach could not lock one move yet.",
        leadText: move ? `${pieceLabel} to ${toSquare}${moveSan ? ` (${moveSan})` : ""}.` : "Keep the move safe and active.",
        reason: template.reason,
        steps: move
          ? [
              `Move from ${fromSquare} to ${toSquare}.`,
              move.flags.capture || move.flags.enPassant
                ? "This removes a target while staying safe."
                : "This improves the position without adding a new weakness."
            ]
          : ["Prefer safety first.", "Develop or defend before attacking."]
      }));
    }

    const activeStage = stages[stages.length - 1];
    return {
      title: "Coach hint",
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
      alternatives: buildAlternatives(fen, analysis),
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
    const context = getPositionContext(gameState.fen);
    const template = getPlanTemplate(context, null);
    return {
      title: "Coach hint",
      summary: template.direction,
      leadText: template.direction,
      reason: template.reason,
      steps: [
        context.inCheck ? "Find a legal check escape first." : "Check king safety before attacking.",
        "Use the hint button again when the engine finishes."
      ],
      stages: [
        createStage(1, {
          title: "Direction",
          summary: template.direction,
          leadText: template.direction,
          reason: template.reason,
          steps: [
            context.inCheck ? "Only check escapes are legal now." : "Start with safety and loose pieces.",
            "The engine is still searching."
          ]
        })
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
      truncationNote: "Analysis is still running.",
      systemUnavailable: false,
      threatSummary: template.threat,
      evalCp: null,
      evalMate: null,
      depth: null
    };
  }

  function createProgressHint(gameState, infoSnapshot) {
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
      truncationNote: "The engine is still checking deeper lines."
    });
  }

  function createUnavailableHint(message) {
    return {
      title: "Coach unavailable",
      summary: "The engine could not finish the analysis.",
      leadText: "The board is still playable, but coach hints are temporarily offline.",
      reason: message || "Engine startup failed.",
      steps: ["Keep playing locally.", "Retry the hint button after the worker resets."],
      stages: [
        createStage(1, {
          title: "Direction",
          summary: "Coach is unavailable right now.",
          leadText: "The board is still playable.",
          reason: message || "Engine startup failed.",
          steps: ["Retry later.", "Continue the game without engine help."]
        })
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
