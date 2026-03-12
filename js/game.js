(function (root, factory) {
  let deps;
  if (typeof module !== "undefined" && module.exports) {
    deps = {
      ...require("../shared/i18n.js"),
      ...require("../shared/constants.js"),
      ...require("../shared/utils.js"),
      ChessState: require("./chess/chess-state.js"),
      ChessRules: require("./chess/rules.js"),
      ChessPgn: require("./chess/pgn.js"),
      ChessReview: require("./chess/review.js"),
      ...require("./persistence/save-manager.js")
    };
  } else {
    deps = root;
  }

  const api = factory(deps);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";

  const {
    DEFAULT_LANGUAGE,
    isSupportedLanguage,
    translateUi,
    DEFAULT_SETUP,
    QUICK_PRESETS,
    PLAYER_ORDER,
    SETUP_STATES,
    PIECE_LABEL_MODES,
    BOARD_ORIENTATION_OPTIONS,
    deepCopy,
    isAiState,
    getAiLevelFromState,
    getPlayerColorKey,
    getPlayerLabel,
    cycleOptionKey,
    formatStatusReason,
    buildSetupSummary
  } = deps;

  const ChessState = deps.ChessState;
  const ChessRules = deps.ChessRules;
  const ChessPgn = deps.ChessPgn;
  const ChessReview = deps.ChessReview;
  const SaveManager = deps.SaveManager;
  const LANGUAGE_STORAGE_KEY = "forest-chess-language";

  class Game {
    constructor(options = {}) {
      this.aiBridge = options.aiBridge || null;
      this.ui = options.ui || null;
      this.saveManager = options.saveManager || (typeof SaveManager === "function" ? new SaveManager() : null);
      this.language = this.loadLanguageSetting();
      this.setupPlayers = deepCopy(DEFAULT_SETUP);
      this.whitePlayerType = DEFAULT_SETUP.white;
      this.blackPlayerType = DEFAULT_SETUP.black;
      this.pieceLabelMode = "both";
      this.boardOrientation = "white";
      this.modeKey = "local-human";
      this.stateVersion = 0;
      this.asyncEpoch = 0;
      this.inputLocked = false;
      this.aiThinking = false;
      this.lastHintSession = null;
      this.aiSystemEnabled = !this.aiBridge || this.aiBridge.available !== false;
      this.coachSystemEnabled = !this.aiBridge || this.aiBridge.available !== false;
      this.engineStatus = {
        state: this.aiSystemEnabled ? "idle" : "unavailable",
        message: this.getEngineMessage(this.aiBridge?.lastError)
      };
      this.resumeSnapshot = null;
      this.resetSession();
      this.refreshResumeSnapshot();
    }

    loadLanguageSetting() {
      try {
        const stored = typeof localStorage !== "undefined"
          ? localStorage.getItem(LANGUAGE_STORAGE_KEY)
          : null;
        return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
      } catch (error) {
        return DEFAULT_LANGUAGE;
      }
    }

    saveLanguageSetting(language) {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        }
      } catch (error) {
        // Ignore storage failures.
      }
    }

    t(key, params = {}) {
      return translateUi(this.language, key, params);
    }

    getEngineMessage(errorLike) {
      const code = String(errorLike?.code || "");
      if (code === "worker-file-origin") return this.t("engine.fileOrigin");
      if (code === "worker-init-failed" || code === "engine-init-failed") return this.t("engine.initFailed");
      if (code === "choose-move-timeout") return this.t("engine.moveFailed");
      if (code === "hint-timeout") return this.t("engine.hintFailed");
      if (code === "worker-unavailable" || code === "worker-crashed") return this.t("engine.unavailable");
      if (errorLike?.message) return errorLike.message;
      return "";
    }

    setLanguage(language) {
      const nextLanguage = isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
      if (nextLanguage === this.language) return;
      this.language = nextLanguage;
      this.saveLanguageSetting(nextLanguage);
      this.persistLatestGame();
      this.refreshUi();
    }

    setUi(ui) {
      this.ui = ui;
    }

    setAIBridge(aiBridge) {
      this.aiBridge = aiBridge;
      const enabled = !aiBridge || aiBridge.available !== false;
      this.aiSystemEnabled = enabled;
      this.coachSystemEnabled = enabled;
      if (!enabled) {
        this.engineStatus = {
          state: "unavailable",
          message: this.getEngineMessage(aiBridge?.lastError) || this.t("engine.unavailable")
        };
      }
      this.persistLatestGame();
    }

    notifyUi(method, ...args) {
      if (this.ui && typeof this.ui[method] === "function") {
        return this.ui[method](...args);
      }
      return undefined;
    }

    refreshUi() {
      this.notifyUi("updateAll");
    }

    toast(message) {
      this.notifyUi("toast", message);
    }

    resetSession() {
      this.chessGame = null;
      this.currentStatus = null;
      this.currentLegalMoves = [];
      this.selectedSquare = null;
      this.legalTargets = [];
      this.pendingPromotion = null;
      this.resultState = null;
      this.checkSquare = null;
      this.capturedWhite = [];
      this.capturedBlack = [];
      this.lastMove = null;
      this.lastHintSession = null;
      this.aiThinking = false;
      this.inputLocked = false;
      this.reviewState = {
        open: false,
        frames: [],
        index: 0
      };
    }

    get currentState() {
      return this.chessGame?.state || null;
    }

    get moveHistory() {
      return this.chessGame?.history || [];
    }

    refreshResumeSnapshot() {
      this.resumeSnapshot = this.saveManager ? this.saveManager.loadLatest() : null;
      return this.resumeSnapshot;
    }

    hasResumeCandidate() {
      return !!this.resumeSnapshot;
    }

    getResumeInfo() {
      const snapshot = this.resumeSnapshot;
      if (!snapshot) return null;
      const locale = this.language === "ko" ? "ko-KR" : "en-US";
      const savedAtLabel = snapshot.savedAt
        ? new Date(snapshot.savedAt).toLocaleString(locale)
        : "-";
      const setupPlayers = snapshot.setupPlayers || {
        white: snapshot.whitePlayerType || "HUMAN",
        black: snapshot.blackPlayerType || "HUMAN"
      };
      return {
        savedAtLabel,
        setupSummary: buildSetupSummary(setupPlayers, this.language),
        lastMoveSan: snapshot.lastMove?.san || (snapshot.moveHistorySan?.length ? snapshot.moveHistorySan[snapshot.moveHistorySan.length - 1] : "-"),
        resultLine: snapshot.resultState?.terminal
          ? (formatStatusReason(snapshot.resultState, this.language) || this.t("result.gameOver"))
          : this.t("resume.inProgress")
      };
    }

    invalidateAsyncState() {
      this.stateVersion += 1;
      this.asyncEpoch += 1;
    }

    cancelPendingAsync() {
      if (this.aiBridge && typeof this.aiBridge.cancelPending === "function") {
        this.aiBridge.cancelPending();
      }
      this.aiThinking = false;
      this.inputLocked = false;
      if (this.lastHintSession) {
        this.lastHintSession.loading = false;
      }
    }

    canStartMatch() {
      return PLAYER_ORDER.every((colorKey) => typeof this.setupPlayers[colorKey] === "string");
    }

    isSetupPlayableNow() {
      return this.canStartMatch();
    }

    hasAiConfigured() {
      return PLAYER_ORDER.some((colorKey) => isAiState(this.setupPlayers[colorKey]));
    }

    getConfiguredPlayerType(colorKey) {
      return colorKey === "white" ? this.whitePlayerType : this.blackPlayerType;
    }

    setConfiguredPlayerType(colorKey, type) {
      if (colorKey === "white") this.whitePlayerType = type;
      if (colorKey === "black") this.blackPlayerType = type;
    }

    resolveRequestedPlayerType(type) {
      if (!isAiState(type)) return type;
      return this.canUseAi() ? type : "HUMAN";
    }

    buildSaveSnapshot() {
      if (!this.chessGame || !this.currentState) return null;
      return {
        initialFen: this.chessGame.initialFen,
        currentFen: ChessState.serializeFen(this.currentState),
        moveHistoryUci: this.moveHistory.map((entry) => entry.uci),
        moveHistorySan: this.moveHistory.map((entry) => entry.san),
        resultState: this.resultState ? { ...this.resultState } : null,
        whitePlayerType: this.whitePlayerType,
        blackPlayerType: this.blackPlayerType,
        pieceLabelMode: this.pieceLabelMode,
        boardOrientation: this.boardOrientation,
        language: this.language,
        engineStatus: this.engineStatus ? { ...this.engineStatus } : null,
        lastMove: this.lastMove ? { ...this.lastMove } : null,
        setupPlayers: { ...this.setupPlayers },
        modeKey: this.modeKey
      };
    }

    persistLatestGame() {
      if (!this.saveManager) return null;
      const snapshot = this.buildSaveSnapshot();
      if (!snapshot) return null;
      const saved = this.saveManager.saveLatest(snapshot);
      this.resumeSnapshot = saved;
      return saved;
    }

    clearSavedGame() {
      if (!this.saveManager) return;
      this.saveManager.clearLatest();
      this.resumeSnapshot = null;
    }

    applyPreset(presetKey) {
      const preset = QUICK_PRESETS.find((entry) => entry.key === presetKey);
      if (!preset) return;
      this.modeKey = preset.key;
      this.setupPlayers = deepCopy(preset.setup);
      this.notifyUi("renderStart");
      this.notifyUi("renderSetup");
      this.startFromSetup();
    }

    cycleSetupState(colorKey) {
      const current = this.setupPlayers[colorKey];
      const currentIndex = SETUP_STATES.indexOf(current);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % SETUP_STATES.length : 0;
      this.setupPlayers[colorKey] = SETUP_STATES[nextIndex];
      this.notifyUi("renderStart");
      this.notifyUi("renderSetup");
    }

    cyclePieceLabelMode() {
      this.pieceLabelMode = cycleOptionKey(PIECE_LABEL_MODES, this.pieceLabelMode);
      this.notifyUi("renderSetup");
      this.persistLatestGame();
      this.refreshUi();
    }

    cycleBoardOrientationSetting() {
      this.boardOrientation = cycleOptionKey(BOARD_ORIENTATION_OPTIONS, this.boardOrientation);
      this.notifyUi("renderSetup");
      this.persistLatestGame();
      this.refreshUi();
    }

    toggleBoardOrientation() {
      this.boardOrientation = this.boardOrientation === "white" ? "black" : "white";
      this.notifyUi("renderSetup");
      this.persistLatestGame();
      this.refreshUi();
    }

    startFromSetup() {
      if (!this.canStartMatch()) return;

      this.cancelPendingAsync();
      this.resetSession();
      this.whitePlayerType = this.resolveRequestedPlayerType(this.setupPlayers.white);
      this.blackPlayerType = this.resolveRequestedPlayerType(this.setupPlayers.black);
      this.chessGame = ChessRules.createGame();
      this.invalidateAsyncState();
      this.refreshDerivedState();
      this.persistLatestGame();
      this.notifyUi("showScreen", "game-screen");
      this.refreshUi();

      if ((isAiState(this.setupPlayers.white) || isAiState(this.setupPlayers.black)) && !this.canUseAi()) {
        this.toast(this.t("toast.engineUnavailableLocal"));
      }

      this.maybeRequestAiMove();
    }

    resumeSavedGame() {
      const snapshot = this.saveManager ? this.saveManager.loadLatest() : null;
      if (!snapshot) {
        this.toast(this.t("resume.none"));
        return false;
      }

      this.cancelPendingAsync();
      this.resetSession();
      this.language = isSupportedLanguage(snapshot.language) ? snapshot.language : DEFAULT_LANGUAGE;
      this.saveLanguageSetting(this.language);
      this.setupPlayers = snapshot.setupPlayers ? { ...snapshot.setupPlayers } : {
        white: snapshot.whitePlayerType || "HUMAN",
        black: snapshot.blackPlayerType || "HUMAN"
      };
      this.whitePlayerType = snapshot.whitePlayerType || this.setupPlayers.white || "HUMAN";
      this.blackPlayerType = snapshot.blackPlayerType || this.setupPlayers.black || "HUMAN";
      this.pieceLabelMode = snapshot.pieceLabelMode || "both";
      this.boardOrientation = snapshot.boardOrientation || "white";
      this.modeKey = snapshot.modeKey || "resume";
      this.engineStatus = snapshot.engineStatus
        ? { ...snapshot.engineStatus }
        : {
            state: this.canUseAi() ? "idle" : "unavailable",
            message: this.canUseAi() ? "" : this.t("engine.unavailable")
          };

      this.chessGame = snapshot.moveHistoryUci?.length
        ? ChessRules.playMoves(snapshot.moveHistoryUci, { fen: snapshot.initialFen })
        : ChessRules.createGame({ fen: snapshot.initialFen });

      this.resultState = snapshot.resultState ? { ...snapshot.resultState } : null;
      this.invalidateAsyncState();
      this.refreshDerivedState();
      this.resumeSnapshot = snapshot;
      this.notifyUi("hideSetup");
      this.notifyUi("showScreen", "game-screen");
      this.refreshUi();

      if (!this.isGameOver()) {
        this.maybeRequestAiMove();
      }

      return true;
    }

    restart() {
      this.startFromSetup();
    }

    toMenu() {
      this.cancelPendingAsync();
      this.resetSession();
      this.invalidateAsyncState();
      this.refreshResumeSnapshot();
      this.notifyUi("hideSetup");
      this.notifyUi("showScreen", "start-screen");
      this.notifyUi("renderStart");
      this.notifyUi("renderSetup");
      this.refreshUi();
    }

    refreshDerivedState() {
      if (!this.chessGame) {
        this.currentStatus = null;
        this.currentLegalMoves = [];
        this.legalTargets = [];
        this.lastMove = null;
        this.checkSquare = null;
        this.capturedWhite = [];
        this.capturedBlack = [];
        return;
      }

      const baseStatus = ChessRules.getGameStatus(this.chessGame);
      const status = this.resultState?.terminal
        ? { ...baseStatus, ...this.resultState, legalMoves: [] }
        : baseStatus;

      this.currentStatus = status;
      this.currentLegalMoves = status.terminal ? [] : status.legalMoves;
      this.lastMove = this.moveHistory[this.moveHistory.length - 1] || null;
      this.checkSquare = status.inCheck ? ChessState.findKing(this.currentState, this.currentState.turn) : null;

      if (this.selectedSquare !== null) {
        const targets = this.currentLegalMoves.filter((move) => move.from === this.selectedSquare);
        if (targets.length === 0) {
          this.selectedSquare = null;
          this.legalTargets = [];
        } else {
          this.legalTargets = targets;
        }
      } else {
        this.legalTargets = [];
      }

      this.rebuildCapturedPieces();
    }

    rebuildCapturedPieces() {
      const capturedWhite = [];
      const capturedBlack = [];

      this.moveHistory.forEach((entry) => {
        if (!entry.capturedPiece) return;
        if (entry.turn === "w") {
          capturedBlack.push(entry.capturedPiece);
        } else {
          capturedWhite.push(entry.capturedPiece);
        }
      });

      this.capturedWhite = capturedWhite;
      this.capturedBlack = capturedBlack;
    }

    clearSelection(updateUi = true) {
      this.selectedSquare = null;
      this.legalTargets = [];
      if (updateUi) this.refreshUi();
    }

    getTurnColorKey() {
      return this.currentState ? getPlayerColorKey(this.currentState.turn) : "white";
    }

    getTurnPlayerType() {
      return this.getConfiguredPlayerType(this.getTurnColorKey());
    }

    isAiTurn() {
      return !!this.currentState && isAiState(this.getTurnPlayerType());
    }

    isHumanTurn() {
      return !!this.currentState && !isAiState(this.getTurnPlayerType());
    }

    canUseAi() {
      return !!this.aiBridge && this.aiSystemEnabled && this.aiBridge.available !== false;
    }

    canUseCoach() {
      return !!this.aiBridge && this.coachSystemEnabled && this.aiBridge.available !== false;
    }

    canInteractWithBoard() {
      return !!this.currentState
        && !this.isGameOver()
        && !this.pendingPromotion
        && !this.aiThinking
        && !this.inputLocked
        && this.isHumanTurn();
    }

    handleSquareClick(index) {
      if (!this.canInteractWithBoard()) return;

      const piece = this.currentState.board[index];
      const pieceColor = piece ? ChessState.pieceColor(piece) : null;
      const turnColor = this.currentState.turn;

      if (piece && pieceColor === turnColor) {
        if (this.selectedSquare === index) {
          this.clearSelection();
        } else {
          this.selectedSquare = index;
          this.legalTargets = this.currentLegalMoves.filter((move) => move.from === index);
          this.refreshUi();
        }
        return;
      }

      if (this.selectedSquare === null) return;

      const matchingMoves = this.currentLegalMoves.filter(
        (move) => move.from === this.selectedSquare && move.to === index
      );

      if (matchingMoves.length === 0) return;

      const promotionMoves = matchingMoves.filter((move) => move.promotion);
      if (promotionMoves.length > 0) {
        this.pendingPromotion = {
          from: this.selectedSquare,
          to: index,
          moves: promotionMoves
        };
        this.inputLocked = true;
        this.refreshUi();
        return;
      }

      this.applyHumanMove(matchingMoves[0]);
    }

    applyMoveInternal(moveOrUci, source = "human") {
      try {
        this.chessGame = ChessRules.makeMove(this.chessGame, moveOrUci.uci || moveOrUci);
        this.selectedSquare = null;
        this.legalTargets = [];
        this.pendingPromotion = null;
        this.resultState = null;
        this.inputLocked = false;
        this.aiThinking = false;
        this.lastHintSession = null;
        this.invalidateAsyncState();
        this.refreshDerivedState();

        if (this.currentStatus?.terminal) {
          this.resultState = {
            terminal: true,
            result: this.currentStatus.result,
            reason: this.currentStatus.reason
          };
          this.refreshDerivedState();
        }

        this.engineStatus = {
          state: this.canUseAi() ? "idle" : "unavailable",
          message: this.canUseAi() ? "" : this.engineStatus.message
        };

        this.persistLatestGame();

        if (!this.currentStatus?.terminal && source !== "ai-failure") {
          this.maybeRequestAiMove();
        }

        this.refreshUi();
      } catch (error) {
        this.toast(this.t("toast.moveApplyFailed"));
        throw error;
      }
    }

    applyHumanMove(move) {
      this.cancelPendingAsync();
      this.applyMoveInternal(move, "human");
    }

    applyPromotionChoice(promotion) {
      if (!this.pendingPromotion) return;
      const move = this.pendingPromotion.moves.find((candidate) => candidate.promotion === promotion);
      if (!move) {
        this.toast(this.t("toast.invalidPromotion"));
        return;
      }
      this.cancelPendingAsync();
      this.applyMoveInternal(move, "human");
    }

    cancelPromotion() {
      if (!this.pendingPromotion) return;
      this.pendingPromotion = null;
      this.inputLocked = false;
      this.legalTargets = this.selectedSquare === null
        ? []
        : this.currentLegalMoves.filter((move) => move.from === this.selectedSquare);
      this.refreshUi();
    }

    undoMove() {
      if (!this.chessGame || this.moveHistory.length === 0) return;

      this.cancelPendingAsync();
      let undoPlyCount = 1;
      if ((isAiState(this.whitePlayerType) || isAiState(this.blackPlayerType)) && this.moveHistory.length >= 2) {
        undoPlyCount = 2;
      }

      const remainingMoves = this.moveHistory
        .slice(0, Math.max(0, this.moveHistory.length - undoPlyCount))
        .map((entry) => entry.uci);
      this.chessGame = ChessRules.playMoves(remainingMoves, { fen: this.chessGame.initialFen });
      this.resultState = null;
      this.pendingPromotion = null;
      this.clearSelection(false);
      this.invalidateAsyncState();
      this.refreshDerivedState();
      this.persistLatestGame();
      this.refreshUi();
    }

    canUndo() {
      return this.moveHistory.length > 0 && !this.aiThinking;
    }

    canClaimDraw() {
      if (!this.currentStatus || this.isGameOver()) return false;
      return !!(this.currentStatus.canClaimThreefold || this.currentStatus.canClaimFiftyMove);
    }

    claimDraw() {
      if (!this.canClaimDraw()) return;
      this.resultState = {
        terminal: true,
        result: "1/2-1/2",
        reason: this.currentStatus.canClaimThreefold ? "threefold-repetition" : "fifty-move-rule"
      };
      this.cancelPendingAsync();
      this.invalidateAsyncState();
      this.refreshDerivedState();
      this.persistLatestGame();
      this.refreshUi();
    }

    isGameOver() {
      return !!this.resultState?.terminal;
    }

    buildGameStateForAI(options = {}) {
      return {
        fen: this.currentState ? ChessState.serializeFen(this.currentState) : "",
        turn: this.currentState?.turn || null,
        hintMode: !!options.hintMode,
        language: this.language,
        stateVersion: this.stateVersion,
        boardOrientation: this.boardOrientation,
        whitePlayerType: this.whitePlayerType,
        blackPlayerType: this.blackPlayerType,
        lastMoveSan: this.lastMove?.san || null,
        moveHistorySan: this.moveHistory.map((entry) => entry.san),
        moveHistoryUci: this.moveHistory.map((entry) => entry.uci)
      };
    }

    maybeRequestAiMove() {
      if (!this.currentState || this.isGameOver() || this.pendingPromotion) return;
      if (!this.isAiTurn()) return;

      if (!this.canUseAi()) {
        this.setConfiguredPlayerType(this.getTurnColorKey(), "HUMAN");
        this.engineStatus = {
          state: "unavailable",
          message: this.engineStatus.message || this.t("engine.continueLocal")
        };
        this.persistLatestGame();
        this.toast(this.t("toast.engineUnavailableLocal"));
        this.refreshUi();
        return;
      }

      this.requestAiMove();
    }

    requestAiMove() {
      if (!this.currentState || !this.isAiTurn() || this.aiThinking || this.isGameOver()) return;

      const stateVersion = this.stateVersion;
      const level = getAiLevelFromState(this.getTurnPlayerType()) || 1;
      const currentTurnLabel = getPlayerLabel(this.getTurnColorKey(), this.language);
      this.aiThinking = true;
      this.inputLocked = true;
      this.engineStatus = {
        state: "thinking",
        message: this.t("status.aiThinking", { player: currentTurnLabel })
      };
      this.refreshUi();

      this.aiBridge.chooseMove(
        this.buildGameStateForAI({ hintMode: false }),
        level,
        stateVersion,
        {
          onProgress: (progressMeta) => {
            if (stateVersion !== this.stateVersion || !this.aiThinking) return;
            const depthPart = progressMeta?.depth ? ` D${progressMeta.depth}` : "";
            this.engineStatus = {
              state: "thinking",
              message: `${this.t("status.aiThinking", { player: currentTurnLabel })}${depthPart}`
            };
            this.refreshUi();
          }
        }
      ).then((result) => {
        if (stateVersion !== this.stateVersion) return;
        const move = result?.move || null;
        if (!move?.uci) {
          throw new Error(this.t("engine.moveFailed"));
        }
        this.applyMoveInternal(move, "ai");
      }).catch((error) => {
        if (stateVersion !== this.stateVersion) return;
        this.handleEngineFailure(error, { fromHint: false });
      });
    }

    requestHint() {
      if (!this.currentState || this.isGameOver() || this.pendingPromotion || this.aiThinking) return;

      if (!this.canUseCoach()) {
        this.toast(this.t("toast.coachUnavailable"));
        return;
      }

      const currentSession = this.lastHintSession;
      if (currentSession && currentSession.stateVersion === this.stateVersion) {
        const maxStage = currentSession.packet?.availableStage || 0;
        if (!currentSession.loading && currentSession.packet && currentSession.displayLevel < maxStage) {
          currentSession.displayLevel += 1;
          this.refreshUi();
          return;
        }
        if (currentSession.loading) {
          this.toast(this.t("toast.coachRunning"));
          return;
        }
        if (currentSession.packet && currentSession.displayLevel >= maxStage) {
          this.toast(this.t("toast.hintAlreadyOpen"));
          return;
        }
      }

      const stateVersion = this.stateVersion;
      this.lastHintSession = {
        stateVersion,
        packet: null,
        displayLevel: 1,
        loading: true,
        error: null,
        progress: null
      };
      this.refreshUi();

      this.aiBridge.getHint(
        this.buildGameStateForAI({ hintMode: true }),
        stateVersion,
        {
          onPartial: (payload) => {
            if (stateVersion !== this.stateVersion) return;
            if (!this.lastHintSession || this.lastHintSession.stateVersion !== stateVersion) return;
            if (payload.hint) {
              this.lastHintSession.packet = payload.hint;
            }
            this.lastHintSession.loading = true;
            this.lastHintSession.progress = payload.searchPhase || null;
            this.refreshUi();
          },
          onProgress: (progressMeta) => {
            if (stateVersion !== this.stateVersion) return;
            if (!this.lastHintSession || this.lastHintSession.stateVersion !== stateVersion) return;
            this.lastHintSession.progress = progressMeta;
            this.refreshUi();
          }
        }
      ).then((result) => {
        if (stateVersion !== this.stateVersion) return;
        if (!this.lastHintSession || this.lastHintSession.stateVersion !== stateVersion) return;
        this.lastHintSession.packet = result?.hint || this.lastHintSession.packet;
        this.lastHintSession.loading = false;
        this.lastHintSession.error = null;
        this.refreshUi();
      }).catch((error) => {
        if (stateVersion !== this.stateVersion) return;
        if (!this.lastHintSession || this.lastHintSession.stateVersion !== stateVersion) return;
        if (error.partialHint) {
          this.lastHintSession.packet = error.partialHint;
        }
        this.lastHintSession.loading = false;
        this.lastHintSession.error = this.getEngineMessage(error);
        this.handleEngineFailure(error, { fromHint: true });
        this.refreshUi();
      });
    }

    setHintStage(level) {
      if (!this.lastHintSession?.packet) return;
      const maxStage = this.lastHintSession.packet.availableStage || 1;
      if (level < 1 || level > maxStage) return;
      this.lastHintSession.displayLevel = level;
      this.refreshUi();
    }

    getActiveHintStage() {
      if (!this.lastHintSession?.packet) return null;
      const level = Math.max(1, this.lastHintSession.displayLevel || 1);
      return this.lastHintSession.packet.stages?.find((stage) => stage.level === level)
        || this.lastHintSession.packet.stages?.[0]
        || null;
    }

    getHintHighlight() {
      if (!this.lastHintSession?.packet) return null;
      if (!this.lastHintSession.packet.from || !this.lastHintSession.packet.to) return null;
      return {
        from: this.lastHintSession.packet.from,
        to: this.lastHintSession.packet.to
      };
    }

    isFatalEngineError(error) {
      const code = String(error?.code || "");
      return code.startsWith("engine")
        || code.startsWith("worker")
        || code === "EPERM"
        || code === "hint-timeout"
        || code === "choose-move-timeout";
    }

    handleEngineFailure(error, options = {}) {
      this.aiThinking = false;
      this.inputLocked = false;

      const fatal = this.isFatalEngineError(error);
      if (fatal) {
        this.aiSystemEnabled = false;
        this.coachSystemEnabled = false;
        this.engineStatus = {
          state: "unavailable",
          message: this.getEngineMessage(error) || this.t("engine.unavailable")
        };
        if (isAiState(this.whitePlayerType)) this.whitePlayerType = "HUMAN";
        if (isAiState(this.blackPlayerType)) this.blackPlayerType = "HUMAN";
      } else {
        this.engineStatus = {
          state: "idle",
          message: this.getEngineMessage(error)
        };
      }

      this.persistLatestGame();

      if (options.fromHint) {
        this.toast(fatal
          ? `${this.t("engine.hintUnavailable")} ${this.t("engine.continueLocal")}`
          : this.t("engine.hintFailed"));
      } else {
        const turnColor = this.getTurnColorKey();
        if (isAiState(this.getConfiguredPlayerType(turnColor))) {
          this.setConfiguredPlayerType(turnColor, "HUMAN");
        }
        this.toast(this.t("toast.engineMoveFailed"));
      }
    }

    getClaimDrawLabel() {
      if (!this.currentStatus) return this.t("buttons.claimDraw");
      if (this.currentStatus.canClaimThreefold) return this.t("buttons.claimThreefold");
      if (this.currentStatus.canClaimFiftyMove) return this.t("buttons.claimFiftyMove");
      return this.t("buttons.claimDraw");
    }

    getStatusBanner() {
      if (!this.currentState) {
        return this.t("status.startBoard");
      }

      if (this.isGameOver()) {
        return formatStatusReason(this.resultState, this.language) || this.t("status.gameOver");
      }

      if (this.pendingPromotion) {
        return this.t("status.choosePromotion");
      }

      if (this.aiThinking) {
        return this.t("status.aiThinking", { player: getPlayerLabel(this.getTurnColorKey(), this.language) });
      }

      if (this.lastHintSession?.loading) {
        return this.t("status.coachRunning");
      }

      if (this.currentStatus?.inCheck) {
        return this.t("status.inCheck", { player: getPlayerLabel(this.getTurnColorKey(), this.language) });
      }

      if (this.canClaimDraw()) {
        return this.t("status.drawAvailable", {
          reason: formatStatusReason(this.currentStatus, this.language)
        });
      }

      return this.t("status.toMove", { player: getPlayerLabel(this.getTurnColorKey(), this.language) });
    }

    getBoardNote() {
      if (!this.currentState) return this.t("board.note.startMatch");
      if (this.pendingPromotion) return this.t("board.note.promotion");
      if (this.isGameOver()) return this.t("board.note.gameOver");
      if (this.aiThinking) return this.t("board.note.aiThinking");
      if (this.currentStatus?.inCheck) return this.t("board.note.checkOnly");
      if (!this.isHumanTurn()) return this.t("board.note.engineControlled");
      return this.t("board.note.selectPiece");
    }

    getInfoPanelContent() {
      if (!this.currentState) {
        return {
          title: this.t("panel.boardInfo"),
          paragraphs: [this.t("info.choosePreset")]
        };
      }

      const paragraphs = [
        this.t("info.turn", { player: getPlayerLabel(this.getTurnColorKey(), this.language) }),
        this.t("info.lastMove", { move: this.lastMove ? this.lastMove.san : "-" }),
        this.t("info.status", {
          status: this.currentStatus?.inCheck ? this.t("info.statusCheck") : this.t("info.statusNormal")
        })
      ];

      if (this.engineStatus.message) {
        paragraphs.push(this.t("info.engine", { message: this.engineStatus.message }));
      }

      if (this.lastHintSession?.packet) {
        paragraphs.push(this.t("info.coach", {
          status: this.lastHintSession.loading ? this.t("info.coachAnalyzing") : this.t("info.coachReady")
        }));
      }

      if (this.canClaimDraw()) {
        paragraphs.push(this.t("info.draw", {
          reason: formatStatusReason(this.currentStatus, this.language)
        }));
      } else if (this.isGameOver()) {
        paragraphs.push(this.t("info.result", {
          reason: formatStatusReason(this.resultState, this.language) || this.t("status.gameOver")
        }));
      }

      return {
        title: this.t("panel.boardInfo"),
        paragraphs
      };
    }

    getResultSummary() {
      if (!this.resultState?.terminal) return null;

      if (this.resultState.result === "1-0" || this.resultState.result === "0-1") {
        const winner = this.resultState.result === "1-0" ? "white" : "black";
        return {
          title: formatStatusReason(this.resultState, this.language) || this.t("result.gameOver"),
          text: winner === "white" ? this.t("result.whiteWins") : this.t("result.blackWins")
        };
      }

      return {
        title: formatStatusReason(this.resultState, this.language) || this.t("result.gameOver"),
        text: this.t("result.draw")
      };
    }

    buildReviewSummary() {
      return this.currentState ? ChessReview.buildReviewSummary(this, this.language) : [];
    }

    getReviewSummary() {
      return this.buildReviewSummary();
    }

    canOpenReview() {
      return !!this.currentState && this.moveHistory.length > 0;
    }

    openReview() {
      if (!this.canOpenReview()) return;
      this.reviewState.frames = ChessReview.buildReplayFrames(this);
      this.reviewState.index = Math.max(0, this.reviewState.frames.length - 1);
      this.reviewState.open = true;
      this.refreshUi();
    }

    closeReview() {
      if (!this.reviewState.open) return;
      this.reviewState.open = false;
      this.refreshUi();
    }

    setReviewIndex(index) {
      if (!this.reviewState.frames.length) return;
      const clamped = Math.max(0, Math.min(index, this.reviewState.frames.length - 1));
      this.reviewState.index = clamped;
      this.refreshUi();
    }

    stepReview(delta) {
      this.setReviewIndex(this.reviewState.index + delta);
    }

    getActiveReviewFrame() {
      if (!this.reviewState.frames.length) return null;
      return this.reviewState.frames[this.reviewState.index] || null;
    }

    getCurrentFen() {
      return this.currentState ? ChessState.serializeFen(this.currentState) : "";
    }

    buildPgnText(metadata = {}) {
      return ChessPgn.buildPgn(this, {
        language: this.language,
        savedAt: this.resumeSnapshot?.savedAt || new Date().toISOString(),
        ...metadata
      });
    }

    exportPgn() {
      const pgnText = this.buildPgnText();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      this.notifyUi("downloadText", `forest-chess_${timestamp}.pgn`, pgnText);
      this.toast(this.t("export.pgnDone"));
      return pgnText;
    }

    copyFen() {
      const fen = this.getCurrentFen();
      if (!fen) return "";
      this.notifyUi("copyText", fen, this.t("export.fenDone"));
      return fen;
    }

    getHintButtonLabel() {
      if (!this.canUseCoach()) return this.t("buttons.coachOff");
      if (this.lastHintSession?.loading) return this.t("buttons.coachLoading");
      if (this.lastHintSession?.packet) {
        const current = this.lastHintSession.displayLevel || 1;
        const maxStage = this.lastHintSession.packet.availableStage || 1;
        if (current < maxStage) {
          return this.t("buttons.revealStage", { current: current + 1, max: maxStage });
        }
        return this.t("buttons.hintOpen");
      }
      return this.t("buttons.coachHint");
    }

    getEngineBadgeLabel() {
      if (!this.currentState) return this.t("engine.idle");
      if (this.aiThinking) return this.t("engine.aiThinkingBadge");
      if (this.lastHintSession?.loading) return this.t("engine.coachBadge");
      if (!this.canUseAi() && !this.canUseCoach()) return this.t("engine.offline");
      return this.t("engine.ready");
    }
  }

  return { Game };
});
