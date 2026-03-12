(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SAVE_KEY = "forest-chess-latest-save";
  const SAVE_SCHEMA_VERSION = 1;

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
      this.schemaVersion = options.schemaVersion || SAVE_SCHEMA_VERSION;
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
        modeKey: snapshot.modeKey || "local-human"
      };
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
  }

  return {
    SAVE_KEY,
    SAVE_SCHEMA_VERSION,
    SaveManager,
    createMemoryStorage
  };
});
