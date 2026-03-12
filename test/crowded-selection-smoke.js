"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createContext() {
  const context = vm.createContext({
    console,
    Date,
    Math,
    JSON,
    Error,
    Set,
    Map,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    setTimeout,
    clearTimeout
  });

  context.globalThis = context;
  context.window = context;
  context.self = context;
  return context;
}

function loadSplitContext() {
  const context = createContext();
  const files = [
    "shared/constants.js",
    "shared/rules-core.js",
    "shared/utils.js",
    "worker/ai-utils.js",
    "worker/ai-base.js",
    "worker/ai-levels.js",
    "worker/ai-dispatcher.js",
    "worker/hint-engine.js"
  ];

  files.forEach((relativePath) => {
    let source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    if (relativePath === "worker/ai-dispatcher.js") {
      source += "\nthis.RummyAI = RummyAI;\n";
    }
    vm.runInContext(source, context, { filename: relativePath });
  });

  return context;
}

function tile(id, color, number) {
  return { id, color, number };
}

function fillerGroups(startId) {
  return [
    [tile(startId + 1, "red", 1), tile(startId + 2, "red", 2), tile(startId + 3, "red", 3)],
    [tile(startId + 4, "blue", 1), tile(startId + 5, "blue", 2), tile(startId + 6, "blue", 3)],
    [tile(startId + 7, "black", 4), tile(startId + 8, "black", 5), tile(startId + 9, "black", 6)],
    [tile(startId + 10, "yellow", 7), tile(startId + 11, "yellow", 8), tile(startId + 12, "yellow", 9)],
    [tile(startId + 13, "red", 10), tile(startId + 14, "blue", 10), tile(startId + 15, "black", 10)],
    [tile(startId + 16, "red", 12), tile(startId + 17, "blue", 12), tile(startId + 18, "black", 12)]
  ];
}

function makeGameState(level, rack, table) {
  return {
    aiDebug: true,
    currentPlayer: {
      rack,
      opened: true,
      aiLevel: level
    },
    table,
    baseTableCount: table.length,
    bagCount: 20,
    ruleOptions: {
      jokers: false,
      initial30: false,
      hintLimit: null
    },
    playersMeta: [
      { index: 0, rackCount: rack.length, opened: true, type: "AI", aiLevel: level },
      { index: 1, rackCount: 8, opened: true, type: "AI", aiLevel: 4 }
    ],
    turnIndex: 0,
    consecutiveStrategicDrawsByPlayer: [0, 0],
    openingHoldDrawUsed: [0, 0]
  };
}

function runScenario(context, scenario) {
  const state = clone(scenario.gameState);
  const result = context.RummyAI.chooseMove(state, scenario.level, {
    budgetMs: 1800,
    softDeadlineAt: Date.now() + 1800,
    allowPartial: true,
    includeDebug: true
  });
  const move = result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "move")
    ? result.move
    : result;
  const debugStats = result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "debugStats")
    ? result.debugStats
    : null;
  return { move, debugStats };
}

function moveType(move) {
  if (!move?.actions?.length) return move?.type || "none";
  if (move.actions.some(action => action.mode === "chain-append")) return "chain";
  if (move.actions.some(action => action.mode === "exact")) return "exact";
  return move.type || "other";
}

function formatStats(name, level, move, stats) {
  return [
    `${name} (AI-${level})`,
    `move=${moveType(move)}`,
    `generated=${stats.generated.exact}/${stats.generated.chain}`,
    `afterQuota=${stats.afterQuota.exact}/${stats.afterQuota.chain}`,
    `afterReserve=${stats.afterReserve.exact}/${stats.afterReserve.chain}`,
    `finishable=${stats.finishableSeen.exact}/${stats.finishableSeen.chain}`,
    `topSeen=${stats.topCandidateSeen.exact}/${stats.topCandidateSeen.chain}`,
    `finalChosen=${stats.finalChosen.exact}/${stats.finalChosen.chain}`,
    `rejectLegacy=${stats.rejectReason.legacyFloor_exact}/${stats.rejectReason.legacyFloor_chain}`,
    `rejectL6=${stats.rejectReason.level6Floor_exact}/${stats.rejectReason.level6Floor_chain}`,
    `rejectDraw=${stats.rejectReason.strategicDraw_exact}/${stats.rejectReason.strategicDraw_chain}`,
    `null=${stats.nullReason.noCandidates}/${stats.nullReason.noFinishable}/${stats.nullReason.softDeadline}`
  ].join(" | ");
}

function main() {
  const context = loadSplitContext();
  const scenarios = [
    {
      name: "exact-obvious-1",
      level: 5,
      expected: "exact",
      gameState: makeGameState(
        5,
        [tile(1, "black", 4), tile(2, "black", 5), tile(3, "black", 6)],
        [
          [tile(101, "red", 4), tile(102, "red", 5), tile(103, "red", 6)],
          [tile(104, "blue", 4), tile(105, "blue", 5), tile(106, "blue", 6)],
          ...fillerGroups(200)
        ]
      )
    },
    {
      name: "exact-obvious-2",
      level: 6,
      expected: "exact",
      gameState: makeGameState(
        6,
        [tile(4, "black", 7), tile(5, "black", 8), tile(6, "black", 9)],
        [
          [tile(111, "red", 7), tile(112, "red", 8), tile(113, "red", 9)],
          [tile(114, "blue", 7), tile(115, "blue", 8), tile(116, "blue", 9)],
          ...fillerGroups(300)
        ]
      )
    },
    {
      name: "exact-obvious-3",
      level: 6,
      expected: "exact",
      gameState: makeGameState(
        6,
        [tile(7, "black", 10), tile(8, "black", 11), tile(9, "black", 12)],
        [
          [tile(121, "red", 10), tile(122, "red", 11), tile(123, "red", 12)],
          [tile(124, "blue", 10), tile(125, "blue", 11), tile(126, "blue", 12)],
          ...fillerGroups(400)
        ]
      )
    },
    {
      name: "chain-obvious-1",
      level: 5,
      expected: "chain",
      gameState: makeGameState(
        5,
        [tile(10, "red", 13)],
        [
          [tile(201, "red", 6), tile(202, "red", 7), tile(203, "red", 8)],
          [tile(204, "red", 9), tile(205, "red", 10), tile(206, "red", 11), tile(207, "red", 12)],
          ...fillerGroups(500)
        ]
      )
    },
    {
      name: "chain-obvious-2",
      level: 6,
      expected: "chain",
      gameState: makeGameState(
        6,
        [tile(11, "yellow", 4), tile(12, "black", 4)],
        [
          [tile(211, "red", 7), tile(212, "red", 8), tile(213, "red", 9)],
          [tile(214, "blue", 7), tile(215, "blue", 8), tile(216, "blue", 9)],
          [tile(217, "red", 10), tile(218, "red", 11), tile(219, "red", 12), tile(220, "red", 13)],
          [tile(221, "blue", 10), tile(222, "blue", 11), tile(223, "blue", 12), tile(224, "blue", 13)],
          ...fillerGroups(600)
        ]
      )
    },
    {
      name: "chain-obvious-3",
      level: 6,
      expected: "chain",
      gameState: makeGameState(
        6,
        [tile(13, "yellow", 4), tile(14, "black", 4)],
        [
          [tile(231, "red", 7), tile(232, "red", 8), tile(233, "red", 9)],
          [tile(234, "blue", 7), tile(235, "blue", 8), tile(236, "blue", 9)],
          [tile(237, "red", 10), tile(238, "red", 11), tile(239, "red", 12), tile(240, "red", 13)],
          [tile(241, "blue", 10), tile(242, "blue", 11), tile(243, "blue", 12), tile(244, "blue", 13)],
          ...fillerGroups(700)
        ]
      )
    }
  ];

  scenarios.forEach((scenario) => {
    const { move, debugStats } = runScenario(context, scenario);
    assert.ok(debugStats, `${scenario.name}: debugStats should be present`);
    if (scenario.expected === "exact") {
      assert.ok(debugStats.generated.exact > 0, `${scenario.name}: should generate exact candidates`);
    } else {
      assert.ok(debugStats.generated.chain > 0, `${scenario.name}: should generate chain candidates`);
    }
    console.log(formatStats(scenario.name, scenario.level, move, debugStats));
  });

  console.log("PASS crowded-selection-smoke");
}

main();
