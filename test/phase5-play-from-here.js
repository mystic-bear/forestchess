const assert = require("node:assert/strict");

const { Game } = require("../js/game.js");
const { SaveManager, createMemoryStorage } = require("../js/persistence/save-manager.js");
const ChessState = require("../js/chess/chess-state.js");

const saveManager = new SaveManager({ storage: createMemoryStorage() });
const game = new Game({ saveManager });

const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
const record = saveManager.saveFinishedGame({
  id: "archive-training",
  savedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  initialFen: ChessState.START_FEN,
  finalFen: fen,
  moveHistoryUci: ["e2e4", "e7e5"],
  moveHistorySan: ["e4", "e5"],
  result: "*",
  reason: "game-over",
  whitePlayerType: "HUMAN",
  blackPlayerType: "AI-3",
  language: "ko",
  reviewSummary: { line1: "", line2: "", line3: "" },
  analysisStatus: "done",
  analysis: {
    gameId: "archive-training",
    moments: [{
      ply: 1,
      fen,
      moveSan: "e4",
      playedUci: "e2e4",
      bestUci: "g1f3",
      evalBeforeCp: 20,
      evalAfterCp: 15,
      swingCp: 80,
      category: "turning-point",
      theme: "development",
      summary: "moment",
      explanation: "detail",
      retryPrompt: "retry"
    }],
    overall: null
  }
});

game.refreshArchiveList();
const ok = game.playFromCriticalMoment(record.id, 1);
assert.equal(ok, true, "play from critical moment should start a new board");
assert.equal(game.getCurrentFen(), fen);
assert.equal(game.modeKey, "play-from-here");

console.log("phase5-play-from-here: ok");
