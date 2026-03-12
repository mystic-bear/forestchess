const PLAYER_ORDER = ["white", "black"];

const PLAYER_INFO = {
  white: {
    key: "white",
    label: "White",
    korean: "백",
    accent: "var(--white-accent)",
    icon: "⚪"
  },
  black: {
    key: "black",
    label: "Black",
    korean: "흑",
    accent: "var(--black-accent)",
    icon: "⚫"
  }
};

const SETUP_STATES = ["HUMAN", "AI-1", "AI-2", "AI-3", "AI-4", "AI-5", "AI-6", "AI-7"];

const AI_LEVEL_INFO = {
  1: { short: "AI-1", label: "AI-1 · 600", desc: "입문" },
  2: { short: "AI-2", label: "AI-2 · 900", desc: "쉬움" },
  3: { short: "AI-3", label: "AI-3 · 1200", desc: "학습 추천" },
  4: { short: "AI-4", label: "AI-4 · 1400", desc: "기본 중급" },
  5: { short: "AI-5", label: "AI-5 · 1600", desc: "도전" },
  6: { short: "AI-6", label: "AI-6 · 1800", desc: "상급" },
  7: { short: "AI-7", label: "AI-7 · 2000 Challenge", desc: "챌린지" }
};

const QUICK_PRESETS = [
  {
    key: "local-human",
    label: "사람 vs 사람",
    subtitle: "가족 대국",
    detail: "이번 단계에서 바로 플레이 가능",
    setup: { white: "HUMAN", black: "HUMAN" },
    enabled: true
  },
  {
    key: "ai-1",
    label: "사람 vs AI-1",
    subtitle: AI_LEVEL_INFO[1].label,
    detail: "AI 연동은 다음 단계에서 연결",
    setup: { white: "HUMAN", black: "AI-1" },
    enabled: false
  },
  {
    key: "ai-3",
    label: "사람 vs AI-3",
    subtitle: AI_LEVEL_INFO[3].label,
    detail: "AI 연동은 다음 단계에서 연결",
    setup: { white: "HUMAN", black: "AI-3" },
    enabled: false
  },
  {
    key: "ai-5",
    label: "사람 vs AI-5",
    subtitle: AI_LEVEL_INFO[5].label,
    detail: "AI 연동은 다음 단계에서 연결",
    setup: { white: "HUMAN", black: "AI-5" },
    enabled: false
  },
  {
    key: "ai-7",
    label: "사람 vs AI-7",
    subtitle: AI_LEVEL_INFO[7].label,
    detail: "AI 연동은 다음 단계에서 연결",
    setup: { white: "HUMAN", black: "AI-7" },
    enabled: false
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
  { key: "both", label: "동물 + 체스명", short: "곰(킹)" },
  { key: "animal", label: "동물명만", short: "곰" },
  { key: "chess", label: "체스명만", short: "킹" }
];

const BOARD_ORIENTATION_OPTIONS = [
  { key: "white", label: "백 기준" },
  { key: "black", label: "흑 기준" }
];

const DEFAULT_SETUP = {
  white: "HUMAN",
  black: "HUMAN"
};
