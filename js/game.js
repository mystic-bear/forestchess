class Game {
  constructor() {
    this.setupPlayers = deepCopy(DEFAULT_SETUP);
    this.whitePlayerType = DEFAULT_SETUP.white;
    this.blackPlayerType = DEFAULT_SETUP.black;
    this.pieceLabelMode = "both";
    this.boardOrientation = "white";
    this.modeKey = "local-human";
    this.stateVersion = 0;
    this.asyncEpoch = 0;
    this.inputLocked = false;
    this.lastHint = null;
    this.resetSession();
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

  isSetupPlayableNow() {
    return PLAYER_ORDER.every((colorKey) => this.setupPlayers[colorKey] === "HUMAN");
  }

  hasAiConfigured() {
    return PLAYER_ORDER.some((colorKey) => isAiState(this.setupPlayers[colorKey]));
  }

  getConfiguredPlayerType(colorKey) {
    return colorKey === "white" ? this.whitePlayerType : this.blackPlayerType;
  }

  applyPreset(presetKey) {
    const preset = QUICK_PRESETS.find((entry) => entry.key === presetKey);
    if (!preset) return;

    this.modeKey = preset.key;
    this.setupPlayers = deepCopy(preset.setup);
    ui.renderStart();
    ui.renderSetup();

    if (preset.enabled) {
      this.startFromSetup();
      return;
    }

    ui.showSetup();
    ui.toast("AI 대국은 다음 단계에서 연결됩니다. 이번 단계에서는 사람 vs 사람만 시작할 수 있어요.");
  }

  cycleSetupState(colorKey) {
    const current = this.setupPlayers[colorKey];
    const currentIndex = SETUP_STATES.indexOf(current);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % SETUP_STATES.length : 0;
    this.setupPlayers[colorKey] = SETUP_STATES[nextIndex];
    ui.renderStart();
    ui.renderSetup();
  }

  cyclePieceLabelMode() {
    this.pieceLabelMode = cycleOptionKey(PIECE_LABEL_MODES, this.pieceLabelMode);
    ui.renderSetup();
    ui.updateAll();
  }

  cycleBoardOrientationSetting() {
    this.boardOrientation = cycleOptionKey(BOARD_ORIENTATION_OPTIONS, this.boardOrientation);
    ui.renderSetup();
    ui.updateAll();
  }

  toggleBoardOrientation() {
    this.boardOrientation = this.boardOrientation === "white" ? "black" : "white";
    ui.renderSetup();
    ui.updateAll();
  }

  startFromSetup() {
    if (!this.isSetupPlayableNow()) {
      ui.toast("AI 대국은 다음 단계에서 연결됩니다. 이번 단계에서는 사람 vs 사람만 시작할 수 있어요.");
      ui.renderSetup();
      return;
    }

    this.whitePlayerType = this.setupPlayers.white;
    this.blackPlayerType = this.setupPlayers.black;
    this.lastHint = null;
    this.inputLocked = false;
    this.resetSession();
    this.chessGame = ChessRules.createGame();
    this.invalidateAsyncState();
    this.refreshDerivedState();
    ui.showScreen("game-screen");
    ui.updateAll();
  }

  restart() {
    if (!this.isSetupPlayableNow()) {
      ui.toast("현재 설정은 AI 포함 상태입니다. 사람 vs 사람 설정으로 바꿔 주세요.");
      this.toMenu();
      return;
    }

    this.whitePlayerType = this.setupPlayers.white;
    this.blackPlayerType = this.setupPlayers.black;
    this.lastHint = null;
    this.inputLocked = false;
    this.resetSession();
    this.chessGame = ChessRules.createGame();
    this.invalidateAsyncState();
    this.refreshDerivedState();
    ui.showScreen("game-screen");
    ui.updateAll();
  }

  toMenu() {
    this.selectedSquare = null;
    this.pendingPromotion = null;
    this.resultState = null;
    this.inputLocked = false;
    this.lastHint = null;
    this.invalidateAsyncState();
    ui.hideSetup();
    ui.showScreen("start-screen");
    ui.renderStart();
    ui.renderSetup();
    ui.updateAll();
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
      const currentTargets = this.currentLegalMoves.filter((move) => move.from === this.selectedSquare);
      if (currentTargets.length === 0) {
        this.selectedSquare = null;
        this.legalTargets = [];
      } else {
        this.legalTargets = currentTargets;
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
    if (updateUi) ui.updateAll();
  }

  handleSquareClick(index) {
    if (!this.currentState || this.pendingPromotion || this.isGameOver()) return;

    const piece = this.currentState.board[index];
    const pieceColor = piece ? ChessState.pieceColor(piece) : null;
    const turnColor = this.currentState.turn;

    if (piece && pieceColor === turnColor) {
      if (this.selectedSquare === index) {
        this.clearSelection();
      } else {
        this.selectedSquare = index;
        this.legalTargets = this.currentLegalMoves.filter((move) => move.from === index);
        ui.updateAll();
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
      ui.updateAll();
      return;
    }

    this.applyHumanMove(matchingMoves[0]);
  }

  applyHumanMove(move) {
    try {
      this.chessGame = ChessRules.makeMove(this.chessGame, move.uci || move);
      this.selectedSquare = null;
      this.legalTargets = [];
      this.pendingPromotion = null;
      this.resultState = null;
      this.inputLocked = false;
      this.lastHint = null;
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

      ui.updateAll();
    } catch (error) {
      console.error("Move apply failed:", error);
      ui.toast("수를 적용하는 중 오류가 발생했어요.");
    }
  }

  applyPromotionChoice(promotion) {
    if (!this.pendingPromotion) return;
    const move = this.pendingPromotion.moves.find((candidate) => candidate.promotion === promotion);
    if (!move) {
      ui.toast("프로모션 선택을 다시 확인하세요.");
      return;
    }
    this.applyHumanMove(move);
  }

  cancelPromotion() {
    if (!this.pendingPromotion) return;
    this.pendingPromotion = null;
    this.inputLocked = false;
    this.legalTargets = this.selectedSquare === null
      ? []
      : this.currentLegalMoves.filter((move) => move.from === this.selectedSquare);
    ui.updateAll();
  }

  undoMove() {
    if (!this.chessGame || this.moveHistory.length === 0) return;
    const remainingMoves = this.moveHistory.slice(0, -1).map((entry) => entry.uci);
    this.chessGame = ChessRules.playMoves(remainingMoves, { fen: this.chessGame.initialFen });
    this.resultState = null;
    this.pendingPromotion = null;
    this.inputLocked = false;
    this.clearSelection(false);
    this.invalidateAsyncState();
    this.refreshDerivedState();
    ui.updateAll();
  }

  canUndo() {
    return this.moveHistory.length > 0;
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
    this.invalidateAsyncState();
    this.refreshDerivedState();
    ui.updateAll();
  }

  isGameOver() {
    return !!this.resultState?.terminal;
  }

  requestHint() {
    ui.toast("코치 힌트는 다음 단계에서 연결됩니다.");
  }

  getTurnColorKey() {
    return this.currentState ? getPlayerColorKey(this.currentState.turn) : "white";
  }

  getClaimDrawLabel() {
    if (!this.currentStatus) return "무승부 확인";
    if (this.currentStatus.canClaimThreefold) return "반복 무승부";
    if (this.currentStatus.canClaimFiftyMove) return "50수 무승부";
    return "무승부 확인";
  }

  getStatusBanner() {
    if (!this.currentState) {
      return "대국을 시작하면 8x8 보드가 열립니다.";
    }

    if (this.isGameOver()) {
      return formatStatusReason(this.resultState) || "대국 종료";
    }

    if (this.pendingPromotion) {
      return "프로모션 기물을 선택하세요.";
    }

    if (this.currentStatus?.inCheck) {
      return `${getPlayerLabel(this.getTurnColorKey())} 체크`;
    }

    if (this.canClaimDraw()) {
      return `${formatStatusReason(this.currentStatus)} · 확인 버튼으로 종료할 수 있습니다.`;
    }

    return `${getPlayerLabel(this.getTurnColorKey())} 차례`;
  }

  getBoardNote() {
    if (!this.currentState) return "대국을 시작하세요.";
    if (this.pendingPromotion) return "폰이 마지막 줄에 도착했습니다. 프로모션 말을 선택하세요.";
    if (this.isGameOver()) return "대국이 종료되었습니다. 다시 시작하거나 메뉴로 돌아갈 수 있습니다.";
    if (this.currentStatus?.inCheck) return "체크 상태입니다. 체크를 해소하는 합법 수만 둘 수 있습니다.";
    return "자기 기물을 선택하면 합법 수가 강조됩니다.";
  }

  getInfoPanelContent() {
    if (!this.currentState) {
      return {
        title: "대국 대기",
        paragraphs: ["시작 화면에서 사람 vs 사람 설정으로 대국을 시작하세요."]
      };
    }

    const paragraphs = [
      `현재 차례: ${getPlayerLabel(this.getTurnColorKey())}`,
      `마지막 수: ${this.lastMove ? this.lastMove.san : "아직 없음"}`,
      `상태: ${this.currentStatus?.inCheck ? "체크" : "정상"}`
    ];

    if (this.canClaimDraw()) {
      paragraphs.push(`알림: ${formatStatusReason(this.currentStatus)} 상태입니다.`);
    } else if (this.isGameOver()) {
      paragraphs.push(`결과: ${formatStatusReason(this.resultState) || "대국 종료"}`);
    } else {
      paragraphs.push("힌트 버튼은 다음 단계에서 연결됩니다.");
    }

    return {
      title: "대국 정보",
      paragraphs
    };
  }

  getResultSummary() {
    if (!this.resultState?.terminal) return null;

    if (this.resultState.result === "1-0" || this.resultState.result === "0-1") {
      const winner = this.resultState.result === "1-0" ? "white" : "black";
      return {
        title: formatStatusReason(this.resultState) || "대국 종료",
        text: `${getPlayerLabel(winner)} 승리`
      };
    }

    return {
      title: formatStatusReason(this.resultState) || "무승부",
      text: "이번 대국은 무승부로 끝났습니다."
    };
  }
}
