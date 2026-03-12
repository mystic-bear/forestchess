(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const AI_LEVEL_INFO_LOCAL = root.AI_LEVEL_INFO || {};
  const PIECE_THEME_LOCAL = root.PIECE_THEME || {};
  const PLAYER_INFO_LOCAL = root.PLAYER_INFO || {};
  const PLAYER_ORDER_LOCAL = root.PLAYER_ORDER || ["white", "black"];

  const deepCopy = (value) => JSON.parse(JSON.stringify(value));

  const isAiState = (state) => typeof state === "string" && state.startsWith("AI-");

  const getAiLevelFromState = (state) => {
    if (!isAiState(state)) return null;
    const level = Number(String(state).split("-")[1]);
    return Number.isInteger(level) ? level : null;
  };

  const getSetupStateLabel = (state, compact = false) => {
    if (state === "HUMAN") return compact ? "Human" : "Human player";
    const level = getAiLevelFromState(state);
    const info = AI_LEVEL_INFO_LOCAL[level];
    return compact ? (info?.short || state) : (info?.label || state);
  };

  const getSetupStateDescription = (state) => {
    if (state === "HUMAN") return "Manual local control.";
    const level = getAiLevelFromState(state);
    const info = AI_LEVEL_INFO_LOCAL[level];
    if (!info) return "Engine control.";
    return `${info.desc} Stockfish profile.`;
  };

  const getPieceTypeFromCode = (pieceOrType) => {
    if (!pieceOrType || typeof pieceOrType !== "string") return null;
    return pieceOrType.toLowerCase();
  };

  const getPieceThemeInfo = (pieceOrType) => PIECE_THEME_LOCAL[getPieceTypeFromCode(pieceOrType)] || null;

  const getPieceEmoji = (pieceOrType) => getPieceThemeInfo(pieceOrType)?.emoji || "";

  const getPieceDisplayLabel = (pieceOrType, mode = "both") => {
    const info = getPieceThemeInfo(pieceOrType);
    if (!info) return "";
    if (mode === "animal") return info.animal;
    if (mode === "chess") return info.chess;
    return `${info.animal} (${info.chess})`;
  };

  const getPlayerColorKey = (turn) => (turn === "w" ? "white" : "black");

  const getPlayerLabel = (colorKey) => PLAYER_INFO_LOCAL[colorKey]?.label || colorKey;

  const cycleOptionKey = (options, currentKey) => {
    const index = options.findIndex((option) => option.key === currentKey);
    const nextIndex = index >= 0 ? (index + 1) % options.length : 0;
    return options[nextIndex].key;
  };

  const groupHistoryByMove = (history) => {
    const rows = [];
    for (let index = 0; index < history.length; index += 2) {
      rows.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: history[index] || null,
        black: history[index + 1] || null
      });
    }
    return rows;
  };

  const formatStatusReason = (status) => {
    if (!status) return "";
    if (status.reason === "checkmate") return "Checkmate";
    if (status.reason === "stalemate") return "Stalemate";
    if (status.reason === "insufficient-material") return "Draw by insufficient material";
    if (status.reason === "threefold-repetition") return "Threefold repetition available";
    if (status.reason === "fifty-move-rule") return "Fifty-move draw available";
    return "";
  };

  const buildSetupSummary = (setupPlayers) => (
    PLAYER_ORDER_LOCAL
      .map((colorKey) => `${PLAYER_INFO_LOCAL[colorKey]?.label || colorKey}: ${getSetupStateLabel(setupPlayers[colorKey], true)}`)
      .join(" / ")
  );

  const describeHintStage = (level) => {
    if (level === 1) return "Direction";
    if (level === 2) return "Candidate";
    return "Exact move";
  };

  const safeArray = (value) => (Array.isArray(value) ? value : []);

  const formatEngineScore = (scoreCp, scoreMate) => {
    if (Number.isInteger(scoreMate)) {
      return scoreMate > 0 ? `Mate in ${scoreMate}` : `Mated in ${Math.abs(scoreMate)}`;
    }
    if (typeof scoreCp === "number") {
      const pawns = Math.abs(scoreCp / 100).toFixed(2);
      return `${scoreCp >= 0 ? "+" : "-"}${pawns}`;
    }
    return "n/a";
  };

  return {
    deepCopy,
    isAiState,
    getAiLevelFromState,
    getSetupStateLabel,
    getSetupStateDescription,
    getPieceTypeFromCode,
    getPieceThemeInfo,
    getPieceEmoji,
    getPieceDisplayLabel,
    getPlayerColorKey,
    getPlayerLabel,
    cycleOptionKey,
    groupHistoryByMove,
    formatStatusReason,
    buildSetupSummary,
    describeHintStage,
    safeArray,
    formatEngineScore
  };
});
