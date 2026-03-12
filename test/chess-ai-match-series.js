"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Worker } = require("node:worker_threads");

const ChessState = require("../js/chess/chess-state.js");
const ChessRules = require("../js/chess/rules.js");
const ChessPgn = require("../js/chess/pgn.js");
const ChessReview = require("../js/chess/review.js");
const StockfishAdapter = require("../worker/stockfish-adapter.js");
const {
  AI_LEVEL_INFO,
  COACH_PROFILE,
  ENGINE_ASSET_CANDIDATES
} = require("../shared/constants.js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "docs");
const DEFAULT_MAX_PLIES = 220;
const DEFAULT_SEED = Date.now();

const OPENING_LIBRARY = [
  { key: "start", name: "Start position", moves: [] },
  { key: "italian", name: "Italian Game", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"] },
  { key: "ruy_lopez", name: "Ruy Lopez", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"] },
  { key: "queens_gambit", name: "Queen's Gambit Declined", moves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"] },
  { key: "slav", name: "Slav Defense", moves: ["d2d4", "d7d5", "c2c4", "c7c6", "g1f3", "g8f6"] },
  { key: "sicilian", name: "Sicilian Defense", moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6"] },
  { key: "french", name: "French Defense", moves: ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "g8f6"] },
  { key: "caro_kann", name: "Caro-Kann", moves: ["e2e4", "c7c6", "d2d4", "d7d5", "b1c3", "d5e4", "c3e4"] },
  { key: "english", name: "English Opening", moves: ["c2c4", "e7e5", "b1c3", "g8f6", "g2g3", "d7d5"] },
  { key: "kings_indian", name: "King's Indian", moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7"] }
];

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

function parseArgs(argv) {
  const options = {
    players: null,
    games: 2,
    maxPlies: DEFAULT_MAX_PLIES,
    concurrency: Math.max(1, Math.min(2, os.cpus().length || 2)),
    language: "ko",
    outputDir: DEFAULT_OUTPUT_DIR,
    prefix: "ai_match_series",
    seed: DEFAULT_SEED
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--players" && next) {
      options.players = next.split(",").map(parsePlayerSpec).filter(Boolean);
      index += 1;
    } else if (arg === "--games" && next) {
      options.games = Math.max(1, Number(next) || options.games);
      index += 1;
    } else if (arg === "--max-plies" && next) {
      options.maxPlies = Math.max(40, Number(next) || options.maxPlies);
      index += 1;
    } else if (arg === "--concurrency" && next) {
      options.concurrency = Math.max(1, Number(next) || options.concurrency);
      index += 1;
    } else if (arg === "--language" && next) {
      options.language = String(next).toLowerCase() === "en" ? "en" : "ko";
      index += 1;
    } else if (arg === "--out-dir" && next) {
      options.outputDir = path.resolve(ROOT, next);
      index += 1;
    } else if (arg === "--prefix" && next) {
      options.prefix = String(next).trim() || options.prefix;
      index += 1;
    } else if (arg === "--seed" && next) {
      options.seed = Number.parseInt(next, 10) || options.seed;
      index += 1;
    }
  }

  if (!Array.isArray(options.players) || options.players.length !== 2) {
    throw new Error("Use --players with exactly two entries, for example --players 6,7 or --players coach,7");
  }
  return options;
}

function parsePlayerSpec(token) {
  const raw = String(token || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "coach") {
    return {
      raw: "coach",
      key: "coach",
      label: "Coach",
      kind: "coach"
    };
  }

  const level = Number(raw);
  if (!Number.isInteger(level) || level < 1 || level > 7) {
    throw new Error(`Unsupported player spec: ${token}`);
  }

  return {
    raw,
    key: `ai-${level}`,
    label: `AI-${level}`,
    kind: "ai",
    aiLevel: level
  };
}

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function average(sum, count) {
  return count > 0 ? sum / count : null;
}

function formatPercent(value) {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

class AiWorkerClient {
  constructor(workerPath) {
    this.workerPath = workerPath;
    this.worker = null;
    this.readyPromise = null;
    this.pending = new Map();
    this.requestSeq = 0;
  }

  async init() {
    if (this.readyPromise) return this.readyPromise;
    this.worker = new Worker(this.workerPath);
    this.readyPromise = new Promise((resolve, reject) => {
      const handleMessage = (message) => {
        if (message.type === "ready") {
          resolve(this);
          return;
        }
        if (message.type === "error" && !message.id) {
          reject(new Error(message.message || "worker init failed"));
          return;
        }
        this.routeMessage(message);
      };
      this.worker.on("message", handleMessage);
      this.worker.on("error", reject);
      this.worker.on("exit", (code) => {
        if (code !== 0) {
          const error = new Error(`worker exited with code ${code}`);
          for (const pending of this.pending.values()) pending.reject(error);
          this.pending.clear();
        }
      });
    });
    return this.readyPromise;
  }

  routeMessage(message) {
    const pending = this.pending.get(message.id);
    if (!pending) return;
    if (message.type === "newGameResult") {
      this.pending.delete(message.id);
      pending.resolve(message.ok === true);
      return;
    }
    if (message.type === "moveResult") {
      this.pending.delete(message.id);
      pending.resolve(message.move || null);
      return;
    }
    if (message.type === "error") {
      this.pending.delete(message.id);
      const error = new Error(message.message || "worker error");
      error.code = message.code;
      pending.reject(error);
    }
  }

  async chooseMove(gameState, spec, stateVersion) {
    await this.init();
    const id = `series_${process.pid}_${Date.now()}_${this.requestSeq += 1}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({
        type: "chooseMove",
        id,
        stateVersion,
        aiLevel: spec.aiLevel,
        allowPartial: false,
        gameState
      });
    });
  }

  async newGame() {
    await this.init();
    const id = `series_newgame_${process.pid}_${Date.now()}_${this.requestSeq += 1}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({
        type: "newGame",
        id,
        stateVersion: 0
      });
    });
  }

  async dispose() {
    if (!this.worker) return;
    for (const pending of this.pending.values()) {
      pending.reject(new Error("worker disposed"));
    }
    this.pending.clear();
    await this.worker.terminate();
    this.worker = null;
    this.readyPromise = null;
  }
}

class CoachEngineClient {
  constructor() {
    this.session = null;
  }

  async init() {
    if (this.session) return this.session;
    this.session = StockfishAdapter.createEngineSession({
      enginePaths: ENGINE_ASSET_CANDIDATES
    });
    await this.session.init();
    return this.session;
  }

  async chooseMove(gameState) {
    const session = await this.init();
    const analysis = await session.analyzePosition({
      fen: gameState.fen,
      movetime: COACH_PROFILE.movetime,
      limitStrength: COACH_PROFILE.limitStrength,
      skillLevel: COACH_PROFILE.skillLevel,
      multipv: COACH_PROFILE.multipv
    });
    return buildMovePacket(gameState.fen, analysis);
  }

  async newGame() {
    const session = await this.init();
    await session.newGame();
  }

  async dispose() {
    if (!this.session) return;
    this.session.dispose();
    this.session = null;
  }
}

function buildMovePacket(fen, analysis) {
  const state = ChessState.parseFen(fen);
  let move = analysis?.bestmove ? ChessState.parseUciMove(state, analysis.bestmove) : null;
  if (!move && Array.isArray(analysis?.pv) && analysis.pv[0]) {
    move = ChessState.parseUciMove(state, analysis.pv[0]);
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
    backend: analysis?.backend ?? null
  };
}

function createOpeningRng(seedValue) {
  let seed = Number(seedValue) >>> 0;
  if (!seed) seed = 1;
  return function next() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function chooseOpeningForJob(job, options) {
  const seedBase = `${options.seed}:${job.id}:${job.whiteSpec.key}:${job.blackSpec.key}`;
  let hash = 2166136261;
  for (let index = 0; index < seedBase.length; index += 1) {
    hash ^= seedBase.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const random = createOpeningRng(hash >>> 0);
  const selectedIndex = Math.floor(random() * OPENING_LIBRARY.length);
  return OPENING_LIBRARY[selectedIndex];
}

function applyOpening(game, opening) {
  let next = game;
  const openingLogs = [];
  for (const uci of opening.moves) {
    next = ChessRules.makeMove(next, uci);
    const historyEntry = next.history[next.history.length - 1];
    openingLogs.push({
      ply: historyEntry?.ply || next.history.length,
      turn: historyEntry?.turn || null,
      player: "Opening",
      aiLevel: null,
      fenBefore: historyEntry?.fenBefore || null,
      fenAfter: historyEntry?.fenAfter || null,
      moveUci: historyEntry?.uci || uci,
      moveSan: historyEntry?.san || null,
      from: historyEntry?.from || null,
      to: historyEntry?.to || null,
      pieceType: historyEntry?.movedPiece || null,
      capturedPiece: historyEntry?.capturedPiece || null,
      promotion: historyEntry?.promotion || null,
      latencyMs: 0,
      depth: null,
      scoreCp: null,
      scoreMate: null,
      backend: "opening-book",
      enginePath: opening.key
    });
  }
  return {
    game: next,
    moveLogs: openingLogs
  };
}

function buildGameState(game, whiteSpec, blackSpec, language) {
  const history = game.history || [];
  return {
    fen: ChessState.serializeFen(game.state),
    turn: game.state.turn,
    language,
    hintMode: false,
    stateVersion: history.length + 1,
    boardOrientation: "white",
    whitePlayerType: whiteSpec.kind === "ai" ? `AI-${whiteSpec.aiLevel}` : "COACH",
    blackPlayerType: blackSpec.kind === "ai" ? `AI-${blackSpec.aiLevel}` : "COACH",
    lastMoveSan: history.length > 0 ? history[history.length - 1].san || null : null,
    moveHistorySan: history.map((entry) => entry.san),
    moveHistoryUci: history.map((entry) => entry.uci)
  };
}

function createMoveStats() {
  return {
    moves: 0,
    totalLatencyMs: 0,
    totalDepth: 0,
    depthSamples: 0,
    totalScoreCp: 0,
    scoreSamples: 0,
    mateSamples: 0
  };
}

function registerMoveStats(target, move, latencyMs) {
  target.moves += 1;
  target.totalLatencyMs += latencyMs;
  if (Number.isFinite(move.depth)) {
    target.totalDepth += move.depth;
    target.depthSamples += 1;
  }
  if (Number.isFinite(move.scoreCp)) {
    target.totalScoreCp += move.scoreCp;
    target.scoreSamples += 1;
  }
  if (Number.isFinite(move.scoreMate)) {
    target.mateSamples += 1;
  }
}

function summarizeMoveStats(stats) {
  return {
    moves: stats.moves,
    avgLatencyMs: average(stats.totalLatencyMs, stats.moves),
    avgDepth: average(stats.totalDepth, stats.depthSamples),
    avgScoreCp: average(stats.totalScoreCp, stats.scoreSamples),
    mateSamples: stats.mateSamples
  };
}

function computeMaterialBalance(state) {
  let white = 0;
  let black = 0;
  for (const piece of state.board) {
    if (!piece) continue;
    const color = ChessState.pieceColor(piece);
    const value = PIECE_VALUES[ChessState.pieceType(piece)] || 0;
    if (color === ChessState.WHITE) white += value;
    else black += value;
  }
  return white - black;
}

function resolveTerminalResult(status, game, maxPlies) {
  if (status.terminal) {
    return {
      result: status.result,
      reason: status.reason,
      adjudicated: false
    };
  }
  if (status.canClaimThreefold) {
    return {
      result: "1/2-1/2",
      reason: "threefold-repetition",
      adjudicated: true
    };
  }
  if (status.canClaimFiftyMove) {
    return {
      result: "1/2-1/2",
      reason: "fifty-move-rule",
      adjudicated: true
    };
  }
  if ((game.history?.length || 0) >= maxPlies) {
    return {
      result: "1/2-1/2",
      reason: "max-plies-limit",
      adjudicated: true
    };
  }
  return null;
}

function buildResultState(resultInfo) {
  return {
    terminal: true,
    result: resultInfo.result,
    reason: resultInfo.reason
  };
}

function createSeriesJobs(players, games) {
  const jobs = [];
  for (let round = 0; round < games; round += 1) {
    const swap = round % 2 === 1;
    jobs.push({
      id: `series_game_${String(round + 1).padStart(3, "0")}`,
      round: round + 1,
      whiteSpec: swap ? players[1] : players[0],
      blackSpec: swap ? players[0] : players[1]
    });
  }
  return jobs;
}

function createClients(slotCount) {
  const workerPath = path.resolve(ROOT, "worker", "ai-worker.js");
  return Array.from({ length: slotCount }, () => ({
    aiClient: new AiWorkerClient(workerPath),
    coachClient: new CoachEngineClient()
  }));
}

async function chooseMoveForSpec(clientBundle, gameState, spec, stateVersion) {
  if (spec.kind === "coach") {
    return clientBundle.coachClient.chooseMove(gameState);
  }
  return clientBundle.aiClient.chooseMove(gameState, spec, stateVersion);
}

async function initClientBundle(bundle) {
  await bundle.aiClient.init();
  return bundle;
}

async function prepareNewGame(bundle) {
  await Promise.all([
    bundle.aiClient.newGame(),
    bundle.coachClient.newGame()
  ]);
}

async function disposeClientBundle(bundle) {
  await Promise.allSettled([
    bundle.aiClient.dispose(),
    bundle.coachClient.dispose()
  ]);
}

async function simulateGame(job, bundle, options) {
  await prepareNewGame(bundle);
  const opening = chooseOpeningForJob(job, options);
  const openingState = applyOpening(ChessRules.createGame(), opening);
  let game = openingState.game;
  let stateVersion = game.history.length + 1;
  const startedAt = Date.now();
  const whiteStats = createMoveStats();
  const blackStats = createMoveStats();
  const moveLogs = openingState.moveLogs.slice();
  let resultInfo = null;

  while (!resultInfo) {
    const status = ChessRules.getGameStatus(game);
    resultInfo = resolveTerminalResult(status, game, options.maxPlies);
    if (resultInfo) break;

    const turn = game.state.turn;
    const spec = turn === ChessState.WHITE ? job.whiteSpec : job.blackSpec;
    const sideStats = turn === ChessState.WHITE ? whiteStats : blackStats;
    const gameState = buildGameState(game, job.whiteSpec, job.blackSpec, options.language);
    const requestStartedAt = Date.now();
    const move = await chooseMoveForSpec(bundle, gameState, spec, stateVersion);
    const latencyMs = Date.now() - requestStartedAt;

    if (!move?.uci) {
      throw new Error(`${spec.label} returned no move in ${job.id}`);
    }

    registerMoveStats(sideStats, move, latencyMs);
    game = ChessRules.makeMove(game, move.uci);
    const historyEntry = game.history[game.history.length - 1];
    moveLogs.push({
      ply: historyEntry?.ply || game.history.length,
      turn,
      player: spec.label,
      aiLevel: spec.aiLevel || null,
      fenBefore: historyEntry?.fenBefore || null,
      fenAfter: historyEntry?.fenAfter || null,
      moveUci: historyEntry?.uci || move.uci,
      moveSan: historyEntry?.san || move.san || null,
      from: historyEntry?.from || move.from || null,
      to: historyEntry?.to || move.to || null,
      pieceType: historyEntry?.movedPiece || move.pieceType || null,
      capturedPiece: historyEntry?.capturedPiece || null,
      promotion: historyEntry?.promotion || move.promotion || null,
      latencyMs,
      depth: Number.isFinite(move.depth) ? move.depth : null,
      scoreCp: Number.isFinite(move.scoreCp) ? move.scoreCp : null,
      scoreMate: Number.isFinite(move.scoreMate) ? move.scoreMate : null,
      backend: move.backend || null,
      enginePath: move.enginePath || null
    });
    stateVersion += 1;
  }

  const finishedAt = Date.now();
  const resultState = buildResultState(resultInfo);
  const gameLike = {
    history: game.history,
    moveHistory: game.history,
    resultState,
    whitePlayerType: job.whiteSpec.label,
    blackPlayerType: job.blackSpec.label,
    language: options.language,
    initialFen: game.initialFen,
    savedAt: new Date(finishedAt).toISOString()
  };

  return {
    id: job.id,
    round: job.round,
    white: job.whiteSpec.label,
    black: job.blackSpec.label,
    whiteSpec: job.whiteSpec,
    blackSpec: job.blackSpec,
    result: resultInfo.result,
    reason: resultInfo.reason,
    adjudicated: resultInfo.adjudicated,
    plies: game.history.length,
    moveCount: Math.ceil(game.history.length / 2),
    durationMs: finishedAt - startedAt,
    finalFen: ChessState.serializeFen(game.state),
    materialBalance: computeMaterialBalance(game.state),
    summary: ChessReview.buildReviewSummary(gameLike, options.language),
    opening: {
      key: opening.key,
      name: opening.name,
      moveCount: opening.moves.length,
      moves: opening.moves.slice()
    },
    pgn: ChessPgn.buildPgn(gameLike, {
      event: "Forest Chess Match Series",
      site: "Headless",
      language: options.language,
      white: job.whiteSpec.label,
      black: job.blackSpec.label,
      savedAt: new Date(finishedAt).toISOString()
    }),
    whiteStats: summarizeMoveStats(whiteStats),
    blackStats: summarizeMoveStats(blackStats),
    moveHistorySan: game.history.map((entry) => entry.san),
    moveHistoryUci: game.history.map((entry) => entry.uci),
    moveLogs
  };
}

function getPerspectiveScore(record, label) {
  if (record.result === "1/2-1/2") return 0.5;
  if (record.white === label) return record.result === "1-0" ? 1 : 0;
  return record.result === "0-1" ? 1 : 0;
}

function createAggregate(spec) {
  return {
    label: spec.label,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    scorePoints: 0,
    whiteGames: 0,
    blackGames: 0,
    whiteScorePoints: 0,
    blackScorePoints: 0,
    totalGameMs: 0,
    totalPlies: 0,
    totalMoves: 0,
    totalMoveLatencyMs: 0,
    totalDepth: 0,
    depthSamples: 0,
    totalScoreCp: 0,
    scoreSamples: 0,
    reasons: {}
  };
}

function addReasonCounter(target, reason) {
  const key = reason || "unknown";
  target[key] = (target[key] || 0) + 1;
}

function updateAggregate(entry, record, sideKey) {
  const label = entry.label;
  const score = getPerspectiveScore(record, label);
  entry.games += 1;
  entry.scorePoints += score;
  entry.totalGameMs += record.durationMs;
  entry.totalPlies += record.plies;
  addReasonCounter(entry.reasons, record.reason);

  if (score === 1) entry.wins += 1;
  else if (score === 0.5) entry.draws += 1;
  else entry.losses += 1;

  const stats = sideKey === "white" ? record.whiteStats : record.blackStats;
  entry.totalMoves += stats.moves;
  entry.totalMoveLatencyMs += (stats.avgLatencyMs || 0) * stats.moves;
  entry.totalDepth += (stats.avgDepth || 0) * stats.moves;
  entry.depthSamples += stats.moves;
  if (stats.avgScoreCp != null) {
    entry.totalScoreCp += stats.avgScoreCp * stats.moves;
    entry.scoreSamples += stats.moves;
  }

  if (sideKey === "white") {
    entry.whiteGames += 1;
    entry.whiteScorePoints += score;
  } else {
    entry.blackGames += 1;
    entry.blackScorePoints += score;
  }
}

function buildSummary(records, players) {
  const left = createAggregate(players[0]);
  const right = createAggregate(players[1]);
  const series = {
    games: records.length,
    draws: 0,
    totalPlies: 0,
    totalGameMs: 0,
    reasons: {}
  };

  records.forEach((record) => {
    series.totalPlies += record.plies;
    series.totalGameMs += record.durationMs;
    addReasonCounter(series.reasons, record.reason);

    const leftScore = getPerspectiveScore(record, left.label);
    const rightScore = getPerspectiveScore(record, right.label);
    if (leftScore === 0.5 && rightScore === 0.5) {
      series.draws += 1;
    }

    updateAggregate(left, record, record.white === left.label ? "white" : "black");
    updateAggregate(right, record, record.white === right.label ? "white" : "black");
  });

  return {
    left: {
      ...left,
      scoreRate: average(left.scorePoints, left.games),
      whiteScoreRate: average(left.whiteScorePoints, left.whiteGames),
      blackScoreRate: average(left.blackScorePoints, left.blackGames),
      avgPlies: average(left.totalPlies, left.games),
      avgGameMs: average(left.totalGameMs, left.games),
      avgMoveLatencyMs: average(left.totalMoveLatencyMs, left.totalMoves),
      avgDepth: average(left.totalDepth, left.depthSamples),
      avgScoreCp: average(left.totalScoreCp, left.scoreSamples)
    },
    right: {
      ...right,
      scoreRate: average(right.scorePoints, right.games),
      whiteScoreRate: average(right.whiteScorePoints, right.whiteGames),
      blackScoreRate: average(right.blackScorePoints, right.blackGames),
      avgPlies: average(right.totalPlies, right.games),
      avgGameMs: average(right.totalGameMs, right.games),
      avgMoveLatencyMs: average(right.totalMoveLatencyMs, right.totalMoves),
      avgDepth: average(right.totalDepth, right.depthSamples),
      avgScoreCp: average(right.totalScoreCp, right.scoreSamples)
    },
    series: {
      games: series.games,
      draws: series.draws,
      drawRate: average(series.draws, series.games),
      avgPlies: average(series.totalPlies, series.games),
      avgGameMs: average(series.totalGameMs, series.games),
      reasons: series.reasons
    }
  };
}

function buildMarkdownReport(options, summary, records) {
  const lines = [
    "# Forest Chess Match Series",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Players: ${options.players[0].label} vs ${options.players[1].label}`,
    `- Games: ${options.games}`,
    `- Max plies: ${options.maxPlies}`,
    `- Concurrency: ${options.concurrency}`,
    `- Seed: ${options.seed}`,
    `- Opening set size: ${OPENING_LIBRARY.length}`,
    "- Raw JSON includes per-game PGN, SAN/UCI history, and move-by-move logs with FEN, depth, score, and latency.",
    "",
    "## Series Summary",
    "",
    `- ${summary.left.label}: ${formatPercent(summary.left.scoreRate)} score rate`,
    `- ${summary.right.label}: ${formatPercent(summary.right.scoreRate)} score rate`,
    `- Draw rate: ${formatPercent(summary.series.drawRate)}`,
    `- Avg plies: ${formatNumber(summary.series.avgPlies, 1)}`,
    `- Avg game ms: ${formatNumber(summary.series.avgGameMs, 1)}`,
    `- Reasons: ${Object.entries(summary.series.reasons).map(([key, value]) => `${key}:${value}`).join(", ")}`,
    "",
    "## Player Detail",
    "",
    "| Player | W | L | D | Score | White Score | Black Score | Avg Move ms | Avg Depth | Avg Score cp |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    `| ${summary.left.label} | ${summary.left.wins} | ${summary.left.losses} | ${summary.left.draws} | ${formatPercent(summary.left.scoreRate)} | ${formatPercent(summary.left.whiteScoreRate)} | ${formatPercent(summary.left.blackScoreRate)} | ${formatNumber(summary.left.avgMoveLatencyMs, 1)} | ${formatNumber(summary.left.avgDepth, 2)} | ${formatNumber(summary.left.avgScoreCp, 2)} |`,
    `| ${summary.right.label} | ${summary.right.wins} | ${summary.right.losses} | ${summary.right.draws} | ${formatPercent(summary.right.scoreRate)} | ${formatPercent(summary.right.whiteScoreRate)} | ${formatPercent(summary.right.blackScoreRate)} | ${formatNumber(summary.right.avgMoveLatencyMs, 1)} | ${formatNumber(summary.right.avgDepth, 2)} | ${formatNumber(summary.right.avgScoreCp, 2)} |`,
    "",
    "## Game List",
    "",
    "| Game | White | Black | Opening | Result | Reason | Plies | Duration ms |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  records.forEach((record) => {
    lines.push(
      `| ${record.id} | ${record.white} | ${record.black} | ${record.opening?.name || "-"} | ${record.result} | ${record.reason} | ${record.plies} | ${record.durationMs} |`
    );
  });

  return `${lines.join("\n")}\n`;
}

function buildGamesCsv(records) {
  const header = [
    "game_id",
    "round",
    "white",
    "black",
    "opening_key",
    "opening_name",
    "result",
    "reason",
    "plies",
    "move_count",
    "duration_ms",
    "white_avg_depth",
    "black_avg_depth",
    "white_avg_move_ms",
    "black_avg_move_ms"
  ];
  const lines = [header.join(",")];
  records.forEach((record) => {
    lines.push([
      record.id,
      record.round,
      record.white,
      record.black,
      record.opening?.key || "",
      record.opening?.name || "",
      record.result,
      record.reason,
      record.plies,
      record.moveCount,
      record.durationMs,
      formatNumber(record.whiteStats.avgDepth, 4),
      formatNumber(record.blackStats.avgDepth, 4),
      formatNumber(record.whiteStats.avgLatencyMs, 4),
      formatNumber(record.blackStats.avgLatencyMs, 4)
    ].join(","));
  });
  return `${lines.join("\n")}\n`;
}

function buildPgnBundle(records) {
  return records.map((record) => record.pgn.trim()).join("\n\n");
}

async function runSeries(options) {
  const jobs = createSeriesJobs(options.players, options.games);
  const bundles = createClients(options.concurrency);
  const results = [];
  let cursor = 0;

  async function loop(slot, bundle) {
    await initClientBundle(bundle);
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= jobs.length) break;
      const job = jobs[index];
      console.log(`[series ${slot}] ${job.id} start | W=${job.whiteSpec.label} B=${job.blackSpec.label}`);
      const record = await simulateGame(job, bundle, options);
      results.push(record);
      console.log(`[series ${slot}] ${job.id} done | result=${record.result} | reason=${record.reason} | plies=${record.plies} | ms=${record.durationMs}`);
    }
  }

  try {
    await Promise.all(bundles.map((bundle, index) => loop(index + 1, bundle)));
  } finally {
    await Promise.all(bundles.map((bundle) => disposeClientBundle(bundle)));
  }

  return results.sort((left, right) => left.id.localeCompare(right.id));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDirectory(options.outputDir);
  const startedAt = Date.now();
  const records = await runSeries(options);
  const summary = buildSummary(records, options.players);
  const finishedAt = Date.now();
  const timestamp = formatTimestamp(new Date(finishedAt));
  const safeLeft = options.players[0].label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const safeRight = options.players[1].label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const prefix = `${options.prefix}_${safeLeft}_vs_${safeRight}_${timestamp}`;
  const basePath = path.join(options.outputDir, prefix);

  const payload = {
    generatedAt: new Date(finishedAt).toISOString(),
    elapsedMs: finishedAt - startedAt,
    settings: {
      players: options.players,
      games: options.games,
      maxPlies: options.maxPlies,
      concurrency: options.concurrency,
      language: options.language
    },
    summary,
    games: records
  };

  fs.writeFileSync(`${basePath}.json`, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(`${basePath}.md`, buildMarkdownReport(options, summary, records), "utf8");
  fs.writeFileSync(`${basePath}.pgn`, buildPgnBundle(records), "utf8");
  fs.writeFileSync(`${basePath}_games.csv`, buildGamesCsv(records), "utf8");

  console.log(`RESULT_JSON=${basePath}.json`);
  console.log(`RESULT_MD=${basePath}.md`);
  console.log(`RESULT_PGN=${basePath}.pgn`);
  console.log(`RESULT_GAMES_CSV=${basePath}_games.csv`);
  console.log(`ELAPSED_MS=${finishedAt - startedAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
