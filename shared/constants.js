(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PLAYER_ORDER = ["white", "black"];

  const PLAYER_INFO = {
    white: {
      key: "white",
      label: "White",
      accent: "var(--white-accent)",
      icon: "W"
    },
    black: {
      key: "black",
      label: "Black",
      accent: "var(--black-accent)",
      icon: "B"
    }
  };

  const SETUP_STATES = ["HUMAN", "AI-1", "AI-2", "AI-3", "AI-4", "AI-5", "AI-6", "AI-7"];

  const AI_LEVEL_INFO = {
    1: {
      short: "AI-1",
      label: "AI-1 / 600",
      desc: "Entry",
      engine: { movetime: 80, skillLevel: 0, multipv: 1 }
    },
    2: {
      short: "AI-2",
      label: "AI-2 / 900",
      desc: "Easy",
      engine: { movetime: 120, skillLevel: 2, multipv: 1 }
    },
    3: {
      short: "AI-3",
      label: "AI-3 / 1200",
      desc: "Learning",
      engine: { movetime: 180, skillLevel: 4, multipv: 1 }
    },
    4: {
      short: "AI-4",
      label: "AI-4 / 1400",
      desc: "Club",
      engine: { movetime: 260, skillLevel: 6, multipv: 1 }
    },
    5: {
      short: "AI-5",
      label: "AI-5 / 1600",
      desc: "Solid",
      engine: { movetime: 400, skillLevel: 10, multipv: 1 }
    },
    6: {
      short: "AI-6",
      label: "AI-6 / 1800",
      desc: "Strong",
      engine: { movetime: 650, skillLevel: 14, multipv: 1 }
    },
    7: {
      short: "AI-7",
      label: "AI-7 / 2000 Challenge",
      desc: "Challenge",
      engine: { movetime: 1000, skillLevel: 18, multipv: 1 }
    }
  };

  const COACH_PROFILE = {
    movetime: 1400,
    skillLevel: 20,
    multipv: 3
  };

  const ENGINE_ASSET_CANDIDATES = [
    "../stockfish-18-lite-single.js",
    "../stockfish-18-asm.js",
    "../stockfish-18-lite.js"
  ];

  const QUICK_PRESETS = [
    {
      key: "local-human",
      label: "Human vs Human",
      subtitle: "Local board",
      detail: "Two people share one board with the full chess rules.",
      setup: { white: "HUMAN", black: "HUMAN" },
      enabled: true
    },
    {
      key: "ai-1",
      label: "Human vs AI-1",
      subtitle: "Entry coach game",
      detail: "Low-pressure practice with quick engine moves.",
      setup: { white: "HUMAN", black: "AI-1" },
      enabled: true
    },
    {
      key: "ai-3",
      label: "Human vs AI-3",
      subtitle: "Learning pace",
      detail: "Balanced pace for family play and coach hints.",
      setup: { white: "HUMAN", black: "AI-3" },
      enabled: true
    },
    {
      key: "ai-5",
      label: "Human vs AI-5",
      subtitle: "Solid sparring",
      detail: "Stronger tactics and cleaner defense.",
      setup: { white: "HUMAN", black: "AI-5" },
      enabled: true
    },
    {
      key: "ai-7",
      label: "Human vs AI-7",
      subtitle: "Challenge mode",
      detail: "Highest Phase 3 challenge profile.",
      setup: { white: "HUMAN", black: "AI-7" },
      enabled: true
    }
  ];

  const PIECE_THEME = {
    k: { animal: "곰", chess: "킹", emoji: "🐻" },
    q: { animal: "토끼", chess: "퀸", emoji: "🐰" },
    r: { animal: "코끼리", chess: "룩", emoji: "🐘" },
    b: { animal: "여우", chess: "비숍", emoji: "🦊" },
    n: { animal: "강아지", chess: "나이트", emoji: "🐶" },
    p: { animal: "고양이", chess: "폰", emoji: "🐱" }
  };

  const PIECE_LABEL_MODES = [
    { key: "both", label: "Animal + Chess", short: "Both" },
    { key: "animal", label: "Animal only", short: "Animal" },
    { key: "chess", label: "Chess only", short: "Chess" }
  ];

  const BOARD_ORIENTATION_OPTIONS = [
    { key: "white", label: "White bottom" },
    { key: "black", label: "Black bottom" }
  ];

  const HINT_LEVELS = [1, 2, 3];

  const HINT_STAGE_INFO = {
    1: { key: 1, label: "Direction" },
    2: { key: 2, label: "Candidate" },
    3: { key: 3, label: "Exact move" }
  };

  const DEFAULT_SETUP = {
    white: "HUMAN",
    black: "HUMAN"
  };

  return {
    PLAYER_ORDER,
    PLAYER_INFO,
    SETUP_STATES,
    AI_LEVEL_INFO,
    COACH_PROFILE,
    ENGINE_ASSET_CANDIDATES,
    QUICK_PRESETS,
    PIECE_THEME,
    PIECE_LABEL_MODES,
    BOARD_ORIENTATION_OPTIONS,
    HINT_LEVELS,
    HINT_STAGE_INFO,
    DEFAULT_SETUP
  };
});
