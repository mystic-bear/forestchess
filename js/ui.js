const ui = {
  showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.add("hidden"));
    const target = document.getElementById(id);
    if (target) target.classList.remove("hidden");
  },

  showSetup() {
    document.getElementById("menu-main").classList.add("hidden");
    document.getElementById("menu-setup").classList.remove("hidden");
    this.renderSetup();
  },

  hideSetup() {
    document.getElementById("menu-setup").classList.add("hidden");
    document.getElementById("menu-main").classList.remove("hidden");
    this.renderStart();
  },

  renderStart() {
    const presetList = document.getElementById("quick-start-list");
    const summary = document.getElementById("setup-summary");
    if (!presetList || !summary) return;

    presetList.innerHTML = "";
    QUICK_PRESETS.forEach((preset) => {
      const button = document.createElement("button");
      button.className = `preset-card ${preset.enabled ? "enabled" : "disabled"}`;
      button.disabled = !preset.enabled;
      button.innerHTML = `
        <div class="preset-top">
          <div class="preset-title">${preset.label}</div>
          <div class="preset-chip">${preset.subtitle}</div>
        </div>
        <div class="preset-detail">${preset.detail}</div>
      `;
      if (preset.enabled) {
        button.onclick = () => game.applyPreset(preset.key);
      }
      presetList.appendChild(button);
    });

    summary.innerHTML = `
      <div class="setup-summary-title">현재 설정</div>
      <div class="setup-summary-body">${buildSetupSummary(game.setupPlayers)}</div>
    `;
  },

  renderSetup() {
    const playerList = document.getElementById("setup-player-list");
    const optionList = document.getElementById("setup-option-list");
    if (!playerList || !optionList) return;

    playerList.innerHTML = "";
    PLAYER_ORDER.forEach((colorKey) => {
      const player = PLAYER_INFO[colorKey];
      const state = game.setupPlayers[colorKey];
      const row = document.createElement("div");
      row.className = "setup-row";
      row.innerHTML = `
        <div class="setup-main">
          <div class="setup-icon ${colorKey}">${player.icon}</div>
          <div>
            <div class="setup-title">${player.label} / ${player.korean}</div>
            <div class="setup-desc">${getSetupStateDescription(state)}</div>
          </div>
        </div>
        <button class="state-btn ${isAiState(state) ? "ai" : "human"}">${getSetupStateLabel(state)}</button>
      `;
      row.querySelector("button").onclick = () => game.cycleSetupState(colorKey);
      playerList.appendChild(row);
    });

    const labelMode = PIECE_LABEL_MODES.find((entry) => entry.key === game.pieceLabelMode) || PIECE_LABEL_MODES[0];
    const orientation = BOARD_ORIENTATION_OPTIONS.find((entry) => entry.key === game.boardOrientation) || BOARD_ORIENTATION_OPTIONS[0];
    const options = [
      {
        title: "기물 표시",
        desc: "동물명, 체스명, 병기 모드 중 하나를 선택합니다.",
        buttonLabel: labelMode.label,
        action: () => game.cyclePieceLabelMode()
      },
      {
        title: "보드 방향",
        desc: "게임 화면에서 기본 보드 방향을 정합니다.",
        buttonLabel: orientation.label,
        action: () => game.cycleBoardOrientationSetting()
      }
    ];

    optionList.innerHTML = "";
    options.forEach((option) => {
      const row = document.createElement("div");
      row.className = "setup-row";
      row.innerHTML = `
        <div class="setup-main">
          <div class="setup-icon option">♟</div>
          <div>
            <div class="setup-title">${option.title}</div>
            <div class="setup-desc">${option.desc}</div>
          </div>
        </div>
        <button class="state-btn option">${option.buttonLabel}</button>
      `;
      row.querySelector("button").onclick = option.action;
      optionList.appendChild(row);
    });

    this.updateSetupStartButton();
  },

  updateSetupStartButton() {
    const button = document.getElementById("btn-start-match");
    if (!button) return;

    const playable = game.isSetupPlayableNow();
    button.disabled = !playable;
    button.innerText = playable
      ? "사람 vs 사람 대국 시작"
      : "AI 대국은 다음 단계에서 연결";
  },

  renderPlayerPanels() {
    const container = document.getElementById("player-panel-list");
    if (!container) return;
    container.innerHTML = "";

    PLAYER_ORDER.forEach((colorKey) => {
      const player = PLAYER_INFO[colorKey];
      const currentTurn = game.currentState && getPlayerColorKey(game.currentState.turn) === colorKey;
      const inCheck = game.currentStatus?.inCheck && currentTurn;
      const type = game.getConfiguredPlayerType(colorKey);

      const card = document.createElement("div");
      card.className = `player-card ${currentTurn ? "active" : ""}`;
      card.style.borderColor = player.accent;
      card.innerHTML = `
        <div class="player-card-top">
          <div>
            <div class="player-name">${player.label} / ${player.korean}</div>
            <div class="player-sub">${getSetupStateLabel(type, true)}</div>
          </div>
          <div class="player-badge ${colorKey}">${currentTurn ? "현재 차례" : "대기 중"}</div>
        </div>
        <div class="player-meta">${inCheck ? "체크 상태" : "정상 상태"}</div>
      `;
      container.appendChild(card);
    });
  },

  renderThemeLegend() {
    const container = document.getElementById("theme-legend");
    if (!container) return;
    container.innerHTML = "";

    Object.entries(PIECE_THEME).forEach(([pieceType, info]) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <div class="legend-emoji">${info.emoji}</div>
        <div class="legend-label">${getPieceDisplayLabel(pieceType, game.pieceLabelMode)}</div>
      `;
      container.appendChild(item);
    });
  },

  renderBoard() {
    const boardShell = document.getElementById("board-grid");
    const turnChip = document.getElementById("turn-chip");
    const lastMoveChip = document.getElementById("last-move-chip");
    const claimChip = document.getElementById("claim-chip");
    const boardNote = document.getElementById("board-note");
    const statusLine = document.getElementById("status-line");

    if (!boardShell) return;

    statusLine.innerText = game.getStatusBanner();
    boardNote.innerText = game.getBoardNote();
    turnChip.innerText = `차례 ${game.currentState ? getPlayerLabel(game.getTurnColorKey()) : "-"}`;
    lastMoveChip.innerText = `마지막 수 ${game.lastMove ? game.lastMove.san : "-"}`;
    claimChip.innerText = game.canClaimDraw() ? game.getClaimDrawLabel() : "무승부 없음";
    claimChip.classList.toggle("muted", !game.canClaimDraw());

    if (!game.currentState) {
      boardShell.innerHTML = `<div class="board-empty">대국을 시작하면 8x8 체스보드가 표시됩니다.</div>`;
      return;
    }

    const fileOrder = game.boardOrientation === "white"
      ? [...ChessState.FILES]
      : [...ChessState.FILES].reverse();
    const rankOrder = game.boardOrientation === "white"
      ? [8, 7, 6, 5, 4, 3, 2, 1]
      : [1, 2, 3, 4, 5, 6, 7, 8];

    const board = document.createElement("div");
    board.className = "board-grid";

    rankOrder.forEach((rankNum, rowIndex) => {
      fileOrder.forEach((fileChar, colIndex) => {
        const square = `${fileChar}${rankNum}`;
        const index = ChessState.squareToIndex(square);
        const fileIndex = ChessState.FILES.indexOf(fileChar);
        const isDark = (fileIndex + rankNum) % 2 === 1;
        const piece = game.currentState.board[index];
        const pieceColor = piece ? ChessState.pieceColor(piece) : null;
        const targetMoves = game.legalTargets.filter((move) => move.to === index);
        const isCaptureTarget = targetMoves.some((move) => move.flags.capture || move.flags.enPassant);
        const isSelected = game.selectedSquare === index;
        const isLastFrom = game.lastMove && ChessState.squareToIndex(game.lastMove.from) === index;
        const isLastTo = game.lastMove && ChessState.squareToIndex(game.lastMove.to) === index;
        const isCheckSquare = game.checkSquare === index;
        const button = document.createElement("button");

        button.className = [
          "square",
          isDark ? "dark" : "light",
          isSelected ? "selected" : "",
          targetMoves.length > 0 ? "legal-target" : "",
          isCaptureTarget ? "capture-target" : "",
          isLastFrom ? "last-from" : "",
          isLastTo ? "last-to" : "",
          isCheckSquare ? "in-check" : ""
        ].filter(Boolean).join(" ");
        button.onclick = () => game.handleSquareClick(index);
        button.disabled = game.isGameOver();

        if (colIndex === 0) {
          const rankLabel = document.createElement("span");
          rankLabel.className = "coord rank";
          rankLabel.innerText = String(rankNum);
          button.appendChild(rankLabel);
        }

        if (rowIndex === rankOrder.length - 1) {
          const fileLabel = document.createElement("span");
          fileLabel.className = "coord file";
          fileLabel.innerText = fileChar;
          button.appendChild(fileLabel);
        }

        if (piece) {
          button.appendChild(this.createPieceNode(piece, pieceColor));
        } else if (targetMoves.length > 0) {
          const target = document.createElement("span");
          target.className = isCaptureTarget ? "capture-ring" : "target-dot";
          button.appendChild(target);
        }

        board.appendChild(button);
      });
    });

    boardShell.innerHTML = "";
    boardShell.appendChild(board);
  },

  createPieceNode(piece, pieceColor) {
    const wrapper = document.createElement("div");
    wrapper.className = `piece ${pieceColor === "w" ? "white" : "black"}`;
    wrapper.innerHTML = `
      <div class="piece-emoji">${getPieceEmoji(piece)}</div>
      <div class="piece-label">${getPieceDisplayLabel(piece, game.pieceLabelMode)}</div>
    `;
    return wrapper;
  },

  renderInfoPanel() {
    const panel = document.getElementById("info-panel");
    if (!panel) return;

    const info = game.getInfoPanelContent();
    panel.innerHTML = `
      <div class="info-title">${info.title}</div>
      ${info.paragraphs.map((paragraph) => `<div class="info-line">${paragraph}</div>`).join("")}
    `;
  },

  renderCapturedPieces() {
    const whiteContainer = document.getElementById("captured-white");
    const blackContainer = document.getElementById("captured-black");
    if (!whiteContainer || !blackContainer) return;

    const renderList = (container, items) => {
      container.innerHTML = "";
      if (items.length === 0) {
        container.innerHTML = `<div class="capture-empty">없음</div>`;
        return;
      }

      items.forEach((pieceType) => {
        const chip = document.createElement("div");
        chip.className = "capture-chip";
        chip.innerHTML = `<span>${getPieceEmoji(pieceType)}</span><span>${getPieceDisplayLabel(pieceType, game.pieceLabelMode)}</span>`;
        container.appendChild(chip);
      });
    };

    renderList(whiteContainer, game.capturedWhite);
    renderList(blackContainer, game.capturedBlack);
  },

  renderMoveList() {
    const container = document.getElementById("move-list");
    if (!container) return;
    container.innerHTML = "";

    if (game.moveHistory.length === 0) {
      container.innerHTML = `<div class="move-empty">첫 수를 기다리는 중입니다.</div>`;
      return;
    }

    const rows = groupHistoryByMove(game.moveHistory);
    const lastSan = game.lastMove?.san || null;
    rows.forEach((row) => {
      const item = document.createElement("div");
      item.className = "move-row";
      item.innerHTML = `
        <div class="move-number">${row.moveNumber}.</div>
        <div class="move-cell ${row.white?.san === lastSan ? "active" : ""}">${row.white?.san || ""}</div>
        <div class="move-cell ${row.black?.san === lastSan ? "active" : ""}">${row.black?.san || ""}</div>
      `;
      container.appendChild(item);
    });
  },

  renderPromotionModal() {
    const modal = document.getElementById("promotion-modal");
    const options = document.getElementById("promotion-options");
    if (!modal || !options) return;

    if (!game.pendingPromotion) {
      modal.classList.add("hidden");
      options.innerHTML = "";
      return;
    }

    modal.classList.remove("hidden");
    options.innerHTML = "";
    game.pendingPromotion.moves.forEach((move) => {
      const button = document.createElement("button");
      button.className = "promotion-btn";
      button.innerHTML = `
        <div class="promotion-emoji">${getPieceEmoji(move.promotion)}</div>
        <div class="promotion-label">${getPieceDisplayLabel(move.promotion, game.pieceLabelMode)}</div>
      `;
      button.onclick = () => game.applyPromotionChoice(move.promotion);
      options.appendChild(button);
    });
  },

  renderResultModal() {
    const modal = document.getElementById("result-modal");
    const title = document.getElementById("result-title");
    const text = document.getElementById("result-text");
    if (!modal || !title || !text) return;

    const summary = game.getResultSummary();
    if (!summary) {
      modal.classList.add("hidden");
      return;
    }

    title.innerText = summary.title;
    text.innerText = summary.text;
    modal.classList.remove("hidden");
  },

  updateButtons() {
    const undoButton = document.getElementById("btn-undo-move");
    const drawButton = document.getElementById("btn-claim-draw");
    const hintButton = document.getElementById("btn-hint");
    if (undoButton) undoButton.disabled = !game.canUndo();
    if (drawButton) {
      drawButton.disabled = !game.canClaimDraw();
      drawButton.innerText = game.canClaimDraw() ? game.getClaimDrawLabel() : "무승부 확인";
    }
    if (hintButton) hintButton.disabled = false;
  },

  updateAll() {
    this.renderStart();
    this.renderSetup();
    this.renderPlayerPanels();
    this.renderThemeLegend();
    this.renderBoard();
    this.renderInfoPanel();
    this.renderCapturedPieces();
    this.renderMoveList();
    this.renderPromotionModal();
    this.renderResultModal();
    this.updateButtons();
  },

  toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.innerText = message;
    node.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      node.classList.remove("show");
    }, 2200);
  }
};
