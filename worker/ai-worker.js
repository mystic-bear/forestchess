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
  let addMessageListener;
  let postMessageSafe;

  if (isNodeRuntime) {
    const { parentPort } = require("node:worker_threads");
    constants = require("../shared/constants.js");
    ChessState = require("../js/chess/chess-state.js");
    ChessRules = require("../js/chess/rules.js");
    StockfishAdapter = require("./stockfish-adapter.js");
    CoachDispatcher = require("./coach-dispatcher.js");
    addMessageListener = (handler) => parentPort.on("message", (data) => handler({ data }));
    postMessageSafe = (payload) => parentPort.postMessage(payload);
  } else {
    importScripts(
      "../shared/constants.js",
      "../js/chess/chess-state.js",
      "../js/chess/rules.js",
      "stockfish-adapter.js",
      "coach-dispatcher.js"
    );
    constants = globalScope;
    ChessState = globalScope.ChessState;
    ChessRules = globalScope.ChessRules;
    StockfishAdapter = globalScope.StockfishAdapter;
    CoachDispatcher = globalScope.CoachDispatcher;
    addMessageListener = (handler) => {
      globalScope.onmessage = handler;
    };
    postMessageSafe = (payload) => globalScope.postMessage(payload);
  }

  const { AI_LEVEL_INFO, COACH_PROFILE, ENGINE_ASSET_CANDIDATES } = constants;
  let engineSessionPromise = null;

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

  function buildTerminalHint(gameState) {
    const status = ChessRules.getGameStatus({ state: ChessState.parseFen(gameState.fen) });
    const hint = CoachDispatcher.createImmediateHint(gameState);
    hint.partial = false;
    hint.searchPhase = "terminal";
    hint.summary = status.checkmate
      ? "The game is already over by checkmate."
      : status.stalemate
        ? "The game is already drawn by stalemate."
        : "No legal move remains.";
    hint.leadText = hint.summary;
    hint.reason = status.checkmate
      ? "There is no legal move that saves the king."
      : status.stalemate
        ? "The side to move has no legal move but is not in check."
        : "No legal move remains.";
    hint.steps = ["Start a new game or review the previous move."];
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

    post({
      type: "moveResult",
      id: request.id,
      stateVersion: request.stateVersion,
      move: buildMovePacket(fen, analysis)
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

  async function handleRequest(event) {
    const request = event.data || {};

    try {
      if (request.type === "chooseMove") {
        await handleChooseMove(request);
        return;
      }

      if (request.type === "getHint") {
        await handleGetHint(request);
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
