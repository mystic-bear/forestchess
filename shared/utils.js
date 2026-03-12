const deepCopy = (value) => JSON.parse(JSON.stringify(value));

const isAiState = (state) => typeof state === "string" && state.startsWith("AI-");

const getAiLevelFromState = (state) => {
  if (!isAiState(state)) return null;
  return Number(String(state).split("-")[1]) || null;
};

const getSetupStateLabel = (state, compact = false) => {
  if (state === "HUMAN") return compact ? "사람" : "사람 플레이어";
  const level = getAiLevelFromState(state);
  const info = AI_LEVEL_INFO[level];
  return compact ? (info?.short || state) : (info?.label || state);
};

const getSetupStateDescription = (state) => {
  if (state === "HUMAN") return "직접 둘 수 있습니다.";
  const level = getAiLevelFromState(state);
  const info = AI_LEVEL_INFO[level];
  return info ? `${info.desc} · 다음 단계에서 연결` : "AI 연결 준비 중";
};

const getPieceTypeFromCode = (pieceOrType) => {
  if (!pieceOrType) return null;
  if (typeof pieceOrType !== "string") return null;
  return pieceOrType.length === 1 ? pieceOrType.toLowerCase() : pieceOrType.toLowerCase();
};

const getPieceThemeInfo = (pieceOrType) => PIECE_THEME[getPieceTypeFromCode(pieceOrType)] || null;

const getPieceEmoji = (pieceOrType) => getPieceThemeInfo(pieceOrType)?.emoji || "";

const getPieceDisplayLabel = (pieceOrType, mode = "both") => {
  const info = getPieceThemeInfo(pieceOrType);
  if (!info) return "";
  if (mode === "animal") return info.animal;
  if (mode === "chess") return info.chess;
  return `${info.animal}(${info.chess})`;
};

const getPlayerColorKey = (turn) => (turn === "w" ? "white" : "black");

const getPlayerLabel = (colorKey) => {
  const info = PLAYER_INFO[colorKey];
  return info ? `${info.label} / ${info.korean}` : colorKey;
};

const cycleOptionKey = (options, currentKey) => {
  const index = options.findIndex((option) => option.key === currentKey);
  const nextIndex = index >= 0 ? (index + 1) % options.length : 0;
  return options[nextIndex].key;
};

const groupHistoryByMove = (history) => {
  const rows = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: history[i] || null,
      black: history[i + 1] || null
    });
  }
  return rows;
};

const formatStatusReason = (status) => {
  if (!status) return "";
  if (status.reason === "checkmate") return "체크메이트";
  if (status.reason === "stalemate") return "스테일메이트";
  if (status.reason === "insufficient-material") return "기물 부족 무승부";
  if (status.reason === "threefold-repetition") return "3회 반복 무승부 가능";
  if (status.reason === "fifty-move-rule") return "50수 룰 무승부 가능";
  return "";
};

const buildSetupSummary = (setupPlayers) => (
  PLAYER_ORDER.map((colorKey) => `${PLAYER_INFO[colorKey].korean}: ${getSetupStateLabel(setupPlayers[colorKey], true)}`).join(" · ")
);
