"use strict";

(function bootstrapWorker(globalScope) {
  const isNodeRuntime = typeof process !== "undefined"
    && process.versions
    && typeof process.versions.node === "string"
    && typeof require === "function";

  let constants;
  let ChessState;
  let ChessRules;
  let StockfishAdapter;
  let CoachDispatcher;
  let ReviewDispatcher;
  let addMessageListener;
  let postMessageSafe;

  if (isNodeRuntime) {
    const { parentPort } = require("node:worker_threads");
    constants = {
      ...require("../shared/i18n.js"),
      ...require("../shared/constants.js")
    };
    ChessState = require("../js/chess/chess-state.js");
    ChessRules = require("../js/chess/rules.js");
    StockfishAdapter = require("./stockfish-adapter.js");
    CoachDispatcher = require("./coach-dispatcher.js");
    ReviewDispatcher = require("./review-dispatcher.js");
    addMessageListener = (handler) => parentPort.on("message", (data) => handler({ data }));
    postMessageSafe = (payload) => parentPort.postMessage(payload);
  } else {
    importScripts(
      "../shared/i18n.js",
      "../shared/constants.js",
      "../js/chess/chess-state.js",
      "../js/chess/rules.js",
      "stockfish-adapter.js",
      "coach-dispatcher.js",
      "review-dispatcher.js"
    );
    constants = globalScope;
    ChessState = globalScope.ChessState;
    ChessRules = globalScope.ChessRules;
    StockfishAdapter = globalScope.StockfishAdapter;
    CoachDispatcher = globalScope.CoachDispatcher;
    ReviewDispatcher = globalScope.ReviewDispatcher;
    addMessageListener = (handler) => {
      globalScope.onmessage = handler;
    };
    postMessageSafe = (payload) => globalScope.postMessage(payload);
  }

  const { AI_LEVEL_INFO, COACH_PROFILE, REVIEW_PROFILE, ENGINE_ASSET_CANDIDATES, translateUi, DEFAULT_LANGUAGE } = constants;
  let engineSessionPromise = null;
  const PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
  };

  function t(gameState, key, params = {}) {
    return translateUi((gameState && gameState.language) || DEFAULT_LANGUAGE || "ko", key, params);
  }

  function post(payload) {
    postMessageSafe(payload);
  }

  function normalizeErrorPayload(error) {
    return {
      message: error instanceof Error ? error.message : String(error || "Worker error"),
      code: error?.code || "worker-error"
    };
  }

  async function getEngineSession() {
    if (!engineSessionPromise) {
      const session = StockfishAdapter.createEngineSession({
        enginePaths: ENGINE_ASSET_CANDIDATES
      });
      engineSessionPromise = session.init().then(() => session);
    }
    return engineSessionPromise;
  }

  function buildMovePacket(fen, analysis) {
    const state = ChessState.parseFen(fen);
    let move = analysis?.bestmove ? ChessState.parseUciMove(state, analysis.bestmove) : null;
    if (!move && Array.isArray(analysis?.pv) && analysis.pv[0]) {
      move = ChessState.parseUciMove(state, analysis.pv[0]);
    }
    if (!move) {
      const legalMoves = ChessState.generateLegalMoves(state);
      move = legalMoves[0] || null;
    }
    if (!move) return null;

    return {
      uci: move.uci,
      from: ChessState.indexToSquare(move.from),
      to: ChessState.indexToSquare(move.to),
      san: ChessState.moveToSan(state, move),
      promotion: move.promotion || null,
      pieceType: ChessState.pieceType(move.piece),
      depth: analysis?.depth ?? null,
      scoreCp: analysis?.scoreCp ?? null,
      scoreMate: analysis?.scoreMate ?? null,
      enginePath: analysis?.enginePath ?? null,
      backend: analysis?.backend ?? null,
      partial: !!analysis?.partial,
      searchPhase: analysis?.searchPhase || null
    };
  }

  function getCandidateEntries(fen, analysis) {
    const state = ChessState.parseFen(fen);
    const rawEntries = Array.isArray(analysis?.multipv) && analysis.multipv.length > 0
      ? analysis.multipv
      : [analysis];

    return rawEntries.map((entry, index) => {
      const uci = entry?.move || entry?.bestmove || entry?.pv?.[0] || (index === 0 ? analysis?.bestmove : null);
      const move = uci ? ChessState.parseUciMove(state, uci) : null;
      if (!move) return null;
      return {
        rank: index + 1,
        uci,
        move,
        pv: entry?.pv || [],
        scoreCp: entry?.scoreCp ?? null,
        scoreMate: entry?.scoreMate ?? null,
        depth: entry?.depth ?? analysis?.depth ?? null
      };
    }).filter(Boolean);
  }

  function pickWeightedCandidate(candidates, weights) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const normalizedWeights = candidates.map((_, index) => {
      const weight = Array.isArray(weights) ? Number(weights[index]) : null;
      return Number.isFinite(weight) && weight > 0 ? weight : 0;
    });
    const totalWeight = normalizedWeights.reduce((sum, value) => sum + value, 0);

    if (totalWeight <= 0) {
      return candidates[0];
    }

    let roll = Math.random() * totalWeight;
    for (let index = 0; index < candidates.length; index += 1) {
      roll -= normalizedWeights[index];
      if (roll <= 0) return candidates[index];
    }
    return candidates[candidates.length - 1];
  }

  function evaluateImmediateRisk(game, candidateUci) {
    const nextGame = ChessRules.makeMove(game, candidateUci);
    const replies = ChessState.generateLegalMoves(nextGame.state);
    let mateInOne = false;
    let maxImmediateNetLoss = 0;
    let queenHang = false;

    for (let index = 0; index < replies.length; index += 1) {
      const reply = replies[index];
      if (reply.flags.capture || reply.flags.enPassant) {
        const capturedType = ChessState.pieceType(reply.captured);
        const attackerType = ChessState.pieceType(reply.piece);
        const capturedValue = PIECE_VALUES[capturedType] || 0;
        const attackerValue = PIECE_VALUES[attackerType] || 0;
        const netLoss = Math.max(0, capturedValue - attackerValue);
        if (netLoss > maxImmediateNetLoss) {
          maxImmediateNetLoss = netLoss;
        }
        if (capturedType === "q" && netLoss >= 300) {
          queenHang = true;
        }
      }

      const afterReply = ChessRules.makeMove(nextGame, reply.uci);
      const status = ChessRules.getGameStatus(afterReply);
      if (status.checkmate) {
        mateInOne = true;
        break;
      }
    }

    return {
      mateInOne,
      queenHang,
      maxImmediateNetLoss
    };
  }

  function chooseMoveFromCandidates(fen, profile, analysis) {
    const candidates = getCandidateEntries(fen, analysis);
    if (candidates.length === 0) return analysis;
    if ((profile?.multipv || 1) <= 1 || candidates.length === 1) {
      const first = candidates[0];
      return {
        ...analysis,
        bestmove: first.uci,
        pv: first.pv,
        scoreCp: first.scoreCp,
        scoreMate: first.scoreMate,
        depth: first.depth
      };
    }

    const game = ChessRules.createGame({ fen });
    const safeCandidates = candidates.filter((candidate) => {
      const risk = evaluateImmediateRisk(game, candidate.uci);
      if (profile.avoidMateInOne && risk.mateInOne) return false;
      if (Number.isFinite(profile.maxImmediateNetLoss) && risk.maxImmediateNetLoss >= profile.maxImmediateNetLoss) return false;
      return true;
    });

    const pool = safeCandidates.length > 0 ? safeCandidates : candidates;
    const selected = pickWeightedCandidate(pool, profile.choiceWeights);
    if (!selected) return analysis;

    return {
      ...analysis,
      bestmove: selected.uci,
      pv: selected.pv,
      scoreCp: selected.scoreCp,
      scoreMate: selected.scoreMate,
      depth: selected.depth
    };
  }

  function buildTerminalHint(gameState) {
    const status = ChessRules.getGameStatus({ state: ChessState.parseFen(gameState.fen) });
    const hint = CoachDispatcher.createImmediateHint(gameState);
    hint.partial = false;
    hint.searchPhase = "terminal";
    hint.summary = status.checkmate
      ? t(gameState, "coach.terminalCheckmate")
      : status.stalemate
        ? t(gameState, "coach.terminalStalemate")
        : t(gameState, "coach.terminalNoLegal");
    hint.leadText = hint.summary;
    hint.reason = status.checkmate
      ? t(gameState, "coach.terminalNoSave")
      : status.stalemate
        ? t(gameState, "coach.terminalStalemateReason")
        : t(gameState, "coach.terminalNoLegal");
    hint.steps = [t(gameState, "coach.terminalStep")];
    hint.truncationNote = null;
    return hint;
  }

  async function handleChooseMove(request) {
    const fen = String(request.gameState?.fen || "").trim();
    if (!fen) {
      const error = new Error("chooseMove requires gameState.fen");
      error.code = "analysis-missing-fen";
      throw error;
    }

    const state = ChessState.parseFen(fen);
    const legalMoves = ChessState.generateLegalMoves(state);
    if (legalMoves.length === 0) {
      post({
        type: "moveResult",
        id: request.id,
        stateVersion: request.stateVersion,
        move: null
      });
      return;
    }

    if (legalMoves.length === 1) {
      post({
        type: "moveResult",
        id: request.id,
        stateVersion: request.stateVersion,
        move: buildMovePacket(fen, { bestmove: legalMoves[0].uci, pv: [legalMoves[0].uci], depth: 0 })
      });
      return;
    }

    const level = Number(request.aiLevel) || 1;
    const profile = AI_LEVEL_INFO[level]?.engine || AI_LEVEL_INFO[3].engine;
    const session = await getEngineSession();
    let partialSent = false;
    let lastDepth = 0;

    post({
      type: "progress",
      id: request.id,
      stateVersion: request.stateVersion,
      progressMeta: {
        phase: "search-start",
        aiLevel: level
      }
    });

    const analysis = await session.analyzePosition({
      fen,
      movetime: profile.movetime,
      skillLevel: profile.skillLevel,
      multipv: profile.multipv || 1,
      onInfo: (info) => {
        if (info?.depth && info.depth > lastDepth) {
          lastDepth = info.depth;
          post({
            type: "progress",
            id: request.id,
            stateVersion: request.stateVersion,
            progressMeta: {
              phase: "search",
              depth: info.depth,
              candidate: info.pv?.[0] || null
            }
          });
        }

        if (request.allowPartial === false || partialSent) return;
        if (!info?.pv?.[0] || (info.depth || 0) < 4) return;
        partialSent = true;
        const snapshot = StockfishAdapter.createSnapshotFromInfo(info, session.backend);
        snapshot.bestmove = info.pv[0];
        snapshot.searchPhase = "candidate";
        snapshot.partial = true;
        post({
          type: "partialMove",
          id: request.id,
          stateVersion: request.stateVersion,
          move: buildMovePacket(fen, snapshot),
          searchPhase: "candidate",
          partialReason: "soft-deadline"
        });
      }
    });

    const selectedAnalysis = chooseMoveFromCandidates(fen, profile, analysis);

    post({
      type: "moveResult",
      id: request.id,
      stateVersion: request.stateVersion,
      move: buildMovePacket(fen, selectedAnalysis)
    });
  }

  async function handleGetHint(request) {
    const fen = String(request.gameState?.fen || "").trim();
    if (!fen) {
      const error = new Error("getHint requires gameState.fen");
      error.code = "analysis-missing-fen";
      throw error;
    }

    const state = ChessState.parseFen(fen);
    const legalMoves = ChessState.generateLegalMoves(state);

    post({
      type: "partialHint",
      id: request.id,
      stateVersion: request.stateVersion,
      hint: CoachDispatcher.createImmediateHint(request.gameState),
      searchPhase: "setup",
      partialReason: "engine-warmup"
    });

    if (legalMoves.length === 0) {
      post({
        type: "hintResult",
        id: request.id,
        stateVersion: request.stateVersion,
        hint: buildTerminalHint(request.gameState)
      });
      return;
    }

    const session = await getEngineSession();
    let candidateSent = false;
    let lastDepth = 0;

    const analysis = await session.analyzePosition({
      fen,
      movetime: COACH_PROFILE.movetime,
      skillLevel: COACH_PROFILE.skillLevel,
      multipv: COACH_PROFILE.multipv,
      onInfo: (info, multipv) => {
        if (info?.depth && info.depth > lastDepth) {
          lastDepth = info.depth;
          post({
            type: "progress",
            id: request.id,
            stateVersion: request.stateVersion,
            progressMeta: {
              phase: "coach-search",
              depth: info.depth,
              candidate: info.pv?.[0] || null
            }
          });
        }

        if (request.allowPartial === false || candidateSent) return;
        if (!info?.pv?.[0] || (info.depth || 0) < 4) return;
        candidateSent = true;
        post({
          type: "partialHint",
          id: request.id,
          stateVersion: request.stateVersion,
          hint: CoachDispatcher.createProgressHint(request.gameState, {
            bestmove: info.pv[0],
            pv: info.pv,
            scoreCp: info.scoreCp,
            scoreMate: info.scoreMate,
            depth: info.depth,
            multipv
          }),
          searchPhase: "candidate",
          partialReason: "soft-deadline"
        });
      }
    });

    post({
      type: "hintResult",
      id: request.id,
      stateVersion: request.stateVersion,
      hint: CoachDispatcher.buildHintPacket(request.gameState, analysis, {
        partial: false,
        searchPhase: "final",
        availableStage: 3
      })
    });
  }

  async function handleAnalyzeGame(request) {
    const target = request.reviewTarget || {};
    const initialFen = String(target.initialFen || "").trim();
    if (!initialFen) {
      const error = new Error("analyzeGame requires reviewTarget.initialFen");
      error.code = "analysis-missing-fen";
      throw error;
    }

    const moveHistoryUci = Array.isArray(target.moveHistoryUci) ? target.moveHistoryUci : [];
    const language = target.language || DEFAULT_LANGUAGE || "ko";
    const maxMoments = Math.max(1, Number(target.maxMoments) || REVIEW_PROFILE.maxMoments || 5);
    const reconstructed = moveHistoryUci.length
      ? ChessRules.playMoves(moveHistoryUci, { fen: initialFen })
      : ChessRules.createGame({ fen: initialFen });
    const history = Array.isArray(reconstructed.history) ? reconstructed.history : [];

    if (history.length === 0) {
      post({
        type: "reviewResult",
        id: request.id,
        stateVersion: request.stateVersion,
        review: ReviewDispatcher.buildReviewResult(target, [], language)
      });
      return;
    }

    const session = await getEngineSession();
    const rawMoments = [];
    const afterMoveTime = Math.max(80, Math.round((REVIEW_PROFILE.movetime || 180) * 0.7));

    for (let index = 0; index < history.length; index += 1) {
      const entry = history[index];
      const stateBefore = ChessState.parseFen(entry.fenBefore);
      const playedMove = ChessState.parseUciMove(stateBefore, entry.uci);

      const beforeAnalysis = await session.analyzePosition({
        fen: entry.fenBefore,
        movetime: REVIEW_PROFILE.movetime,
        skillLevel: REVIEW_PROFILE.skillLevel,
        multipv: REVIEW_PROFILE.multipv
      });

      const afterAnalysis = await session.analyzePosition({
        fen: entry.fenAfter,
        movetime: afterMoveTime,
        skillLevel: REVIEW_PROFILE.skillLevel,
        multipv: 1
      });

      const bestMove = beforeAnalysis.bestmove
        ? ChessState.parseUciMove(stateBefore, beforeAnalysis.bestmove)
        : null;
      const bestUci = bestMove?.uci || beforeAnalysis.bestmove || null;
      const bestSan = bestMove ? ChessState.moveToSan(stateBefore, bestMove) : null;
      const swingCp = ReviewDispatcher.computeSwingFromAnalysis(beforeAnalysis, afterAnalysis, entry);

      rawMoments.push({
        ply: entry.ply || index + 1,
        fen: entry.fenBefore,
        moveSan: entry.san || null,
        playedUci: entry.uci || null,
        bestUci,
        bestSan,
        evalBeforeCp: beforeAnalysis.scoreCp ?? null,
        evalAfterCp: afterAnalysis.scoreCp ?? null,
        swingCp,
        inCheckBefore: ChessState.isInCheck(stateBefore, stateBefore.turn),
        playedMove,
        bestMove,
        playedPieceType: playedMove?.piece ? ChessState.pieceType(playedMove.piece) : null,
        bestPieceType: bestMove?.piece ? ChessState.pieceType(bestMove.piece) : null,
        missedMate: Number.isInteger(beforeAnalysis.scoreMate) && beforeAnalysis.scoreMate > 0 && bestUci !== entry.uci
      });

      post({
        type: "progress",
        id: request.id,
        stateVersion: request.stateVersion,
        progressMeta: {
          phase: "review-analysis",
          completed: index + 1,
          total: history.length,
          candidate: entry.san || entry.uci || null
        }
      });
    }

    const interestingMoments = rawMoments
      .filter((entry) => entry.bestUci !== entry.playedUci || entry.missedMate || (entry.swingCp || 0) >= 40)
      .sort((a, b) => (b.swingCp || 0) - (a.swingCp || 0))
      .slice(0, maxMoments);

    const selectedMoments = interestingMoments.length > 0
      ? interestingMoments
      : rawMoments
        .sort((a, b) => (b.swingCp || 0) - (a.swingCp || 0))
        .slice(0, Math.min(maxMoments, rawMoments.length));

    post({
      type: "reviewResult",
      id: request.id,
      stateVersion: request.stateVersion,
      review: ReviewDispatcher.buildReviewResult(target, selectedMoments, language)
    });
  }

  async function handleRequest(event) {
    const request = event.data || {};

    try {
      if (request.type === "chooseMove") {
        await handleChooseMove(request);
        return;
      }

      if (request.type === "getHint") {
        await handleGetHint(request);
        return;
      }

      if (request.type === "analyzeGame") {
        await handleAnalyzeGame(request);
      }
    } catch (error) {
      const payload = normalizeErrorPayload(error);
      post({
        type: "error",
        id: request.id,
        stateVersion: request.stateVersion,
        message: payload.message,
        code: payload.code
      });
    }
  }

  addMessageListener(handleRequest);
  post({ type: "ready" });
})(typeof self !== "undefined" ? self : globalThis);
