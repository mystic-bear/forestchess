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
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
  });

  return context;
}

function tile(id, color, number) {
  return { id, color, number };
}

function makeGameState(currentPlayer, table) {
  return {
    currentPlayer,
    table,
    baseTableCount: table.length,
    bagCount: 18,
    ruleOptions: {
      jokers: false,
      initial30: false,
      hintLimit: null
    },
    playersMeta: [
      { index: 0, rackCount: currentPlayer.rack.length, opened: currentPlayer.opened, type: "AI", aiLevel: currentPlayer.aiLevel },
      { index: 1, rackCount: 8, opened: true, type: "AI", aiLevel: 4 }
    ],
    turnIndex: 0,
    consecutiveStrategicDrawsByPlayer: [0, 0],
    openingHoldDrawUsed: [0, 0]
  };
}

function runChainGenerator(context, className, gameState) {
  context.__chainInput = {
    gameState: clone(gameState)
  };

  const result = vm.runInContext(`
    (() => {
      const strategy = new ${className}();
      const initialState = strategy.createInitialState(__chainInput.gameState);
      const ctx = strategy.createSearchContext(__chainInput.gameState, initialState);
      return strategy.withEffectiveConfig(initialState, ctx, () =>
        strategy.generateChainAppendMoves(initialState, ctx).map(candidate => ({
          stats: candidate.stats,
          rackLength: candidate.rack.length,
          table: candidate.table,
          actionModes: candidate.actions.map(action => action.mode)
        }))
      );
    })()
  `, context);

  delete context.__chainInput;
  return result;
}

function assertAllValid(context, candidates, label) {
  candidates.forEach((candidate, index) => {
    context.__chainValidation = clone(candidate.table);
    const valid = vm.runInContext(
      "__chainValidation.every(group => RummyRules.analyzeGroup(group).valid)",
      context
    );
    delete context.__chainValidation;
    assert.ok(valid, `${label}: candidate ${index} must leave a valid table`);
  });
}

function main() {
  const context = loadSplitContext();

  const level5State = makeGameState(
    {
      rack: [tile(1, "red", 13)],
      opened: true,
      aiLevel: 5
    },
    [
      [tile(101, "red", 6), tile(102, "red", 7), tile(103, "red", 8)],
      [tile(104, "red", 9), tile(105, "red", 10), tile(106, "red", 11), tile(107, "red", 12)]
    ]
  );

  const level6State = makeGameState(
    {
      rack: [tile(2, "yellow", 4), tile(3, "black", 4)],
      opened: true,
      aiLevel: 6
    },
    [
      [tile(201, "red", 7), tile(202, "red", 8), tile(203, "red", 9)],
      [tile(204, "blue", 7), tile(205, "blue", 8), tile(206, "blue", 9)],
      [tile(207, "red", 10), tile(208, "red", 11), tile(209, "red", 12), tile(210, "red", 13)],
      [tile(211, "blue", 10), tile(212, "blue", 11), tile(213, "blue", 12), tile(214, "blue", 13)]
    ]
  );

  const level5Candidates = runChainGenerator(context, "AILevel5Strategy", level5State);
  const level6Candidates = runChainGenerator(context, "AILevel6Strategy", level6State);

  assert.ok(level5Candidates.length > 0, "level5: should generate at least one chain-append candidate");
  assert.ok(level6Candidates.length > 0, "level6: should generate at least one chain-append candidate");
  assertAllValid(context, level5Candidates, "level5");
  assertAllValid(context, level6Candidates, "level6");

  assert.ok(
    level5Candidates.some(candidate =>
      candidate.actionModes.includes("chain-append")
      && candidate.stats.chainAppendCount >= 1
      && candidate.stats.chainAppendSameRecipientDouble >= 1
      && candidate.stats.chainAppendTailBuilt >= 1
    ),
    "level5: should generate a same-recipient double extension with a tail build"
  );

  assert.ok(
    level6Candidates.some(candidate =>
      candidate.actionModes.includes("chain-append")
      && candidate.stats.chainAppendCount >= 2
      && candidate.stats.chainAppendMultiRecipient >= 1
    ),
    "level6: should generate a multi-recipient chain-append candidate"
  );

  console.log("PASS chain-append-smoke");
}

main();
