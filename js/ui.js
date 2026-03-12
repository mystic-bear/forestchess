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
    const resumeCard = document.getElementById("resume-card");
    if (!presetList || !summary || !window.game) return;

    presetList.innerHTML = "";
    QUICK_PRESETS.forEach((preset) => {
      const button = document.createElement("button");
      button.className = `preset-card ${preset.enabled ? "enabled" : "disabled"}`;
      button.disabled = !preset.enabled;
      const emojiRow = Array.isArray(preset.emojiRow)
        ? preset.emojiRow.map((entry) => `<span class="preset-emoji">${entry}</span>`).join("")
        : "";
      button.innerHTML = `
        <div class="preset-top">
          <div class="preset-title">${resolveLocalizedText(preset.label, game.language)}</div>
          <div class="preset-chip">${resolveLocalizedText(preset.subtitle, game.language)}</div>
        </div>
        <div class="preset-detail">${resolveLocalizedText(preset.detail, game.language)}</div>
        <div class="preset-emoji-row">${emojiRow}</div>
      `;
      if (preset.enabled) {
        button.onclick = () => game.applyPreset(preset.key);
      }
      presetList.appendChild(button);
    });

    summary.innerHTML = `
      <div class="setup-summary-title">${this.t("start.currentSetup")}</div>
      <div class="setup-summary-body">${buildSetupSummary(game.setupPlayers, game.language, game.setupPlayerAnimals)}</div>
    `;

    if (resumeCard) {
      const resumeInfo = game.getResumeInfo();
      if (!resumeInfo) {
        resumeCard.classList.add("hidden");
        resumeCard.innerHTML = "";
      } else {
        resumeCard.classList.remove("hidden");
        resumeCard.innerHTML = `
          <div class="resume-meta">
            <div class="resume-title">${this.t("resume.title")}</div>
            <div class="resume-line">${this.t("resume.savedAt", { time: resumeInfo.savedAtLabel })}</div>
            <div class="resume-line">${resumeInfo.setupSummary}</div>
            <div class="resume-line">${this.t("resume.lastMove", { move: resumeInfo.lastMoveSan })}</div>
            <div class="resume-line">${resumeInfo.resultLine}</div>
          </div>
          <button class="action-btn primary">${this.t("resume.button")}</button>
        `;
        resumeCard.querySelector("button").onclick = () => game.resumeSavedGame();
      }
    }
  },

  renderSetup() {
    const playerList = document.getElementById("setup-player-list");
    const optionList = document.getElementById("setup-option-list");
    if (!playerList || !optionList || !window.game) return;

    playerList.innerHTML = "";
    PLAYER_ORDER.forEach((colorKey) => {
      const player = PLAYER_INFO[colorKey];
      const state = game.setupPlayers[colorKey];
      const animal = game.getPlayerAnimalInfo(colorKey);
      const row = document.createElement("div");
      row.className = "setup-row";
      row.innerHTML = `
        <div class="setup-main">
          <div class="setup-animal-badge ${colorKey}" title="${getPlayerAnimalLabel(animal?.key, game.language)}">${animal?.emoji || "🐻"}</div>
          <div>
            <div class="setup-title">${resolveLocalizedText(player.label, game.language)}</div>
            <div class="setup-desc">${formatPlayerRoleWithAnimal(state, animal?.key, game.language)}</div>
            <div class="setup-note">${getSetupStateDescription(state, game.language)}</div>
          </div>
        </div>
        <div class="setup-row-actions">
          <button class="state-btn option animal-btn">${this.t("buttons.changeAnimal")}</button>
          <button class="state-btn ${isAiState(state) ? "ai" : "human"}">${getSetupStateLabel(state, false, game.language)}</button>
        </div>
      `;
      const buttons = row.querySelectorAll("button");
      buttons[0].onclick = () => game.cyclePlayerAnimal(colorKey);
      buttons[1].onclick = () => game.cycleSetupState(colorKey);
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
      const animal = game.getPlayerAnimalInfo(colorKey);

      const card = document.createElement("div");
      card.className = `player-card ${currentTurn ? "active" : ""}`;
      card.style.borderColor = player.accent;
      card.innerHTML = `
        <div class="player-card-top">
          <div class="player-card-identity">
            <div class="player-animal-badge ${colorKey}" title="${getPlayerAnimalLabel(animal?.key, game.language)}">${animal?.emoji || "🐻"}</div>
            <div>
              <div class="player-name">${resolveLocalizedText(player.label, game.language)}</div>
              <div class="player-sub">${formatPlayerRoleWithAnimal(type, animal?.key, game.language)}</div>
            </div>
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
    const reviewSummary = document.getElementById("review-summary");
    const analysisProgress = document.getElementById("analysis-progress");
    const analysisCardList = document.getElementById("analysis-card-list");
    const analyzeButton = document.getElementById("btn-analyze-game");
    const replayButton = document.getElementById("btn-open-review");
    const exportButton = document.getElementById("btn-export-pgn");
    const copyFenButton = document.getElementById("btn-copy-fen");
    if (!modal || !title || !text || !window.game) return;

    const summary = game.getResultSummary();
    if (!summary) {
      modal.classList.add("hidden");
      if (reviewSummary) reviewSummary.innerHTML = "";
      if (analysisCardList) analysisCardList.innerHTML = "";
      if (analysisProgress) analysisProgress.classList.add("hidden");
      return;
    }

    title.innerText = summary.title;
    text.innerText = summary.text;
    if (reviewSummary) {
      reviewSummary.innerHTML = game.getReviewSummary()
        .map((line) => `<div class="review-line">${line}</div>`)
        .join("");
    }
    if (analyzeButton) analyzeButton.innerText = this.t("analysis.start");
    if (replayButton) replayButton.innerText = this.t("review.open");
    if (exportButton) exportButton.innerText = this.t("export.pgn");
    if (copyFenButton) copyFenButton.innerText = this.t("export.copyFen");

    const finishedGameId = game.finishedGameId || null;
    const isActiveAnalysis = finishedGameId && game.analysisState.gameId === finishedGameId;
    const cards = finishedGameId ? game.getAnalysisCardsForGame(finishedGameId) : [];
    const progressParts = game.analysisState.progress || null;
    if (analysisProgress) {
      if (isActiveAnalysis && game.analysisState.loading) {
        analysisProgress.classList.remove("hidden");
        analysisProgress.innerText = this.t("analysis.running", {
          completed: progressParts?.completed || 0,
          total: progressParts?.total || game.moveHistory.length
        });
      } else if (finishedGameId && cards.length > 0) {
        analysisProgress.classList.remove("hidden");
        analysisProgress.innerText = this.t("analysis.doneCount", { count: cards.length });
      } else {
        analysisProgress.classList.add("hidden");
        analysisProgress.innerText = "";
      }
    }
    this.renderAnalysisCards(analysisCardList, cards, finishedGameId);
    modal.classList.remove("hidden");
  },

  renderAnalysisCards(container, cards, gameId = null, options = {}) {
    if (!container || !window.game) return;
    container.innerHTML = "";

    if (!Array.isArray(cards) || cards.length === 0) {
      if (options.showEmpty !== false) {
        container.innerHTML = `<div class="analysis-empty">${this.t("analysis.empty")}</div>`;
      }
      return;
    }

    cards.forEach((card) => {
      const node = document.createElement("div");
      node.className = "analysis-card";
      const categoryLabel = this.t(`analysis.category.${card.category}`);
      const themeLabel = this.t(`analysis.theme.${card.theme}`);
      node.innerHTML = `
        <div class="analysis-head">
          <div class="analysis-title">${card.summary}</div>
          <div class="analysis-chip">${categoryLabel} · ${themeLabel}</div>
        </div>
        <div class="analysis-meta">
          <div><strong>${this.t("analysis.playedMove")}</strong> ${card.moveSan || card.playedUci || "-"}</div>
          <div><strong>${this.t("analysis.betterMove")}</strong> ${card.bestSan || card.bestUci || "-"}</div>
          <div>${card.explanation}</div>
          <div>${card.retryPrompt}</div>
        </div>
        <div class="analysis-actions">
          <button class="action-btn secondary">${this.t("analysis.jump")}</button>
          <button class="action-btn primary">${this.t("analysis.playFromHere")}</button>
        </div>
      `;
      const [jumpButton, playButton] = node.querySelectorAll("button");
      jumpButton.onclick = () => game.jumpToCriticalMoment(gameId, card.ply);
      playButton.onclick = () => game.playFromCriticalMoment(gameId, card.ply);
      container.appendChild(node);
    });
  },

  renderReviewOverlay() {
    const overlay = document.getElementById("review-overlay");
    const note = document.getElementById("review-board-note");
    const boardShell = document.getElementById("review-board-grid");
    if (!overlay || !note || !boardShell || !window.game) return;

    if (!game.reviewState.open) {
      overlay.classList.add("hidden");
      boardShell.innerHTML = "";
      return;
    }

    const frame = game.getActiveReviewFrame();
    if (!frame) {
      overlay.classList.add("hidden");
      return;
    }

    const state = ChessState.parseFen(frame.fen);
    const fileOrder = game.boardOrientation === "white"
      ? [...ChessState.FILES]
      : [...ChessState.FILES].reverse();
    const rankOrder = game.boardOrientation === "white"
      ? [8, 7, 6, 5, 4, 3, 2, 1]
      : [1, 2, 3, 4, 5, 6, 7, 8];

    note.innerText = frame.san
      ? this.t("review.noteMove", { ply: frame.ply, move: frame.san })
      : this.t("review.noteStart");

    const board = document.createElement("div");
    board.className = "board-grid";

    rankOrder.forEach((rankNum, rowIndex) => {
      fileOrder.forEach((fileChar, colIndex) => {
        const square = `${fileChar}${rankNum}`;
        const index = ChessState.squareToIndex(square);
        const fileIndex = ChessState.FILES.indexOf(fileChar);
        const isDark = (fileIndex + rankNum) % 2 === 1;
        const piece = state.board[index];
        const pieceColor = piece ? ChessState.pieceColor(piece) : null;
        const isLastFrom = frame.lastMove?.from && ChessState.squareToIndex(frame.lastMove.from) === index;
        const isLastTo = frame.lastMove?.to && ChessState.squareToIndex(frame.lastMove.to) === index;

        const button = document.createElement("button");
        button.className = [
          "square",
          isDark ? "dark" : "light",
          isLastFrom ? "last-from" : "",
          isLastTo ? "last-to" : ""
        ].filter(Boolean).join(" ");
        button.disabled = true;

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
          button.appendChild(this.createPieceNode(piece, pieceColor));
        }

        board.appendChild(button);
      });
    });

    boardShell.innerHTML = "";
    boardShell.appendChild(board);
    overlay.classList.remove("hidden");
  },

  renderArchiveOverlay() {
    const overlay = document.getElementById("archive-overlay");
    const list = document.getElementById("archive-list");
    if (!overlay || !list || !window.game) return;

    if (!game.archiveOverlayOpen) {
      overlay.classList.add("hidden");
      list.innerHTML = "";
      return;
    }

    const archiveGames = game.getArchiveGames();
    if (!archiveGames.length) {
      list.innerHTML = `<div class="archive-empty">${this.t("archive.empty")}</div>`;
      overlay.classList.remove("hidden");
      return;
    }

    const locale = game.language === "ko" ? "ko-KR" : "en-US";
    list.innerHTML = "";
    archiveGames.forEach((record) => {
      const cards = game.getAnalysisCardsForGame(record.id);
      const activeAnalysis = game.analysisState.gameId === record.id && game.analysisState.loading;
      const entry = document.createElement("div");
      entry.className = "archive-entry";
      entry.innerHTML = `
        <div class="archive-head">
          <div>
            <div class="archive-title">${buildSetupSummary(record.setupPlayers || {
              white: record.whitePlayerType,
              black: record.blackPlayerType
            }, game.language)}</div>
            <div class="archive-meta">
              <div>${this.t("archive.finishedAt", { time: new Date(record.finishedAt || record.savedAt).toLocaleString(locale) })}</div>
              <div>${this.t("archive.result", { result: record.result || "*" })}</div>
              <div>${record.reviewSummary?.line1 || ""}</div>
              <div>${record.reviewSummary?.line2 || ""}</div>
              <div>${record.reviewSummary?.line3 || ""}</div>
            </div>
          </div>
          <div class="analysis-chip">${this.t(`analysis.status.${activeAnalysis ? "queued" : (record.analysisStatus || "none")}`)}</div>
        </div>
        <div class="archive-actions">
          <button class="action-btn secondary">${this.t("review.open")}</button>
          <button class="action-btn secondary">${this.t("analysis.start")}</button>
          <button class="action-btn secondary">${this.t("archive.delete")}</button>
        </div>
        <div class="analysis-progress ${activeAnalysis ? "" : "hidden"}">${activeAnalysis ? this.t("analysis.running", {
          completed: game.analysisState.progress?.completed || 0,
          total: game.analysisState.progress?.total || (record.moveHistoryUci || []).length
        }) : ""}</div>
        <div class="analysis-inline-list"></div>
      `;
      const buttons = entry.querySelectorAll(".archive-actions button");
      buttons[0].onclick = () => game.openFinishedGameReview(record.id);
      buttons[1].onclick = () => game.requestPostGameAnalysis(record.id);
      buttons[2].onclick = () => game.deleteArchivedGame(record.id);
      this.renderAnalysisCards(entry.querySelector(".analysis-inline-list"), cards, record.id, {
        showEmpty: activeAnalysis || record.analysisStatus === "done"
      });
      list.appendChild(entry);
    });

    overlay.classList.remove("hidden");
  },

  updateButtons() {
    const undoButton = document.getElementById("btn-undo-move");
    const drawButton = document.getElementById("btn-claim-draw");
    const hintButton = document.getElementById("btn-hint");
    const archiveButton = document.getElementById("btn-open-archive");
    const analyzeButton = document.getElementById("btn-analyze-game");
    const replayButton = document.getElementById("btn-open-review");
    const exportButton = document.getElementById("btn-export-pgn");
    const copyFenButton = document.getElementById("btn-copy-fen");

    if (undoButton) undoButton.disabled = !game.canUndo();
    if (drawButton) {
      drawButton.disabled = !game.canClaimDraw();
      drawButton.innerText = game.canClaimDraw() ? game.getClaimDrawLabel() : this.t("buttons.claimDraw");
    }
    if (hintButton) {
      hintButton.disabled = !game.currentState || game.isGameOver() || game.pendingPromotion || !game.canUseCoach();
      hintButton.innerText = game.getHintButtonLabel();
    }
    if (archiveButton) archiveButton.disabled = !game.hasArchiveGames();
    if (analyzeButton) {
      analyzeButton.disabled = !game.finishedGameId || game.analysisState.loading;
      analyzeButton.innerText = game.analysisState.loading ? this.t("analysis.runningShort") : this.t("analysis.start");
    }
    if (replayButton) replayButton.disabled = !game.canOpenReview();
    if (exportButton) exportButton.disabled = !game.currentState;
    if (copyFenButton) copyFenButton.disabled = !game.currentState;
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
    this.renderReviewOverlay();
    this.renderArchiveOverlay();
    this.updateButtons();
  },

  copyText(text, successMessage) {
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          if (successMessage) this.toast(successMessage);
        })
        .catch(() => {
          this.fallbackCopyText(text, successMessage);
        });
      return;
    }
    this.fallbackCopyText(text, successMessage);
  },

  fallbackCopyText(text, successMessage) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      if (successMessage) this.toast(successMessage);
    } catch (error) {
      this.toast(text);
    }
    document.body.removeChild(textarea);
  },

  downloadText(filename, text) {
    if (typeof document === "undefined") return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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
