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
  const HINT_STAGE_INFO_LOCAL = root.HINT_STAGE_INFO || {};
  const PLAYER_ANIMALS_LOCAL = root.PLAYER_ANIMALS || [];
  const DEFAULT_LANGUAGE = root.DEFAULT_LANGUAGE || "ko";
  const translateUi = root.translateUi || ((language, key, params = {}) => {
    const fallback = String(key || "");
    return fallback.replace(/\{(\w+)\}/g, (_, token) => {
      const value = params[token];
      return value === undefined || value === null ? "" : String(value);
    });
  });

  const deepCopy = (value) => JSON.parse(JSON.stringify(value));

  const isAiState = (state) => typeof state === "string" && state.startsWith("AI-");

  const getAiLevelFromState = (state) => {
    if (!isAiState(state)) return null;
    const level = Number(String(state).split("-")[1]);
    return Number.isInteger(level) ? level : null;
  };

  const resolveLocalizedText = (value, language = DEFAULT_LANGUAGE) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value;
    if (typeof value === "object") {
      return value[language]
        ?? value[DEFAULT_LANGUAGE]
        ?? value.en
        ?? Object.values(value)[0]
        ?? "";
    }
    return String(value);
  };

  const getSetupStateLabel = (state, compact = false, language = DEFAULT_LANGUAGE) => {
    if (state === "HUMAN") {
      return compact
        ? translateUi(language, "setup.state.humanShort")
        : translateUi(language, "setup.state.human");
    }
    const level = getAiLevelFromState(state);
    const info = AI_LEVEL_INFO_LOCAL[level];
    return compact ? (info?.short || state) : (resolveLocalizedText(info?.label, language) || state);
  };

  const getSetupStateDescription = (state, language = DEFAULT_LANGUAGE) => {
    if (state === "HUMAN") return translateUi(language, "setup.state.humanDesc");
    const level = getAiLevelFromState(state);
    const info = AI_LEVEL_INFO_LOCAL[level];
    const desc = resolveLocalizedText(info?.desc, language);
    if (!desc) return translateUi(language, "engine.unavailable");
    return translateUi(language, "setup.state.aiDescription", { desc });
  };

  const getPieceTypeFromCode = (pieceOrType) => {
    if (!pieceOrType || typeof pieceOrType !== "string") return null;
    return pieceOrType.toLowerCase();
  };

  const getPieceThemeInfo = (pieceOrType) => PIECE_THEME_LOCAL[getPieceTypeFromCode(pieceOrType)] || null;

  const getPieceEmoji = (pieceOrType) => getPieceThemeInfo(pieceOrType)?.emoji || "";

  const getPieceDisplayLabel = (pieceOrType, mode = "both", language = DEFAULT_LANGUAGE) => {
    const info = getPieceThemeInfo(pieceOrType);
    if (!info) return "";
    const animal = resolveLocalizedText(info.animal, language);
    const chess = resolveLocalizedText(info.chess, language);
    if (mode === "animal") return animal;
    if (mode === "chess") return chess;
    return `${animal} (${chess})`;
  };

  const getPlayerColorKey = (turn) => (turn === "w" ? "white" : "black");

  const getPlayerLabel = (colorKey, language = DEFAULT_LANGUAGE) => (
    resolveLocalizedText(PLAYER_INFO_LOCAL[colorKey]?.label, language) || colorKey
  );

  const getPlayerAnimalInfo = (animalKey) => {
    if (!animalKey) return PLAYER_ANIMALS_LOCAL[0] || null;
    return PLAYER_ANIMALS_LOCAL.find((entry) => entry.key === animalKey) || PLAYER_ANIMALS_LOCAL[0] || null;
  };

  const getPlayerAnimalEmoji = (animalKey) => getPlayerAnimalInfo(animalKey)?.emoji || "🐻";

  const getPlayerAnimalLabel = (animalKey, language = DEFAULT_LANGUAGE) => (
    resolveLocalizedText(getPlayerAnimalInfo(animalKey)?.label, language) || ""
  );

  const formatPlayerRoleWithAnimal = (state, animalKey, language = DEFAULT_LANGUAGE) => {
    const role = getSetupStateLabel(state, true, language);
    const animal = getPlayerAnimalLabel(animalKey, language);
    return animal ? `${role} / ${animal}` : role;
  };

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

  const formatStatusReason = (status, language = DEFAULT_LANGUAGE) => {
    if (!status) return "";
    if (status.reason === "checkmate") return translateUi(language, "reason.checkmate");
    if (status.reason === "stalemate") return translateUi(language, "reason.stalemate");
    if (status.reason === "insufficient-material") return translateUi(language, "reason.insufficient-material");
    if (status.reason === "threefold-repetition") return translateUi(language, "reason.threefold-repetition");
    if (status.reason === "fifty-move-rule") return translateUi(language, "reason.fifty-move-rule");
    return "";
  };

  const buildSetupSummary = (setupPlayers, language = DEFAULT_LANGUAGE, setupPlayerAnimals = null) => (
    PLAYER_ORDER_LOCAL
      .map((colorKey) => {
        const roleText = setupPlayerAnimals
          ? formatPlayerRoleWithAnimal(setupPlayers[colorKey], setupPlayerAnimals[colorKey], language)
          : getSetupStateLabel(setupPlayers[colorKey], true, language);
        return `${getPlayerLabel(colorKey, language)}: ${roleText}`;
      })
      .join(" / ")
  );

  const describeHintStage = (level, language = DEFAULT_LANGUAGE) => {
    const entry = HINT_STAGE_INFO_LOCAL[level];
    return resolveLocalizedText(entry?.label, language) || String(level);
  };

  const safeArray = (value) => (Array.isArray(value) ? value : []);

  const formatEngineScore = (scoreCp, scoreMate, language = DEFAULT_LANGUAGE) => {
    if (Number.isInteger(scoreMate)) {
      if (language === "ko") {
        return scoreMate > 0 ? `${scoreMate}수 메이트` : `${Math.abs(scoreMate)}수 뒤 메이트 당함`;
      }
      return scoreMate > 0 ? `Mate in ${scoreMate}` : `Mated in ${Math.abs(scoreMate)}`;
    }
    if (typeof scoreCp === "number") {
      const pawns = Math.abs(scoreCp / 100).toFixed(2);
      return `${scoreCp >= 0 ? "+" : "-"}${pawns}`;
    }
    return language === "ko" ? "없음" : "n/a";
  };

  return {
    deepCopy,
    isAiState,
    getAiLevelFromState,
    resolveLocalizedText,
    getSetupStateLabel,
    getSetupStateDescription,
    getPieceTypeFromCode,
    getPieceThemeInfo,
    getPieceEmoji,
    getPieceDisplayLabel,
    getPlayerColorKey,
    getPlayerLabel,
    getPlayerAnimalInfo,
    getPlayerAnimalEmoji,
    getPlayerAnimalLabel,
    formatPlayerRoleWithAnimal,
    cycleOptionKey,
    groupHistoryByMove,
    formatStatusReason,
    buildSetupSummary,
    describeHintStage,
    safeArray,
    formatEngineScore
  };
});
