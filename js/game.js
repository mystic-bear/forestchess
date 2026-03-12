(function (root, factory) {
  let deps;
  if (typeof module !== "undefined" && module.exports) {
    deps = {
      ...require("../shared/constants.js"),
      ...require("../shared/utils.js"),
      ChessState: require("./chess/chess-state.js"),
      ChessRules: require("./chess/rules.js")
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
    DEFAULT_SETUP,
    QUICK_PRESETS,
    PLAYER_ORDER,
    SETUP_STATES,
    PLAYER_INFO,
    PIECE_LABEL_MODES,
    BOARD_ORIENTATION_OPTIONS,
    deepCopy,
    isAiState,
    getAiLevelFromState,
    getPlayerColorKey,
    getPlayerLabel,
    cycleOptionKey,
    formatStatusReason
  } = deps;

  const ChessState = deps.ChessState;
  const ChessRules = deps.ChessRules;

  class Game {
    constructor(options = {}) {
      this.aiBridge = options.aiBridge || null;
      this.ui = options.ui || null;
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
        message: this.aiBridge?.lastError?.message || ""
      };
      this.resetSession();
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
          message: aiBridge?.lastError?.message || "Engine worker unavailable."
        };
      }
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
    }

    get currentState() {
      return this.chessGame?.state || null;
    }

    get moveHistory() {
      return this.chessGame?.history || [];
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
      this.refreshUi();
    }

    cycleBoardOrientationSetting() {
      this.boardOrientation = cycleOptionKey(BOARD_ORIENTATION_OPTIONS, this.boardOrientation);
      this.notifyUi("renderSetup");
      this.refreshUi();
    }

    toggleBoardOrientation() {
      this.boardOrientation = this.boardOrientation === "white" ? "black" : "white";
      this.notifyUi("renderSetup");
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
      this.notifyUi("showScreen", "game-screen");
      this.refreshUi();

      if ((isAiState(this.setupPlayers.white) || isAiState(this.setupPlayers.black)) && !this.canUseAi()) {
        this.toast("Engine unavailable. This match will continue as a local board.");
      }

      this.maybeRequestAiMove();
    }

    restart() {
      this.startFromSetup();
    }

    toMenu() {
      this.cancelPendingAsync();
      this.resetSession();
      this.invalidateAsyncState();
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

        if (!this.currentStatus?.terminal && source !== "ai-failure") {
          this.maybeRequestAiMove();
        }

        this.engineStatus = {
          state: this.canUseAi() ? "idle" : "unavailable",
          message: this.canUseAi() ? "" : this.engineStatus.message
        };

        this.refreshUi();
      } catch (error) {
        this.toast("The move could not be applied.");
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
        this.toast("Pick a valid promotion piece.");
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
          message: this.engineStatus.message || "Engine unavailable. Continue locally."
        };
        this.toast("Engine unavailable. Continue locally on the same board.");
        this.refreshUi();
        return;
      }

      this.requestAiMove();
    }

    requestAiMove() {
      if (!this.currentState || !this.isAiTurn() || this.aiThinking || this.isGameOver()) return;

      const stateVersion = this.stateVersion;
      const level = getAiLevelFromState(this.getTurnPlayerType()) || 1;
      this.aiThinking = true;
      this.inputLocked = true;
      this.engineStatus = {
        state: "thinking",
        message: `${PLAYER_INFO[this.getTurnColorKey()].label} AI is thinking.`
      };
      this.refreshUi();

      this.aiBridge.chooseMove(
        this.buildGameStateForAI({ hintMode: false }),
        level,
        stateVersion,
        {
          onProgress: (progressMeta) => {
            if (stateVersion !== this.stateVersion || !this.aiThinking) return;
            const depth = progressMeta?.depth ? ` depth ${progressMeta.depth}` : "";
            this.engineStatus = {
              state: "thinking",
              message: `${PLAYER_INFO[this.getTurnColorKey()].label} AI is searching${depth}.`
            };
            this.refreshUi();
          }
        }
      ).then((result) => {
        if (stateVersion !== this.stateVersion) return;
        const move = result?.move || null;
        if (!move?.uci) {
          throw new Error("Engine did not return a legal move.");
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
        this.toast("Coach hints are unavailable.");
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
          this.toast("Coach analysis is still running.");
          return;
        }
        if (currentSession.packet && currentSession.displayLevel >= maxStage) {
          this.toast("The full hint is already open.");
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
        this.lastHintSession.error = error.message;
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
          message: error?.message || "Engine unavailable."
        };
        if (isAiState(this.whitePlayerType)) this.whitePlayerType = "HUMAN";
        if (isAiState(this.blackPlayerType)) this.blackPlayerType = "HUMAN";
      } else {
        this.engineStatus = {
          state: "idle",
          message: error?.message || ""
        };
      }

      if (options.fromHint) {
        this.toast(fatal
          ? "Coach is unavailable. The board still works locally."
          : "The coach could not finish this hint.");
      } else {
        const turnColor = this.getTurnColorKey();
        if (isAiState(this.getConfiguredPlayerType(turnColor))) {
          this.setConfiguredPlayerType(turnColor, "HUMAN");
        }
        this.toast("Engine move failed. Continue locally on the same board.");
      }
    }

    getClaimDrawLabel() {
      if (!this.currentStatus) return "Claim draw";
      if (this.currentStatus.canClaimThreefold) return "Threefold draw";
      if (this.currentStatus.canClaimFiftyMove) return "Fifty-move draw";
      return "Claim draw";
    }

    getStatusBanner() {
      if (!this.currentState) {
        return "Start a match to load the 8x8 board.";
      }

      if (this.isGameOver()) {
        return formatStatusReason(this.resultState) || "Game over";
      }

      if (this.pendingPromotion) {
        return "Choose a promotion piece.";
      }

      if (this.aiThinking) {
        return `${getPlayerLabel(this.getTurnColorKey())} AI is thinking.`;
      }

      if (this.lastHintSession?.loading) {
        return "Coach analysis is running.";
      }

      if (this.currentStatus?.inCheck) {
        return `${getPlayerLabel(this.getTurnColorKey())} to move in check`;
      }

      if (this.canClaimDraw()) {
        return `${formatStatusReason(this.currentStatus)}. Use the draw button to finish the game.`;
      }

      return `${getPlayerLabel(this.getTurnColorKey())} to move`;
    }

    getBoardNote() {
      if (!this.currentState) return "Start a match to open the board.";
      if (this.pendingPromotion) return "Pick the piece for promotion.";
      if (this.isGameOver()) return "You can restart the game or return to the menu.";
      if (this.aiThinking) return "The engine is searching for the reply.";
      if (this.currentStatus?.inCheck) return "Only legal check escapes are available.";
      if (!this.isHumanTurn()) return "This side is controlled by the engine.";
      return "Select one of your pieces to see its legal moves.";
    }

    getInfoPanelContent() {
      if (!this.currentState) {
        return {
          title: "Board info",
          paragraphs: ["Choose a preset or open custom setup to start a match."]
        };
      }

      const paragraphs = [
        `Turn: ${getPlayerLabel(this.getTurnColorKey())}`,
        `Last move: ${this.lastMove ? this.lastMove.san : "-"}`,
        `Status: ${this.currentStatus?.inCheck ? "Check" : "Normal"}`
      ];

      if (this.engineStatus.message) {
        paragraphs.push(`Engine: ${this.engineStatus.message}`);
      }

      if (this.lastHintSession?.packet) {
        paragraphs.push(`Coach: ${this.lastHintSession.loading ? "Analyzing" : "Ready"}`);
      }

      if (this.canClaimDraw()) {
        paragraphs.push(`Draw: ${formatStatusReason(this.currentStatus)}`);
      } else if (this.isGameOver()) {
        paragraphs.push(`Result: ${formatStatusReason(this.resultState) || "Game over"}`);
      }

      return {
        title: "Board info",
        paragraphs
      };
    }

    getResultSummary() {
      if (!this.resultState?.terminal) return null;

      if (this.resultState.result === "1-0" || this.resultState.result === "0-1") {
        const winner = this.resultState.result === "1-0" ? "white" : "black";
        return {
          title: formatStatusReason(this.resultState) || "Game over",
          text: `${getPlayerLabel(winner)} wins`
        };
      }

      return {
        title: formatStatusReason(this.resultState) || "Draw",
        text: "This game ended in a draw."
      };
    }

    getHintButtonLabel() {
      if (!this.canUseCoach()) return "Coach off";
      if (this.lastHintSession?.loading) return "Coach...";
      if (this.lastHintSession?.packet) {
        const current = this.lastHintSession.displayLevel || 1;
        const maxStage = this.lastHintSession.packet.availableStage || 1;
        if (current < maxStage) return `Reveal ${current + 1}/${maxStage}`;
        return "Hint open";
      }
      return "Coach hint";
    }

    getEngineBadgeLabel() {
      if (!this.currentState) return "Idle";
      if (this.aiThinking) return "AI thinking";
      if (this.lastHintSession?.loading) return "Coach";
      if (!this.canUseAi() && !this.canUseCoach()) return "Offline";
      return "Ready";
    }
  }

  return { Game };
});
