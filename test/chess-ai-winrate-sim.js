"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Worker } = require("node:worker_threads");

const ChessState = require("../js/chess/chess-state.js");
const ChessRules = require("../js/chess/rules.js");
const ChessPgn = require("../js/chess/pgn.js");
const ChessReview = require("../js/chess/review.js");
const { AI_LEVEL_INFO } = require("../shared/constants.js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_LEVELS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "docs");

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
    levels: DEFAULT_LEVELS.slice(),
    gamesPerPair: 2,
    maxPlies: 140,
    concurrency: Math.max(1, Math.min(2, os.cpus().length || 2)),
    language: "ko",
    outputDir: DEFAULT_OUTPUT_DIR,
    prefix: "ai_winrate_matrix"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--levels" && next) {
      options.levels = next.split(",").map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
      index += 1;
    } else if ((arg === "--games" || arg === "--games-per-pair") && next) {
      options.gamesPerPair = Math.max(1, Number(next) || options.gamesPerPair);
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
    }
  }

  options.levels = [...new Set(options.levels)].sort((left, right) => left - right);
  if (options.levels.length < 2) {
    throw new Error("At least two AI levels are required.");
  }
  return options;
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
          for (const pending of this.pending.values()) {
            pending.reject(error);
          }
          this.pending.clear();
        }
      });
    });
    return this.readyPromise;
  }

  routeMessage(message) {
    const pending = this.pending.get(message.id);
    if (!pending) return;

    if (message.type === "moveResult") {
      this.pending.delete(message.id);
      pending.resolve(message);
      return;
    }

    if (message.type === "error") {
      this.pending.delete(message.id);
      const error = new Error(message.message || "worker error");
      error.code = message.code;
      pending.reject(error);
    }
  }

  async chooseMove(gameState, aiLevel, stateVersion) {
    await this.init();
    const id = `sim_${process.pid}_${Date.now()}_${this.requestSeq += 1}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({
        type: "chooseMove",
        id,
        stateVersion,
        aiLevel,
        allowPartial: false,
        gameState
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

function buildGameState(game, whiteLevel, blackLevel, language) {
  const history = game.history || [];
  return {
    fen: ChessState.serializeFen(game.state),
    turn: game.state.turn,
    language,
    hintMode: false,
    stateVersion: history.length + 1,
    boardOrientation: "white",
    whitePlayerType: `AI-${whiteLevel}`,
    blackPlayerType: `AI-${blackLevel}`,
    lastMoveSan: history.length > 0 ? history[history.length - 1].san || null : null,
    moveHistorySan: history.map((entry) => entry.san),
    moveHistoryUci: history.map((entry) => entry.uci)
  };
}

function createSideStats() {
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

function average(sum, count) {
  return count > 0 ? sum / count : null;
}

function summarizeSideStats(stats) {
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

function getPerspectiveScore(record, level) {
  if (record.result === "1/2-1/2") return 0.5;
  if (record.whiteLevel === level) return record.result === "1-0" ? 1 : 0;
  return record.result === "0-1" ? 1 : 0;
}

function getPerspectiveOutcome(record, level) {
  const score = getPerspectiveScore(record, level);
  if (score === 1) return "win";
  if (score === 0.5) return "draw";
  return "loss";
}

async function simulateGame(job, client, options) {
  let game = ChessRules.createGame();
  const moveStats = {
    white: createSideStats(),
    black: createSideStats()
  };
  const moveLogs = [];
  const startedAt = Date.now();
  let stateVersion = 1;
  let resultInfo = null;

  while (!resultInfo) {
    const status = ChessRules.getGameStatus(game);
    resultInfo = resolveTerminalResult(status, game, options.maxPlies);
    if (resultInfo) break;

    const turn = game.state.turn;
    const aiLevel = turn === ChessState.WHITE ? job.whiteLevel : job.blackLevel;
    const sideKey = turn === ChessState.WHITE ? "white" : "black";
    const requestStartedAt = Date.now();
    const message = await client.chooseMove(buildGameState(game, job.whiteLevel, job.blackLevel, options.language), aiLevel, stateVersion);
    const latencyMs = Date.now() - requestStartedAt;
    const move = message?.move || null;
    if (!move?.uci) {
      throw new Error(`AI-${aiLevel} returned no move in game ${job.id}`);
    }

    registerMoveStats(moveStats[sideKey], move, latencyMs);
    game = ChessRules.makeMove(game, move.uci);
    const historyEntry = game.history[game.history.length - 1];
    moveLogs.push({
      ply: historyEntry?.ply || game.history.length,
      turn: turn,
      aiLevel,
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
    whitePlayerType: `AI-${job.whiteLevel}`,
    blackPlayerType: `AI-${job.blackLevel}`,
    language: options.language,
    initialFen: game.initialFen,
    savedAt: new Date(finishedAt).toISOString()
  };

  return {
    id: job.id,
    whiteLevel: job.whiteLevel,
    blackLevel: job.blackLevel,
    result: resultInfo.result,
    reason: resultInfo.reason,
    adjudicated: resultInfo.adjudicated,
    plies: game.history.length,
    moveCount: Math.ceil(game.history.length / 2),
    durationMs: finishedAt - startedAt,
    finalFen: ChessState.serializeFen(game.state),
    materialBalance: computeMaterialBalance(game.state),
    summary: ChessReview.buildReviewSummary(gameLike, options.language),
    pgn: ChessPgn.buildPgn(gameLike, {
      event: "Forest Chess AI Ladder Simulation",
      site: "Headless",
      language: options.language,
      savedAt: new Date(finishedAt).toISOString()
    }),
    whiteStats: summarizeSideStats(moveStats.white),
    blackStats: summarizeSideStats(moveStats.black),
    openingSan: game.history.slice(0, 12).map((entry) => entry.san),
    moveLogs,
    moveHistorySan: game.history.map((entry) => entry.san),
    moveHistoryUci: game.history.map((entry) => entry.uci)
  };
}

function createJobs(levels, gamesPerPair) {
  const jobs = [];
  let sequence = 1;
  for (let leftIndex = 0; leftIndex < levels.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < levels.length; rightIndex += 1) {
      const left = levels[leftIndex];
      const right = levels[rightIndex];
      for (let round = 0; round < gamesPerPair; round += 1) {
        const swap = round % 2 === 1;
        jobs.push({
          id: `game_${String(sequence).padStart(3, "0")}_L${left}_L${right}_R${round + 1}`,
          pairKey: `${left}-${right}`,
          round: round + 1,
          whiteLevel: swap ? right : left,
          blackLevel: swap ? left : right
        });
        sequence += 1;
      }
    }
  }
  return jobs;
}

async function runPool(jobs, options) {
  const workerPath = path.resolve(ROOT, "worker", "ai-worker.js");
  const clients = [];
  const results = [];
  let cursor = 0;

  async function workerLoop(slot) {
    const client = new AiWorkerClient(workerPath);
    clients.push(client);
    await client.init();

    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= jobs.length) break;
      const job = jobs[index];
      console.log(`[sim ${slot}] ${job.id} start | W=AI-${job.whiteLevel} B=AI-${job.blackLevel}`);
      const record = await simulateGame(job, client, options);
      results.push(record);
      console.log(
        `[sim ${slot}] ${job.id} done | result=${record.result} | reason=${record.reason} | plies=${record.plies} | ms=${record.durationMs}`
      );
    }
  }

  try {
    await Promise.all(Array.from({ length: options.concurrency }, (_, index) => workerLoop(index + 1)));
  } finally {
    await Promise.all(clients.map((client) => client.dispose().catch(() => null)));
  }

  return results.sort((left, right) => left.id.localeCompare(right.id));
}

function createLevelAggregate(level) {
  return {
    level,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    scorePoints: 0,
    whiteGames: 0,
    blackGames: 0,
    whiteWins: 0,
    whiteDraws: 0,
    blackWins: 0,
    blackDraws: 0,
    totalPlies: 0,
    totalDurationMs: 0,
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

function buildAggregates(records, levels) {
  const byLevel = new Map(levels.map((level) => [level, createLevelAggregate(level)]));
  const pairwise = new Map();

  for (const record of records) {
    const canonicalKey = [record.whiteLevel, record.blackLevel].sort((left, right) => left - right).join("-");
    if (!pairwise.has(canonicalKey)) {
      const [left, right] = canonicalKey.split("-").map(Number);
      pairwise.set(canonicalKey, {
        pairKey: canonicalKey,
        leftLevel: left,
        rightLevel: right,
        games: 0,
        leftWins: 0,
        rightWins: 0,
        draws: 0,
        leftScore: 0,
        rightScore: 0,
        totalPlies: 0,
        totalDurationMs: 0,
        reasons: {},
        leftAsWhiteGames: 0,
        leftAsWhiteScore: 0,
        leftAsBlackGames: 0,
        leftAsBlackScore: 0
      });
    }

    const pair = pairwise.get(canonicalKey);
    pair.games += 1;
    pair.totalPlies += record.plies;
    pair.totalDurationMs += record.durationMs;
    addReasonCounter(pair.reasons, record.reason);

    const leftScore = getPerspectiveScore(record, pair.leftLevel);
    const rightScore = getPerspectiveScore(record, pair.rightLevel);
    pair.leftScore += leftScore;
    pair.rightScore += rightScore;
    if (leftScore === 1) pair.leftWins += 1;
    else if (rightScore === 1) pair.rightWins += 1;
    else pair.draws += 1;

    if (record.whiteLevel === pair.leftLevel) {
      pair.leftAsWhiteGames += 1;
      pair.leftAsWhiteScore += leftScore;
    } else {
      pair.leftAsBlackGames += 1;
      pair.leftAsBlackScore += leftScore;
    }

    const whiteAggregate = byLevel.get(record.whiteLevel);
    const blackAggregate = byLevel.get(record.blackLevel);
    const whiteOutcome = getPerspectiveOutcome(record, record.whiteLevel);
    const blackOutcome = getPerspectiveOutcome(record, record.blackLevel);

    whiteAggregate.games += 1;
    whiteAggregate.whiteGames += 1;
    whiteAggregate.totalPlies += record.plies;
    whiteAggregate.totalDurationMs += record.durationMs;
    whiteAggregate.scorePoints += getPerspectiveScore(record, record.whiteLevel);
    if (whiteOutcome === "win") {
      whiteAggregate.wins += 1;
      whiteAggregate.whiteWins += 1;
    } else if (whiteOutcome === "draw") {
      whiteAggregate.draws += 1;
      whiteAggregate.whiteDraws += 1;
    } else {
      whiteAggregate.losses += 1;
    }
    whiteAggregate.totalMoves += record.whiteStats.moves;
    whiteAggregate.totalMoveLatencyMs += (record.whiteStats.avgLatencyMs || 0) * record.whiteStats.moves;
    whiteAggregate.totalDepth += (record.whiteStats.avgDepth || 0) * (record.whiteStats.moves || 0);
    whiteAggregate.depthSamples += record.whiteStats.moves || 0;
    if (record.whiteStats.avgScoreCp != null) {
      whiteAggregate.totalScoreCp += record.whiteStats.avgScoreCp * (record.whiteStats.moves || 0);
      whiteAggregate.scoreSamples += record.whiteStats.moves || 0;
    }
    addReasonCounter(whiteAggregate.reasons, record.reason);

    blackAggregate.games += 1;
    blackAggregate.blackGames += 1;
    blackAggregate.totalPlies += record.plies;
    blackAggregate.totalDurationMs += record.durationMs;
    blackAggregate.scorePoints += getPerspectiveScore(record, record.blackLevel);
    if (blackOutcome === "win") {
      blackAggregate.wins += 1;
      blackAggregate.blackWins += 1;
    } else if (blackOutcome === "draw") {
      blackAggregate.draws += 1;
      blackAggregate.blackDraws += 1;
    } else {
      blackAggregate.losses += 1;
    }
    blackAggregate.totalMoves += record.blackStats.moves;
    blackAggregate.totalMoveLatencyMs += (record.blackStats.avgLatencyMs || 0) * record.blackStats.moves;
    blackAggregate.totalDepth += (record.blackStats.avgDepth || 0) * (record.blackStats.moves || 0);
    blackAggregate.depthSamples += record.blackStats.moves || 0;
    if (record.blackStats.avgScoreCp != null) {
      blackAggregate.totalScoreCp += record.blackStats.avgScoreCp * (record.blackStats.moves || 0);
      blackAggregate.scoreSamples += record.blackStats.moves || 0;
    }
    addReasonCounter(blackAggregate.reasons, record.reason);
  }

  const normalizedLevels = levels.map((level) => {
    const entry = byLevel.get(level);
    return {
      level,
      games: entry.games,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      scoreRate: entry.games > 0 ? entry.scorePoints / entry.games : null,
      whiteScoreRate: entry.whiteGames > 0 ? (entry.whiteWins + (entry.whiteDraws * 0.5)) / entry.whiteGames : null,
      blackScoreRate: entry.blackGames > 0 ? (entry.blackWins + (entry.blackDraws * 0.5)) / entry.blackGames : null,
      avgPlies: average(entry.totalPlies, entry.games),
      avgGameMs: average(entry.totalDurationMs, entry.games),
      avgMoveLatencyMs: average(entry.totalMoveLatencyMs, entry.totalMoves),
      avgDepth: average(entry.totalDepth, entry.depthSamples),
      avgScoreCp: average(entry.totalScoreCp, entry.scoreSamples),
      reasons: entry.reasons
    };
  });

  const normalizedPairs = [...pairwise.values()]
    .sort((left, right) => left.leftLevel - right.leftLevel || left.rightLevel - right.rightLevel)
    .map((entry) => ({
      ...entry,
      leftScoreRate: entry.games > 0 ? entry.leftScore / entry.games : null,
      rightScoreRate: entry.games > 0 ? entry.rightScore / entry.games : null,
      drawRate: entry.games > 0 ? entry.draws / entry.games : null,
      avgPlies: average(entry.totalPlies, entry.games),
      avgGameMs: average(entry.totalDurationMs, entry.games),
      leftAsWhiteScoreRate: entry.leftAsWhiteGames > 0 ? entry.leftAsWhiteScore / entry.leftAsWhiteGames : null,
      leftAsBlackScoreRate: entry.leftAsBlackGames > 0 ? entry.leftAsBlackScore / entry.leftAsBlackGames : null
    }));

  return {
    byLevel: normalizedLevels,
    pairwise: normalizedPairs
  };
}

function formatPercent(value) {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

function createMatrix(levels, pairwise, selector) {
  const map = new Map();
  pairwise.forEach((entry) => {
    map.set(`${entry.leftLevel}-${entry.rightLevel}`, entry);
  });

  return levels.map((rowLevel) => levels.map((columnLevel) => {
    if (rowLevel === columnLevel) return null;
    const left = Math.min(rowLevel, columnLevel);
    const right = Math.max(rowLevel, columnLevel);
    const entry = map.get(`${left}-${right}`);
    if (!entry) return null;
    return selector(entry, rowLevel, columnLevel);
  }));
}

function buildMarkdownTable(levels, matrix, formatter) {
  const header = ["Lv", ...levels.map((level) => `AI-${level}`)];
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`
  ];

  levels.forEach((rowLevel, rowIndex) => {
    const cells = [`AI-${rowLevel}`];
    levels.forEach((columnLevel, columnIndex) => {
      if (rowLevel === columnLevel) {
        cells.push("-");
        return;
      }
      cells.push(formatter(matrix[rowIndex][columnIndex], rowLevel, columnLevel));
    });
    lines.push(`| ${cells.join(" | ")} |`);
  });

  return lines.join("\n");
}

function buildPairwiseCsv(pairwise) {
  const header = [
    "pair",
    "left_level",
    "right_level",
    "games",
    "left_wins",
    "right_wins",
    "draws",
    "left_score_rate",
    "right_score_rate",
    "draw_rate",
    "avg_plies",
    "avg_game_ms",
    "left_as_white_score_rate",
    "left_as_black_score_rate",
    "reasons"
  ];
  const lines = [header.join(",")];
  pairwise.forEach((entry) => {
    lines.push([
      entry.pairKey,
      entry.leftLevel,
      entry.rightLevel,
      entry.games,
      entry.leftWins,
      entry.rightWins,
      entry.draws,
      formatNumber(entry.leftScoreRate, 4),
      formatNumber(entry.rightScoreRate, 4),
      formatNumber(entry.drawRate, 4),
      formatNumber(entry.avgPlies, 2),
      formatNumber(entry.avgGameMs, 2),
      formatNumber(entry.leftAsWhiteScoreRate, 4),
      formatNumber(entry.leftAsBlackScoreRate, 4),
      `"${Object.entries(entry.reasons).map(([key, value]) => `${key}:${value}`).join("; ")}"`
    ].join(","));
  });
  return `${lines.join("\n")}\n`;
}

function buildLevelCsv(byLevel) {
  const header = [
    "level",
    "games",
    "wins",
    "losses",
    "draws",
    "score_rate",
    "white_score_rate",
    "black_score_rate",
    "avg_plies",
    "avg_game_ms",
    "avg_move_latency_ms",
    "avg_depth",
    "avg_score_cp",
    "reasons"
  ];
  const lines = [header.join(",")];
  byLevel.forEach((entry) => {
    lines.push([
      entry.level,
      entry.games,
      entry.wins,
      entry.losses,
      entry.draws,
      formatNumber(entry.scoreRate, 4),
      formatNumber(entry.whiteScoreRate, 4),
      formatNumber(entry.blackScoreRate, 4),
      formatNumber(entry.avgPlies, 2),
      formatNumber(entry.avgGameMs, 2),
      formatNumber(entry.avgMoveLatencyMs, 2),
      formatNumber(entry.avgDepth, 2),
      formatNumber(entry.avgScoreCp, 2),
      `"${Object.entries(entry.reasons).map(([key, value]) => `${key}:${value}`).join("; ")}"`
    ].join(","));
  });
  return `${lines.join("\n")}\n`;
}

function buildMarkdownReport(options, aggregate, records) {
  const scoreMatrix = createMatrix(options.levels, aggregate.pairwise, (entry, rowLevel) => {
    return rowLevel === entry.leftLevel ? entry.leftScoreRate : entry.rightScoreRate;
  });
  const drawMatrix = createMatrix(options.levels, aggregate.pairwise, (entry) => entry.drawRate);
  const gameCountMatrix = createMatrix(options.levels, aggregate.pairwise, (entry) => entry.games);

  const topUpsets = records
    .filter((record) => {
      const winner = record.result === "1-0" ? record.whiteLevel : record.result === "0-1" ? record.blackLevel : null;
      const loser = winner === record.whiteLevel ? record.blackLevel : winner === record.blackLevel ? record.whiteLevel : null;
      return winner && loser && winner < loser;
    })
    .sort((left, right) => (right.blackLevel + right.whiteLevel) - (left.blackLevel + left.whiteLevel))
    .slice(0, 10);

  const lines = [
    "# Forest Chess AI Winrate Matrix",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Levels: ${options.levels.map((level) => `AI-${level}`).join(", ")}`,
    `- Games per pair: ${options.gamesPerPair}`,
    `- Max plies: ${options.maxPlies}`,
    `- Concurrency: ${options.concurrency}`,
    "- Raw JSON includes per-game PGN, SAN/UCI history, and move-by-move logs with FEN, depth, score, and latency.",
    "",
    "## Score Matrix",
    "",
    "Row AI score rate against column AI. `100%` means the row AI scored every point, `50%` means even, `0%` means it scored nothing.",
    "",
    buildMarkdownTable(options.levels, scoreMatrix, (value) => formatPercent(value)),
    "",
    "## Draw Matrix",
    "",
    buildMarkdownTable(options.levels, drawMatrix, (value) => formatPercent(value)),
    "",
    "## Game Count Matrix",
    "",
    buildMarkdownTable(options.levels, gameCountMatrix, (value) => String(value ?? "-")),
    "",
    "## By Level",
    "",
    "| Level | W | L | D | Score | White Score | Black Score | Avg Plies | Avg Game ms | Avg Move ms | Avg Depth | Avg Score cp |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  aggregate.byLevel.forEach((entry) => {
    lines.push(
      `| AI-${entry.level} | ${entry.wins} | ${entry.losses} | ${entry.draws} | ${formatPercent(entry.scoreRate)} | ${formatPercent(entry.whiteScoreRate)} | ${formatPercent(entry.blackScoreRate)} | ${formatNumber(entry.avgPlies, 1)} | ${formatNumber(entry.avgGameMs, 1)} | ${formatNumber(entry.avgMoveLatencyMs, 1)} | ${formatNumber(entry.avgDepth, 2)} | ${formatNumber(entry.avgScoreCp, 2)} |`
    );
  });

  lines.push("", "## Pairwise Detail", "", "| Pair | Record | Score | Draw | Avg Plies | Avg Game ms | Left as White | Left as Black | Reasons |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");

  aggregate.pairwise.forEach((entry) => {
    lines.push(
      `| AI-${entry.leftLevel} vs AI-${entry.rightLevel} | ${entry.leftWins}-${entry.rightWins}-${entry.draws} | ${formatPercent(entry.leftScoreRate)} / ${formatPercent(entry.rightScoreRate)} | ${formatPercent(entry.drawRate)} | ${formatNumber(entry.avgPlies, 1)} | ${formatNumber(entry.avgGameMs, 1)} | ${formatPercent(entry.leftAsWhiteScoreRate)} | ${formatPercent(entry.leftAsBlackScoreRate)} | ${Object.entries(entry.reasons).map(([key, value]) => `${key}:${value}`).join(", ")} |`
    );
  });

  if (topUpsets.length > 0) {
    lines.push("", "## Notable Upsets", "");
    topUpsets.forEach((record) => {
      const winner = record.result === "1-0" ? `AI-${record.whiteLevel}` : `AI-${record.blackLevel}`;
      const loser = winner === `AI-${record.whiteLevel}` ? `AI-${record.blackLevel}` : `AI-${record.whiteLevel}`;
      lines.push(`- ${winner} beat ${loser} | reason=${record.reason} | plies=${record.plies} | opening=${record.openingSan.join(" ")}`);
    });
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDirectory(options.outputDir);
  const jobs = createJobs(options.levels, options.gamesPerPair);
  const startedAt = Date.now();
  const records = await runPool(jobs, options);
  const aggregate = buildAggregates(records, options.levels);
  const finishedAt = Date.now();
  const timestamp = formatTimestamp(new Date(finishedAt));

  const basePath = path.join(options.outputDir, `${options.prefix}_${timestamp}`);
  const payload = {
    generatedAt: new Date(finishedAt).toISOString(),
    elapsedMs: finishedAt - startedAt,
    settings: {
      levels: options.levels,
      gamesPerPair: options.gamesPerPair,
      maxPlies: options.maxPlies,
      concurrency: options.concurrency,
      language: options.language
    },
    aggregate,
    games: records
  };

  fs.writeFileSync(`${basePath}.json`, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(`${basePath}.md`, buildMarkdownReport(options, aggregate, records), "utf8");
  fs.writeFileSync(`${basePath}_pairwise.csv`, buildPairwiseCsv(aggregate.pairwise), "utf8");
  fs.writeFileSync(`${basePath}_levels.csv`, buildLevelCsv(aggregate.byLevel), "utf8");

  console.log(`RESULT_JSON=${basePath}.json`);
  console.log(`RESULT_MD=${basePath}.md`);
  console.log(`RESULT_PAIRWISE_CSV=${basePath}_pairwise.csv`);
  console.log(`RESULT_LEVELS_CSV=${basePath}_levels.csv`);
  console.log(`ELAPSED_MS=${finishedAt - startedAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
