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
      label: { ko: "백", en: "White" },
      accent: "var(--white-accent)",
      icon: "W"
    },
    black: {
      key: "black",
      label: { ko: "흑", en: "Black" },
      accent: "var(--black-accent)",
      icon: "B"
    }
  };

  const SETUP_STATES = ["HUMAN", "AI-1", "AI-2", "AI-3", "AI-4", "AI-5", "AI-6", "AI-7"];

  const AI_LEVEL_INFO = {
    1: {
      short: "AI-1",
      label: { ko: "AI-1 / 600", en: "AI-1 / 600" },
      desc: { ko: "입문", en: "Entry" },
      engine: { movetime: 80, skillLevel: 0, multipv: 1 }
    },
    2: {
      short: "AI-2",
      label: { ko: "AI-2 / 900", en: "AI-2 / 900" },
      desc: { ko: "쉬움", en: "Easy" },
      engine: { movetime: 120, skillLevel: 2, multipv: 1 }
    },
    3: {
      short: "AI-3",
      label: { ko: "AI-3 / 1200", en: "AI-3 / 1200" },
      desc: { ko: "학습", en: "Learning" },
      engine: { movetime: 180, skillLevel: 4, multipv: 1 }
    },
    4: {
      short: "AI-4",
      label: { ko: "AI-4 / 1400", en: "AI-4 / 1400" },
      desc: { ko: "클럽", en: "Club" },
      engine: { movetime: 260, skillLevel: 6, multipv: 1 }
    },
    5: {
      short: "AI-5",
      label: { ko: "AI-5 / 1600", en: "AI-5 / 1600" },
      desc: { ko: "안정", en: "Solid" },
      engine: { movetime: 400, skillLevel: 10, multipv: 1 }
    },
    6: {
      short: "AI-6",
      label: { ko: "AI-6 / 1800", en: "AI-6 / 1800" },
      desc: { ko: "강함", en: "Strong" },
      engine: { movetime: 650, skillLevel: 14, multipv: 1 }
    },
    7: {
      short: "AI-7",
      label: { ko: "AI-7 / 2000 챌린지", en: "AI-7 / 2000 Challenge" },
      desc: { ko: "챌린지", en: "Challenge" },
      engine: { movetime: 1000, skillLevel: 18, multipv: 1 }
    }
  };

  const COACH_PROFILE = {
    movetime: 1400,
    skillLevel: 20,
    multipv: 3
  };

  const REVIEW_PROFILE = {
    movetime: 180,
    skillLevel: 18,
    multipv: 2,
    maxMoments: 5
  };

  const ENGINE_ASSET_CANDIDATES = [
    "../stockfish-18-lite-single.js",
    "../stockfish-18-asm.js",
    "../stockfish-18-lite.js"
  ];

  const QUICK_PRESETS = [
    {
      key: "local-human",
      label: { ko: "사람 vs 사람", en: "Human vs Human" },
      subtitle: { ko: "로컬 대국", en: "Local board" },
      detail: {
        ko: "두 사람이 한 보드를 함께 쓰는 정통 체스입니다.",
        en: "Two people share one board with the full chess rules."
      },
      setup: { white: "HUMAN", black: "HUMAN" },
      enabled: true
    },
    {
      key: "ai-1",
      label: { ko: "사람 vs AI-1", en: "Human vs AI-1" },
      subtitle: { ko: "입문 코치 대국", en: "Entry coach game" },
      detail: {
        ko: "부담 적은 속도로 AI 응수를 보며 연습합니다.",
        en: "Low-pressure practice with quick engine replies."
      },
      setup: { white: "HUMAN", black: "AI-1" },
      enabled: true
    },
    {
      key: "ai-3",
      label: { ko: "사람 vs AI-3", en: "Human vs AI-3" },
      subtitle: { ko: "학습 속도", en: "Learning pace" },
      detail: {
        ko: "가족 대국과 코치 힌트에 균형이 좋은 추천 난도입니다.",
        en: "Balanced pacing for family play and coach hints."
      },
      setup: { white: "HUMAN", black: "AI-3" },
      enabled: true
    },
    {
      key: "ai-5",
      label: { ko: "사람 vs AI-5", en: "Human vs AI-5" },
      subtitle: { ko: "안정적인 스파링", en: "Solid sparring" },
      detail: {
        ko: "전술과 수비가 더 정돈된 중급 이상 난도입니다.",
        en: "Stronger tactics and cleaner defense."
      },
      setup: { white: "HUMAN", black: "AI-5" },
      enabled: true
    },
    {
      key: "ai-7",
      label: { ko: "사람 vs AI-7", en: "Human vs AI-7" },
      subtitle: { ko: "챌린지 모드", en: "Challenge mode" },
      detail: {
        ko: "현재 Phase 3 기준 최상 난도 프로필입니다.",
        en: "Highest Phase 3 challenge profile."
      },
      setup: { white: "HUMAN", black: "AI-7" },
      enabled: true
    }
  ];

  const PIECE_THEME = {
    k: { animal: { ko: "곰", en: "Bear" }, chess: { ko: "킹", en: "King" }, emoji: "🐻" },
    q: { animal: { ko: "토끼", en: "Rabbit" }, chess: { ko: "퀸", en: "Queen" }, emoji: "🐰" },
    r: { animal: { ko: "코끼리", en: "Elephant" }, chess: { ko: "룩", en: "Rook" }, emoji: "🐘" },
    b: { animal: { ko: "여우", en: "Fox" }, chess: { ko: "비숍", en: "Bishop" }, emoji: "🦊" },
    n: { animal: { ko: "강아지", en: "Puppy" }, chess: { ko: "나이트", en: "Knight" }, emoji: "🐶" },
    p: { animal: { ko: "고양이", en: "Cat" }, chess: { ko: "폰", en: "Pawn" }, emoji: "🐱" }
  };

  const PIECE_LABEL_MODES = [
    { key: "both", label: { ko: "동물 + 체스", en: "Animal + Chess" }, short: { ko: "병기", en: "Both" } },
    { key: "animal", label: { ko: "동물만", en: "Animal only" }, short: { ko: "동물", en: "Animal" } },
    { key: "chess", label: { ko: "체스만", en: "Chess only" }, short: { ko: "체스", en: "Chess" } }
  ];

  const BOARD_ORIENTATION_OPTIONS = [
    { key: "white", label: { ko: "백 아래", en: "White bottom" } },
    { key: "black", label: { ko: "흑 아래", en: "Black bottom" } }
  ];

  const HINT_LEVELS = [1, 2, 3];

  const HINT_STAGE_INFO = {
    1: { key: 1, label: { ko: "방향", en: "Direction" } },
    2: { key: 2, label: { ko: "후보 기물", en: "Candidate" } },
    3: { key: 3, label: { ko: "정확한 수", en: "Exact move" } }
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
    REVIEW_PROFILE,
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
