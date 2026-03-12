const ui = {
  t(key, params = {}) {
    const language = window.game?.language || DEFAULT_LANGUAGE;
    return translateUi(language, key, params);
  },

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

  applyStaticText() {
    const language = window.game?.language || DEFAULT_LANGUAGE;
    document.documentElement.lang = language;
    document.title = this.t("document.title");
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.innerText = this.t(node.dataset.i18n);
    });
  },

  renderLanguageSelector() {
    const container = document.getElementById("language-switcher");
    if (!container || !window.game) return;

    container.innerHTML = "";
    LANGUAGE_OPTIONS.forEach((entry) => {
      const button = document.createElement("button");
      button.className = `language-btn ${game.language === entry.key ? "active" : ""}`;
      button.innerText = entry.nativeLabel;
      button.onclick = () => game.setLanguage(entry.key);
      container.appendChild(button);
    });
  },

  renderStart() {
    const presetList = document.getElementById("quick-start-list");
    const summary = document.getElementById("setup-summary");
    if (!presetList || !summary || !window.game) return;

    presetList.innerHTML = "";
    QUICK_PRESETS.forEach((preset) => {
      const button = document.createElement("button");
      button.className = `preset-card ${preset.enabled ? "enabled" : "disabled"}`;
      button.disabled = !preset.enabled;
      button.innerHTML = `
        <div class="preset-top">
          <div class="preset-title">${resolveLocalizedText(preset.label, game.language)}</div>
          <div class="preset-chip">${resolveLocalizedText(preset.subtitle, game.language)}</div>
        </div>
        <div class="preset-detail">${resolveLocalizedText(preset.detail, game.language)}</div>
      `;
      if (preset.enabled) {
        button.onclick = () => game.applyPreset(preset.key);
      }
      presetList.appendChild(button);
    });

    summary.innerHTML = `
      <div class="setup-summary-title">${this.t("start.currentSetup")}</div>
      <div class="setup-summary-body">${buildSetupSummary(game.setupPlayers, game.language)}</div>
    `;
  },

  renderSetup() {
    const playerList = document.getElementById("setup-player-list");
    const optionList = document.getElementById("setup-option-list");
    if (!playerList || !optionList || !window.game) return;

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
            <div class="setup-title">${resolveLocalizedText(player.label, game.language)}</div>
            <div class="setup-desc">${getSetupStateDescription(state, game.language)}</div>
          </div>
        </div>
        <button class="state-btn ${isAiState(state) ? "ai" : "human"}">${getSetupStateLabel(state, false, game.language)}</button>
      `;
      row.querySelector("button").onclick = () => game.cycleSetupState(colorKey);
      playerList.appendChild(row);
    });

    const labelMode = PIECE_LABEL_MODES.find((entry) => entry.key === game.pieceLabelMode) || PIECE_LABEL_MODES[0];
    const orientation = BOARD_ORIENTATION_OPTIONS.find((entry) => entry.key === game.boardOrientation) || BOARD_ORIENTATION_OPTIONS[0];
    const options = [
      {
        title: this.t("setup.option.pieceLabels.title"),
        desc: this.t("setup.option.pieceLabels.desc"),
        buttonLabel: resolveLocalizedText(labelMode.label, game.language),
        action: () => game.cyclePieceLabelMode()
      },
      {
        title: this.t("setup.option.boardOrientation.title"),
        desc: this.t("setup.option.boardOrientation.desc"),
        buttonLabel: resolveLocalizedText(orientation.label, game.language),
        action: () => game.cycleBoardOrientationSetting()
      }
    ];

    optionList.innerHTML = "";
    options.forEach((option) => {
      const row = document.createElement("div");
      row.className = "setup-row";
      row.innerHTML = `
        <div class="setup-main">
          <div class="setup-icon option">*</div>
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
    if (!button || !window.game) return;

    button.disabled = !game.canStartMatch();
    if (game.hasAiConfigured() && !game.canUseAi()) {
      button.innerText = this.t("buttons.startLocalBoard");
      return;
    }
    button.innerText = this.t("buttons.startMatch");
  },

  renderPlayerPanels() {
    const container = document.getElementById("player-panel-list");
    if (!container || !window.game) return;
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
            <div class="player-name">${resolveLocalizedText(player.label, game.language)}</div>
            <div class="player-sub">${getSetupStateLabel(type, true, game.language)}</div>
          </div>
          <div class="player-badge ${colorKey}">${currentTurn ? this.t("player.toMove") : this.t("player.waiting")}</div>
        </div>
        <div class="player-meta">${inCheck ? this.t("player.inCheck") : game.aiThinking && currentTurn ? this.t("player.engineSearching") : this.t("player.stable")}</div>
      `;
      container.appendChild(card);
    });
  },

  renderThemeLegend() {
    const container = document.getElementById("theme-legend");
    if (!container || !window.game) return;
    container.innerHTML = "";

    Object.entries(PIECE_THEME).forEach(([pieceType, info]) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <div class="legend-emoji">${info.emoji}</div>
        <div class="legend-label">${getPieceDisplayLabel(pieceType, game.pieceLabelMode, game.language)}</div>
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
    const engineChip = document.getElementById("engine-chip");

    if (!boardShell || !window.game) return;

    if (statusLine) statusLine.innerText = game.getStatusBanner();
    if (boardNote) boardNote.innerText = game.getBoardNote();
    if (turnChip) {
      turnChip.innerText = this.t("board.turnChip", {
        player: game.currentState ? getPlayerLabel(game.getTurnColorKey(), game.language) : "-"
      });
    }
    if (lastMoveChip) {
      lastMoveChip.innerText = this.t("board.lastChip", {
        move: game.lastMove ? game.lastMove.san : "-"
      });
    }
    if (claimChip) {
      claimChip.innerText = game.canClaimDraw() ? game.getClaimDrawLabel() : this.t("board.noDraw");
      claimChip.classList.toggle("muted", !game.canClaimDraw());
    }
    if (engineChip) engineChip.innerText = game.getEngineBadgeLabel();

    if (!game.currentState) {
      boardShell.innerHTML = `<div class="board-empty">${this.t("board.empty")}</div>`;
      return;
    }

    const fileOrder = game.boardOrientation === "white"
      ? [...ChessState.FILES]
      : [...ChessState.FILES].reverse();
    const rankOrder = game.boardOrientation === "white"
      ? [8, 7, 6, 5, 4, 3, 2, 1]
      : [1, 2, 3, 4, 5, 6, 7, 8];
    const hintHighlight = game.getHintHighlight();
    const hintFrom = hintHighlight ? ChessState.squareToIndex(hintHighlight.from) : null;
    const hintTo = hintHighlight ? ChessState.squareToIndex(hintHighlight.to) : null;

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
          isCheckSquare ? "in-check" : "",
          hintFrom === index ? "hint-source" : "",
          hintTo === index ? "hint-target" : ""
        ].filter(Boolean).join(" ");
        button.onclick = () => game.handleSquareClick(index);
        button.disabled = !game.canInteractWithBoard();

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
          const pieceTitle = getPieceDisplayLabel(piece, "both", game.language);
          button.title = pieceTitle;
          button.setAttribute("aria-label", `${square} ${pieceTitle}`);
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
    const pieceTitle = getPieceDisplayLabel(piece, "both", game.language);
    wrapper.title = pieceTitle;
    wrapper.setAttribute("aria-label", pieceTitle);
    wrapper.innerHTML = `<div class="piece-emoji">${getPieceEmoji(piece)}</div>`;
    return wrapper;
  },

  renderInfoPanel() {
    const panel = document.getElementById("info-panel");
    if (!panel || !window.game) return;

    const info = game.getInfoPanelContent();
    panel.innerHTML = `
      <div class="info-title">${info.title}</div>
      ${info.paragraphs.map((paragraph) => `<div class="info-line">${paragraph}</div>`).join("")}
    `;
  },

  renderHintPanel() {
    const panel = document.getElementById("hint-panel");
    if (!panel || !window.game) return;

    if (!game.currentState) {
      panel.innerHTML = `
        <div class="hint-empty">
          <div class="hint-title">${this.t("panel.coachPanel")}</div>
          <div class="hint-line">${this.t("hint.emptyStart")}</div>
        </div>
      `;
      return;
    }

    const session = game.lastHintSession;
    if (!session) {
      panel.innerHTML = `
        <div class="hint-empty">
          <div class="hint-title">${this.t("panel.coachPanel")}</div>
          <div class="hint-line">${this.t("hint.emptyUse")}</div>
        </div>
      `;
      return;
    }

    const packet = session.packet;
    const stage = game.getActiveHintStage();

    if (!packet) {
      panel.innerHTML = `
        <div class="hint-card">
          <div class="hint-header-row">
            <div class="hint-title">${this.t("panel.coachPanel")}</div>
            <div class="hint-chip">${session.loading ? this.t("hint.analyzing") : this.t("hint.waiting")}</div>
          </div>
          <div class="hint-line">${this.t("hint.analysisPreparing")}</div>
        </div>
      `;
      return;
    }

    const stageRow = packet.stages.map((entry) => `
      <button class="hint-stage-btn ${entry.level === (session.displayLevel || 1) ? "active" : ""}" ${entry.level > packet.availableStage ? "disabled" : ""} onclick="game.setHintStage(${entry.level})">
        ${entry.label}
      </button>
    `).join("");

    const alternatives = (packet.alternatives || []).map((entry) => `
      <div class="hint-alt-row">
        <span>${entry.moveSan || entry.moveUci}</span>
        <span>${entry.note}</span>
      </div>
    `).join("");

    const steps = (stage?.steps || packet.steps || []).map((step) => `<li>${step}</li>`).join("");
    const confidenceLabel = packet.confidence ? this.t(`hint.confidence.${packet.confidence}`) : this.t("hint.confidence.medium");

    panel.innerHTML = `
      <div class="hint-card ${packet.partial ? "partial" : ""}">
        <div class="hint-header-row">
          <div>
            <div class="hint-title">${packet.title}</div>
            <div class="hint-subtitle">${packet.partial ? this.t("hint.partialAnalysis") : this.t("hint.fullAnalysis")}</div>
          </div>
          <div class="hint-chip">${confidenceLabel}</div>
        </div>
        <div class="hint-stage-row">${stageRow}</div>
        <div class="hint-summary">${stage?.summary || packet.summary}</div>
        <div class="hint-lead">${stage?.leadText || packet.leadText || ""}</div>
        <div class="hint-reason">${stage?.reason || packet.reason || ""}</div>
        <ul class="hint-steps">${steps}</ul>
        <div class="hint-meta-row">
          <div class="hint-meta"><strong>${this.t("hint.meta.move")}</strong> ${packet.moveSan || packet.moveUci || "-"}</div>
          <div class="hint-meta"><strong>${this.t("hint.meta.threat")}</strong> ${packet.threatSummary || "-"}</div>
        </div>
        <div class="hint-meta-row">
          <div class="hint-meta"><strong>${this.t("hint.meta.from")}</strong> ${packet.from || "-"}</div>
          <div class="hint-meta"><strong>${this.t("hint.meta.to")}</strong> ${packet.to || "-"}</div>
        </div>
        ${alternatives ? `<div class="hint-alt-block"><div class="hint-alt-title">${this.t("hint.meta.alternatives")}</div>${alternatives}</div>` : ""}
        ${packet.truncationNote ? `<div class="hint-note">${packet.truncationNote}</div>` : ""}
        ${session.error ? `<div class="hint-note warn">${session.error}</div>` : ""}
      </div>
    `;
  },

  renderCapturedPieces() {
    const whiteContainer = document.getElementById("captured-white");
    const blackContainer = document.getElementById("captured-black");
    if (!whiteContainer || !blackContainer || !window.game) return;

    const renderList = (container, items) => {
      container.innerHTML = "";
      if (items.length === 0) {
        container.innerHTML = `<div class="capture-empty">${this.t("capture.none")}</div>`;
        return;
      }

      items.forEach((pieceType) => {
        const chip = document.createElement("div");
        chip.className = "capture-chip";
        chip.innerHTML = `<span>${getPieceEmoji(pieceType)}</span><span>${getPieceDisplayLabel(pieceType, game.pieceLabelMode, game.language)}</span>`;
        container.appendChild(chip);
      });
    };

    renderList(whiteContainer, game.capturedWhite);
    renderList(blackContainer, game.capturedBlack);
  },

  renderMoveList() {
    const container = document.getElementById("move-list");
    if (!container || !window.game) return;
    container.innerHTML = "";

    if (game.moveHistory.length === 0) {
      container.innerHTML = `<div class="move-empty">${this.t("moves.waiting")}</div>`;
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
    if (!modal || !options || !window.game) return;

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
        <div class="promotion-label">${getPieceDisplayLabel(move.promotion, game.pieceLabelMode, game.language)}</div>
      `;
      button.onclick = () => game.applyPromotionChoice(move.promotion);
      options.appendChild(button);
    });
  },

  renderResultModal() {
    const modal = document.getElementById("result-modal");
    const title = document.getElementById("result-title");
    const text = document.getElementById("result-text");
    if (!modal || !title || !text || !window.game) return;

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
      drawButton.innerText = game.canClaimDraw() ? game.getClaimDrawLabel() : this.t("buttons.claimDraw");
    }
    if (hintButton) {
      hintButton.disabled = !game.currentState || game.isGameOver() || game.pendingPromotion || !game.canUseCoach();
      hintButton.innerText = game.getHintButtonLabel();
    }
  },

  updateAll() {
    this.applyStaticText();
    this.renderLanguageSelector();
    this.renderStart();
    this.renderSetup();
    this.renderPlayerPanels();
    this.renderThemeLegend();
    this.renderBoard();
    this.renderInfoPanel();
    this.renderHintPanel();
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
