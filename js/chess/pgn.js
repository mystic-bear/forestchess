(function (root, factory) {
  let deps;
  if (typeof module !== "undefined" && module.exports) {
    deps = {
      ...require("../../shared/constants.js"),
      ...require("../../shared/utils.js")
    };
  } else {
    deps = root;
  }

  const api = factory(deps);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ChessPgn = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";

  const getAiLevelFromState = deps.getAiLevelFromState;
  const resolveLocalizedText = deps.resolveLocalizedText;
  const AI_LEVEL_INFO = deps.AI_LEVEL_INFO || {};

  function resolvePlayerName(type, language = "en") {
    if (!type || type === "HUMAN") {
      return language === "ko" ? "사람" : "Human";
    }
    const level = getAiLevelFromState(type);
    if (!level) return String(type);
    return resolveLocalizedText(AI_LEVEL_INFO[level]?.label, language) || type;
  }

  function formatDateTag(value) {
    const date = value ? new Date(value) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  }

  function getResultString(gameLike) {
    if (gameLike?.resultState?.result) return gameLike.resultState.result;
    if (gameLike?.currentStatus?.terminal && gameLike.currentStatus.result) return gameLike.currentStatus.result;
    return "*";
  }

  function buildMoveText(history) {
    const parts = [];
    for (let index = 0; index < history.length; index += 2) {
      const moveNumber = Math.floor(index / 2) + 1;
      const white = history[index];
      const black = history[index + 1];
      let segment = `${moveNumber}. ${white?.san || ""}`.trimEnd();
      if (black?.san) segment += ` ${black.san}`;
      parts.push(segment);
    }
    return parts.join(" ");
  }

  function buildPgn(gameLike, metadata = {}) {
    const history = Array.isArray(gameLike?.moveHistory)
      ? gameLike.moveHistory
      : Array.isArray(gameLike?.history)
        ? gameLike.history
        : [];
    const language = gameLike?.language || metadata.language || "en";
    const white = metadata.white || resolvePlayerName(gameLike?.whitePlayerType || gameLike?.setupPlayers?.white, language);
    const black = metadata.black || resolvePlayerName(gameLike?.blackPlayerType || gameLike?.setupPlayers?.black, language);
    const result = metadata.result || getResultString(gameLike);
    const eventName = metadata.event || "Forest Chess Casual";
    const site = metadata.site || "Local";
    const dateTag = formatDateTag(metadata.savedAt || gameLike?.savedAt || new Date().toISOString());
    const moveText = buildMoveText(history);

    const tags = [
      ["Event", eventName],
      ["Site", site],
      ["Date", dateTag],
      ["White", white],
      ["Black", black],
      ["Result", result]
    ];

    const tagText = tags.map(([key, value]) => `[${key} "${String(value)}"]`).join("\n");
    const line = moveText ? `${moveText} ${result}`.trim() : result;
    return `${tagText}\n\n${line}\n`;
  }

  return {
    buildPgn
  };
});
