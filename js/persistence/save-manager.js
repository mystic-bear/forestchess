(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAVE_KEY = "forest-chess-latest-save";
  const ARCHIVE_KEY = "forest-chess-archive";
  const SAVE_SCHEMA_VERSION = 1;
  const ARCHIVE_LIMIT = 30;

  function createMemoryStorage() {
    const store = new Map();
    return {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      }
    };
  }

  class SaveManager {
    constructor(options = {}) {
      this.saveKey = options.saveKey || SAVE_KEY;
      this.archiveKey = options.archiveKey || ARCHIVE_KEY;
      this.schemaVersion = options.schemaVersion || SAVE_SCHEMA_VERSION;
      this.archiveLimit = Number(options.archiveLimit) > 0 ? Number(options.archiveLimit) : ARCHIVE_LIMIT;
      this.storage = options.storage || this.resolveStorage();
    }

    resolveStorage() {
      if (typeof localStorage !== "undefined") {
        return localStorage;
      }
      return createMemoryStorage();
    }

    normalizeSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== "object") return null;
      const initialFen = String(snapshot.initialFen || "").trim();
      const currentFen = String(snapshot.currentFen || "").trim();
      if (!initialFen || !currentFen) return null;

      return {
        schemaVersion: this.schemaVersion,
        savedAt: snapshot.savedAt || new Date().toISOString(),
        initialFen,
        currentFen,
        moveHistoryUci: Array.isArray(snapshot.moveHistoryUci) ? [...snapshot.moveHistoryUci] : [],
        moveHistorySan: Array.isArray(snapshot.moveHistorySan) ? [...snapshot.moveHistorySan] : [],
        resultState: snapshot.resultState ? { ...snapshot.resultState } : null,
        whitePlayerType: snapshot.whitePlayerType || "HUMAN",
        blackPlayerType: snapshot.blackPlayerType || "HUMAN",
        pieceLabelMode: snapshot.pieceLabelMode || "both",
        boardOrientation: snapshot.boardOrientation || "white",
        language: snapshot.language || "ko",
        engineStatus: snapshot.engineStatus ? { ...snapshot.engineStatus } : null,
        lastMove: snapshot.lastMove ? { ...snapshot.lastMove } : null,
        setupPlayers: snapshot.setupPlayers ? { ...snapshot.setupPlayers } : {
          white: snapshot.whitePlayerType || "HUMAN",
          black: snapshot.blackPlayerType || "HUMAN"
        },
        setupPlayerAnimals: snapshot.setupPlayerAnimals ? { ...snapshot.setupPlayerAnimals } : null,
        modeKey: snapshot.modeKey || "local-human"
      };
    }

    createArchiveId() {
      return `game_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    }

    normalizeReviewSummary(summary) {
      if (!summary) return null;
      if (Array.isArray(summary)) {
        return {
          line1: String(summary[0] || ""),
          line2: String(summary[1] || ""),
          line3: String(summary[2] || "")
        };
      }
      return {
        line1: String(summary.line1 || ""),
        line2: String(summary.line2 || ""),
        line3: String(summary.line3 || "")
      };
    }

    normalizeAnalysisMoments(moments) {
      if (!Array.isArray(moments)) return [];
      return moments.map((entry) => ({
        ply: Number(entry.ply) || 0,
        fen: String(entry.fen || "").trim(),
        moveSan: entry.moveSan || null,
        playedUci: entry.playedUci || null,
        bestUci: entry.bestUci || null,
        evalBeforeCp: Number.isFinite(entry.evalBeforeCp) ? entry.evalBeforeCp : null,
        evalAfterCp: Number.isFinite(entry.evalAfterCp) ? entry.evalAfterCp : null,
        swingCp: Number.isFinite(entry.swingCp) ? entry.swingCp : null,
        category: entry.category || "turning-point",
        theme: entry.theme || "development",
        summary: String(entry.summary || ""),
        explanation: String(entry.explanation || ""),
        retryPrompt: String(entry.retryPrompt || "")
      })).filter((entry) => entry.fen);
    }

    normalizeArchiveEntry(record) {
      if (!record || typeof record !== "object") return null;
      const initialFen = String(record.initialFen || "").trim();
      const finalFen = String(record.finalFen || record.currentFen || "").trim();
      if (!initialFen || !finalFen) return null;

      const normalized = {
        id: record.id || this.createArchiveId(),
        schemaVersion: this.schemaVersion,
        savedAt: record.savedAt || new Date().toISOString(),
        finishedAt: record.finishedAt || record.savedAt || new Date().toISOString(),
        initialFen,
        finalFen,
        moveHistoryUci: Array.isArray(record.moveHistoryUci) ? [...record.moveHistoryUci] : [],
        moveHistorySan: Array.isArray(record.moveHistorySan) ? [...record.moveHistorySan] : [],
        result: record.result || record.resultState?.result || "*",
        reason: record.reason || record.resultState?.reason || "game-over",
        whitePlayerType: record.whitePlayerType || "HUMAN",
        blackPlayerType: record.blackPlayerType || "HUMAN",
        language: record.language || "ko",
        reviewSummary: this.normalizeReviewSummary(record.reviewSummary),
        analysisStatus: record.analysisStatus || "none",
        analysis: record.analysis
          ? {
              gameId: record.analysis.gameId || record.id || null,
              moments: this.normalizeAnalysisMoments(record.analysis.moments),
              overall: record.analysis.overall
                ? {
                    openingNote: String(record.analysis.overall.openingNote || ""),
                    middleGameNote: String(record.analysis.overall.middleGameNote || ""),
                    endingNote: String(record.analysis.overall.endingNote || "")
                  }
                : null
            }
          : null,
        lastMove: record.lastMove ? { ...record.lastMove } : null,
        setupPlayers: record.setupPlayers ? { ...record.setupPlayers } : {
          white: record.whitePlayerType || "HUMAN",
          black: record.blackPlayerType || "HUMAN"
        },
        setupPlayerAnimals: record.setupPlayerAnimals ? { ...record.setupPlayerAnimals } : null
      };

      return normalized;
    }

    loadArchiveRaw() {
      try {
        const raw = this.storage.getItem(this.archiveKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((entry) => this.normalizeArchiveEntry(entry))
          .filter(Boolean)
          .sort((a, b) => String(b.finishedAt || b.savedAt).localeCompare(String(a.finishedAt || a.savedAt)));
      } catch (error) {
        return [];
      }
    }

    saveArchiveRaw(entries) {
      this.storage.setItem(this.archiveKey, JSON.stringify(entries.slice(0, this.archiveLimit)));
    }

    saveLatest(snapshot) {
      const normalized = this.normalizeSnapshot(snapshot);
      if (!normalized) return null;
      this.storage.setItem(this.saveKey, JSON.stringify(normalized));
      return normalized;
    }

    loadLatest() {
      try {
        const raw = this.storage.getItem(this.saveKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.schemaVersion !== this.schemaVersion) return null;
        return this.normalizeSnapshot(parsed);
      } catch (error) {
        return null;
      }
    }

    clearLatest() {
      this.storage.removeItem(this.saveKey);
    }

    hasResumeCandidate() {
      return !!this.loadLatest();
    }

    saveFinishedGame(record) {
      const normalized = this.normalizeArchiveEntry(record);
      if (!normalized) return null;
      const archive = this.loadArchiveRaw().filter((entry) => entry.id !== normalized.id);
      archive.unshift(normalized);
      archive.sort((a, b) => String(b.finishedAt || b.savedAt).localeCompare(String(a.finishedAt || a.savedAt)));
      this.saveArchiveRaw(archive);
      return normalized;
    }

    listFinishedGames(limit = null) {
      const archive = this.loadArchiveRaw();
      if (!limit || limit < 1) return archive;
      return archive.slice(0, limit);
    }

    loadFinishedGame(id) {
      if (!id) return null;
      return this.loadArchiveRaw().find((entry) => entry.id === id) || null;
    }

    deleteFinishedGame(id) {
      if (!id) return false;
      const archive = this.loadArchiveRaw();
      const nextArchive = archive.filter((entry) => entry.id !== id);
      if (nextArchive.length === archive.length) return false;
      this.saveArchiveRaw(nextArchive);
      return true;
    }
  }

  return {
    SAVE_KEY,
    ARCHIVE_KEY,
    SAVE_SCHEMA_VERSION,
    ARCHIVE_LIMIT,
    SaveManager,
    createMemoryStorage
  };
});
