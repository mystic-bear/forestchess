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
      label: { ko: "AI-1 / 800", en: "AI-1 / 800" },
      desc: { ko: "입문", en: "Entry" },
      engine: {
        mode: "weak_multipv",
        movetime: 45,
        limitStrength: false,
        skillLevel: 0,
        multipv: 4,
        choiceWeights: [0.40, 0.30, 0.20, 0.10],
        avoidMateInOne: true,
        maxImmediateNetLoss: 800
      }
    },
    2: {
      short: "AI-2",
      label: { ko: "AI-2 / 1000", en: "AI-2 / 1000" },
      desc: { ko: "쉬움", en: "Easy" },
      engine: {
        mode: "weak_multipv",
        movetime: 65,
        limitStrength: false,
        skillLevel: 1,
        multipv: 4,
        choiceWeights: [0.48, 0.24, 0.18, 0.10],
        avoidMateInOne: true,
        maxImmediateNetLoss: 500
      }
    },
    3: {
      short: "AI-3",
      label: { ko: "AI-3 / 1150", en: "AI-3 / 1150" },
      desc: { ko: "학습", en: "Learning" },
      engine: {
        mode: "weak_multipv",
        movetime: 90,
        limitStrength: false,
        skillLevel: 3,
        multipv: 4,
        choiceWeights: [0.58, 0.24, 0.12, 0.06],
        avoidMateInOne: true,
        maxImmediateNetLoss: 300
      }
    },
    4: {
      short: "AI-4",
      label: { ko: "AI-4 / 1300", en: "AI-4 / 1300" },
      desc: { ko: "초중급", en: "Club" },
      engine: {
        mode: "weak_multipv",
        movetime: 125,
        limitStrength: false,
        skillLevel: 4,
        multipv: 3,
        choiceWeights: [0.68, 0.20, 0.12],
        avoidMateInOne: true,
        maxImmediateNetLoss: 190
      }
    },
    5: {
      short: "AI-5",
      label: { ko: "AI-5 / 1500", en: "AI-5 / 1500" },
      desc: { ko: "중급", en: "Solid" },
      engine: {
        mode: "elo_limit",
        movetime: 280,
        limitStrength: true,
        uciElo: 1550,
        multipv: 3,
        choiceWeights: [0.76, 0.16, 0.08],
        maxCpGapFromBest: 80,
        avoidMateInOne: true,
        maxImmediateNetLoss: 135
      }
    },
    6: {
      short: "AI-6",
      label: { ko: "AI-6 / 1750", en: "AI-6 / 1750" },
      desc: { ko: "상급", en: "Strong" },
      engine: {
        mode: "elo_limit",
        movetime: 520,
        limitStrength: true,
        uciElo: 1750,
        multipv: 3,
        choiceWeights: [0.84, 0.12, 0.04],
        maxCpGapFromBest: 55,
        avoidMateInOne: true,
        maxImmediateNetLoss: 105
      }
    },
    7: {
      short: "AI-7",
      label: { ko: "AI-7 / 2000 챌린지", en: "AI-7 / 2000 Challenge" },
      desc: { ko: "챌린지", en: "Challenge" },
      engine: {
        mode: "elo_limit",
        movetime: 1000,
        limitStrength: true,
        uciElo: 2000,
        multipv: 1,
        choiceWeights: [1],
        maxCpGapFromBest: 0,
        avoidMateInOne: true,
        maxImmediateNetLoss: 80
      }
    }
  };

  const COACH_PROFILE = {
    movetime: 1400,
    limitStrength: false,
    skillLevel: 20,
    multipv: 3
  };

  const REVIEW_PROFILE = {
    movetime: 180,
    limitStrength: false,
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
      emojiRow: ["🐶", "🐱"],
      setup: { white: "HUMAN", black: "HUMAN" },
      enabled: true
    },
    {
      key: "ai-1",
      label: { ko: "사람 vs AI-1", en: "Human vs AI-1" },
      subtitle: { ko: "입문 코치 대국", en: "Entry coach game" },
      detail: {
        ko: "부담 적은 속도로 AI 수를 보며 연습합니다.",
        en: "Low-pressure practice with quick engine replies."
      },
      emojiRow: ["🙂", "🐥"],
      setup: { white: "HUMAN", black: "AI-1" },
      enabled: true
    },
    {
      key: "ai-2",
      label: { ko: "사람 vs AI-2", en: "Human vs AI-2" },
      subtitle: { ko: "가벼운 연습", en: "Gentle practice" },
      detail: {
        ko: "입문 다음 단계로, 쉬운 대응을 익히기 좋은 속도입니다.",
        en: "A light practice step after entry play."
      },
      emojiRow: ["🙂", "🐰"],
      setup: { white: "HUMAN", black: "AI-2" },
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
      emojiRow: ["🙂", "🐶"],
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
      emojiRow: ["🙂", "🦊"],
      setup: { white: "HUMAN", black: "AI-5" },
      enabled: true
    },
    {
      key: "ai-7",
      label: { ko: "사람 vs AI-7", en: "Human vs AI-7" },
      subtitle: { ko: "챌린지 모드", en: "Challenge mode" },
      detail: {
        ko: "현재 기준 최상 난도에 가까운 도전용 프리셋입니다.",
        en: "A challenge preset close to the current top difficulty."
      },
      emojiRow: ["🙂", "🐯"],
      setup: { white: "HUMAN", black: "AI-7" },
      enabled: true
    }
  ];

  const PLAYER_ANIMALS = [
    { key: "bear", emoji: "🐻", label: { ko: "곰", en: "Bear" } },
    { key: "fox", emoji: "🦊", label: { ko: "여우", en: "Fox" } },
    { key: "rabbit", emoji: "🐰", label: { ko: "토끼", en: "Rabbit" } },
    { key: "cat", emoji: "🐱", label: { ko: "고양이", en: "Cat" } },
    { key: "dog", emoji: "🐶", label: { ko: "강아지", en: "Dog" } },
    { key: "tiger", emoji: "🐯", label: { ko: "호랑이", en: "Tiger" } },
    { key: "lion", emoji: "🦁", label: { ko: "사자", en: "Lion" } },
    { key: "panda", emoji: "🐼", label: { ko: "판다", en: "Panda" } },
    { key: "koala", emoji: "🐨", label: { ko: "코알라", en: "Koala" } },
    { key: "monkey", emoji: "🐵", label: { ko: "원숭이", en: "Monkey" } },
    { key: "pig", emoji: "🐷", label: { ko: "돼지", en: "Pig" } },
    { key: "cow", emoji: "🐮", label: { ko: "소", en: "Cow" } },
    { key: "mouse", emoji: "🐭", label: { ko: "쥐", en: "Mouse" } },
    { key: "hamster", emoji: "🐹", label: { ko: "햄스터", en: "Hamster" } },
    { key: "chick", emoji: "🐥", label: { ko: "병아리", en: "Chick" } },
    { key: "owl", emoji: "🦉", label: { ko: "부엉이", en: "Owl" } },
    { key: "penguin", emoji: "🐧", label: { ko: "펭귄", en: "Penguin" } },
    { key: "duck", emoji: "🦆", label: { ko: "오리", en: "Duck" } }
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
    PLAYER_ANIMALS,
    PIECE_THEME,
    PIECE_LABEL_MODES,
    BOARD_ORIENTATION_OPTIONS,
    HINT_LEVELS,
    HINT_STAGE_INFO,
    DEFAULT_SETUP
  };
});
