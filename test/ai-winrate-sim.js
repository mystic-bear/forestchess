"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = {
    levels: [4, 5, 6],
    players: null,
    roundsPerPair: 4,
    maxTurns: 120,
    timeScale: 0.15,
    jokers: true,
    initial30: true,
    featureSet: "combined"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--levels" && next) {
      options.levels = next.split(",").map(Number).filter(Number.isFinite);
      index += 1;
    } else if (arg === "--players" && next) {
      options.players = next.split(",").map(Number).filter(Number.isFinite);
      index += 1;
    } else if (arg === "--rounds" && next) {
      options.roundsPerPair = Math.max(1, Number(next) || options.roundsPerPair);
      index += 1;
    } else if (arg === "--max-turns" && next) {
      options.maxTurns = Math.max(20, Number(next) || options.maxTurns);
      index += 1;
    } else if (arg === "--time-scale" && next) {
      options.timeScale = Math.max(0.02, Number(next) || options.timeScale);
      index += 1;
    } else if (arg === "--rules" && next) {
      const mode = String(next).toLowerCase();
      if (mode === "base") {
        options.jokers = false;
        options.initial30 = false;
      } else if (mode === "hard") {
        options.jokers = true;
        options.initial30 = true;
      }
      index += 1;
    } else if (arg === "--feature-set" && next) {
      const featureSet = String(next).toLowerCase();
      if (["chain", "exact", "combined"].includes(featureSet)) {
        options.featureSet = featureSet;
      }
      index += 1;
    }
  }

  return options;
}

function createContext() {
  const noop = () => {};
  const dummyNode = () => ({
    innerText: "",
    innerHTML: "",
    style: {},
    classList: { add: noop, remove: noop, toggle: noop },
    appendChild: noop,
    querySelectorAll: () => []
  });

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
    parseInt,
    parseFloat,
    isNaN,
    setTimeout,
    clearTimeout,
    window: {},
    document: {
      body: { classList: { add: noop, remove: noop, toggle: noop } },
      getElementById: dummyNode,
      querySelectorAll: () => [],
      createElement: dummyNode
    },
    ui: {
      showScreen: noop,
      hideSetup: noop,
      renderSetup: noop,
      renderRuleOptions: noop,
      renderQuickStartMixedLevel: noop,
      setInfo: noop,
      toast: noop,
      updateAll: noop,
      updateButtons: noop,
      showHint: noop
    }
  });

  context.globalThis = context;
  context.window = context;
  context.self = context;
  return context;
}

function loadEngineContext() {
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

  const gameSource = `${fs.readFileSync(path.join(ROOT, "js/game.js"), "utf8")}
this.Game = Game;
this.deepCopy = deepCopy;
this.normalizeTableGroups = normalizeTableGroups;
this.tileValue = (tile) => tile && tile.joker ? 30 : (tile?.number || 0);
`;
  vm.runInContext(gameSource, context, { filename: "js/game.js" });
  return context;
}

function createGame(context, playerLevels, options) {
  const game = new context.Game();
  game.openTurn = () => {};
  game.scheduleTurnAdvance = () => {};
  game.setInputLock = () => true;
  game.ruleOptions = {
    jokers: !!options.jokers,
    initial30: !!options.initial30,
    hintLimit: null
  };
  const setupLevels = [...playerLevels, "OFF", "OFF", "OFF", "OFF"].slice(0, 4);
  game.setupState = setupLevels.map(level => Number.isFinite(level) ? `AI-${level}` : "OFF");
  game.modeKey = "sim";
  game.startFromSetup();
  return game;
}

function getTimeBudgetMs(context, level, timeScale) {
  const strategy = context.RummyAI.getStrategy(level);
  const base = strategy?.config?.timeLimitMs || 100;
  return Math.max(30, Math.round(base * timeScale));
}

function summarizeRack(rack) {
  return rack.reduce((sum, tile) => sum + (tile.joker ? 30 : tile.number), 0);
}

function createDebugAggregate() {
  return {
    turns: 0,
    generatedExact: 0,
    generatedChain: 0,
    afterQuotaExact: 0,
    afterQuotaChain: 0,
    afterReserveExact: 0,
    afterReserveChain: 0,
    finishableExact: 0,
    finishableChain: 0,
    topSeenExact: 0,
    topSeenChain: 0,
    finalChosenExact: 0,
    finalChosenChain: 0,
    rejectedLegacyFloorExact: 0,
    rejectedLegacyFloorChain: 0,
    rejectedLevel6FloorExact: 0,
    rejectedLevel6FloorChain: 0,
    rejectedStrategicDrawExact: 0,
    rejectedStrategicDrawChain: 0,
    nullNoCandidates: 0,
    nullNoFinishable: 0,
    nullSoftDeadline: 0,
    chainTailMissing: 0,
    chainLeftoverFreeTiles: 0,
    chainInvalidRetained: 0,
    chainInvalidRecipient: 0,
    chainNoRepairFound: 0,
    chainTailClosureLowPotential: 0,
    chainRepairDonorReclosed: 0,
    chainRepairRecipientRollback: 0,
    chainRepairRecipientRollbackTailAware: 0,
    chainRepairMicroTailBuilt: 0,
    chainRepairRepairedFinishable: 0,
    chainRepairRetainedAssistTail: 0,
    chainRepairFreeOnlyTail: 0,
    chainRepairFreePlusRackTail: 0,
    exactLostToAppend: 0,
    exactLostToSingle: 0,
    exactLostToBridge: 0,
    exactLostToChain: 0,
    exactLostToJoker: 0,
    exactLostToNonExactSameScoreBand: 0,
    exactLastLossSeen: 0,
    exactLastLossPhaseBeamBestReplace: 0,
    exactLastLossPhaseFinalPassBest: 0,
    exactLastLossPhasePostPassChoice: 0,
    exactLastLossWinnerAppend: 0,
    exactLastLossWinnerSingle: 0,
    exactLastLossWinnerBridge: 0,
    exactLastLossWinnerChain: 0,
    exactLastLossWinnerJoker: 0,
    exactLastLossWinnerOther: 0,
    exactLastLossScoreGapSum: 0,
    exactLastLossExactRackReductionSum: 0,
    exactLastLossWinnerRackReductionSum: 0,
    exactLastLossExactFutureMobilitySum: 0,
    exactLastLossWinnerFutureMobilitySum: 0,
    exactLastLossExactClosurePressureSum: 0,
    exactLastLossWinnerClosurePressureSum: 0,
    exactLastLossExactStructureBonusSum: 0,
    exactLastLossWinnerStructureBonusSum: 0,
    chainLastLossSeen: 0,
    chainLastLossPhaseBeamBestReplace: 0,
    chainLastLossPhaseFinalPassBest: 0,
    chainLastLossWinnerAppend: 0,
    chainLastLossWinnerSingle: 0,
    chainLastLossWinnerBridge: 0,
    chainLastLossWinnerExact: 0,
    chainLastLossWinnerJoker: 0,
    chainLastLossWinnerOther: 0,
    chainLastLossClosureFreeOnly: 0,
    chainLastLossClosureFreePlusRack: 0,
    chainLastLossClosureRetainedAssist: 0,
    chainLastLossClosureRollback: 0,
    chainLastLossClosureOther: 0,
    chainLastLossScoreGapSum: 0,
    nullDetailNoGeneratedCandidates: 0,
    nullDetailNoRearrangementCandidates: 0,
    nullDetailBeamNoFinishable: 0,
    nullDetailTimeoutNoFinishableEver: 0,
    nullDetailTimeoutAfterSomeFinishable: 0,
    nullDetailOpeningConstraint: 0,
    nullDetailFinishabilityRescueTriggered: 0,
    nullDetailFinishabilityRescueSucceeded: 0,
    nullDetailFinishabilityRescueModeAppend: 0,
    nullDetailFinishabilityRescueModeSingle: 0,
    nullDetailFinishabilityRescueModeBridge: 0,
    nullDetailFinishabilityRescueModeChain: 0,
    nullDetailFinishabilityRescueModeExact: 0,
    nullDetailFinishabilityRescueModeOther: 0,
    finalSelectionExactReachedDispatcher: 0,
    finalSelectionExactChosenAtDispatcher: 0,
    finalSelectionExactLostAtDispatcher: 0
  };
}

function createLevelMetrics() {
  return {
    partialTurns: 0,
    totalTurns: 0,
    totalLatencyMs: 0,
    strategicDraws: 0,
    nullFallbacks: 0,
    exactMoves: 0,
    chainAppendMoves: 0,
    crowdedTurns: 0,
    crowdedExactMoves: 0,
    crowdedChainMoves: 0,
    debugOverall: createDebugAggregate(),
    debugCrowded: createDebugAggregate(),
    debugNonCrowded: createDebugAggregate()
  };
}

function mergeLevelMetrics(target, source) {
  if (!target || !source) return;
  target.partialTurns += source.partialTurns || 0;
  target.totalTurns += source.totalTurns || 0;
  target.totalLatencyMs += source.totalLatencyMs || 0;
  target.strategicDraws += source.strategicDraws || 0;
  target.nullFallbacks += source.nullFallbacks || 0;
  target.exactMoves += source.exactMoves || 0;
  target.chainAppendMoves += source.chainAppendMoves || 0;
  target.crowdedTurns += source.crowdedTurns || 0;
  target.crowdedExactMoves += source.crowdedExactMoves || 0;
  target.crowdedChainMoves += source.crowdedChainMoves || 0;
  mergeDebugAggregate(target.debugOverall, source.debugOverall);
  mergeDebugAggregate(target.debugCrowded, source.debugCrowded);
  mergeDebugAggregate(target.debugNonCrowded, source.debugNonCrowded);
}

function mergeDebugStats(target, stats) {
  if (!target || !stats) return;
  target.turns += 1;
  target.generatedExact += stats.generated?.exact || 0;
  target.generatedChain += stats.generated?.chain || 0;
  target.afterQuotaExact += stats.afterQuota?.exact || 0;
  target.afterQuotaChain += stats.afterQuota?.chain || 0;
  target.afterReserveExact += stats.afterReserve?.exact || 0;
  target.afterReserveChain += stats.afterReserve?.chain || 0;
  target.finishableExact += stats.finishableSeen?.exact || 0;
  target.finishableChain += stats.finishableSeen?.chain || 0;
  target.topSeenExact += stats.topCandidateSeen?.exact || 0;
  target.topSeenChain += stats.topCandidateSeen?.chain || 0;
  target.finalChosenExact += stats.finalChosen?.exact || 0;
  target.finalChosenChain += stats.finalChosen?.chain || 0;
  target.rejectedLegacyFloorExact += stats.rejectReason?.legacyFloor_exact || 0;
  target.rejectedLegacyFloorChain += stats.rejectReason?.legacyFloor_chain || 0;
  target.rejectedLevel6FloorExact += stats.rejectReason?.level6Floor_exact || 0;
  target.rejectedLevel6FloorChain += stats.rejectReason?.level6Floor_chain || 0;
  target.rejectedStrategicDrawExact += stats.rejectReason?.strategicDraw_exact || 0;
  target.rejectedStrategicDrawChain += stats.rejectReason?.strategicDraw_chain || 0;
  target.nullNoCandidates += stats.nullReason?.noCandidates || 0;
  target.nullNoFinishable += stats.nullReason?.noFinishable || 0;
  target.nullSoftDeadline += stats.nullReason?.softDeadline || 0;
  target.chainTailMissing += stats.chainFinishReject?.tailMissing || 0;
  target.chainLeftoverFreeTiles += stats.chainFinishReject?.leftoverFreeTiles || 0;
  target.chainInvalidRetained += stats.chainFinishReject?.invalidRetained || 0;
  target.chainInvalidRecipient += stats.chainFinishReject?.invalidRecipient || 0;
  target.chainNoRepairFound += stats.chainFinishReject?.noRepairFound || 0;
  target.chainTailClosureLowPotential += stats.chainFinishReject?.tailClosureLowPotential || 0;
  target.chainRepairDonorReclosed += stats.chainRepair?.donorReclosed || 0;
  target.chainRepairRecipientRollback += stats.chainRepair?.recipientRollback || 0;
  target.chainRepairRecipientRollbackTailAware += stats.chainRepair?.recipientRollbackTailAware || 0;
  target.chainRepairMicroTailBuilt += stats.chainRepair?.microTailBuilt || 0;
  target.chainRepairRepairedFinishable += stats.chainRepair?.repairedFinishable || 0;
  target.chainRepairRetainedAssistTail += stats.chainRepair?.retainedAssistTail || 0;
  target.chainRepairFreeOnlyTail += stats.chainRepair?.freeOnlyTail || 0;
  target.chainRepairFreePlusRackTail += stats.chainRepair?.freePlusRackTail || 0;
  target.exactLostToAppend += stats.exactFinalLoss?.lostToAppend || 0;
  target.exactLostToSingle += stats.exactFinalLoss?.lostToSingle || 0;
  target.exactLostToBridge += stats.exactFinalLoss?.lostToBridge || 0;
  target.exactLostToChain += stats.exactFinalLoss?.lostToChain || 0;
  target.exactLostToJoker += stats.exactFinalLoss?.lostToJoker || 0;
  target.exactLostToNonExactSameScoreBand += stats.exactFinalLoss?.lostToNonExactSameScoreBand || 0;
  if (stats.exactLastLoss?.seen) {
    target.exactLastLossSeen += 1;
    const phase = stats.exactLastLoss.phase || "unknown";
    if (phase === "beam-best-replace") target.exactLastLossPhaseBeamBestReplace += 1;
    else if (phase === "final-pass-best") target.exactLastLossPhaseFinalPassBest += 1;
    else if (phase === "post-pass-choice") target.exactLastLossPhasePostPassChoice += 1;
    const winnerMode = stats.exactLastLoss.winnerMode || "other";
    if (winnerMode === "append") target.exactLastLossWinnerAppend += 1;
    else if (winnerMode === "single") target.exactLastLossWinnerSingle += 1;
    else if (winnerMode === "bridge") target.exactLastLossWinnerBridge += 1;
    else if (winnerMode === "chain") target.exactLastLossWinnerChain += 1;
    else if (winnerMode === "joker") target.exactLastLossWinnerJoker += 1;
    else target.exactLastLossWinnerOther += 1;
    target.exactLastLossScoreGapSum += stats.exactLastLoss.scoreGap || 0;
    target.exactLastLossExactRackReductionSum += stats.exactLastLoss.exactRackReduction || 0;
    target.exactLastLossWinnerRackReductionSum += stats.exactLastLoss.winnerRackReduction || 0;
    target.exactLastLossExactFutureMobilitySum += stats.exactLastLoss.exactFutureMobility || 0;
    target.exactLastLossWinnerFutureMobilitySum += stats.exactLastLoss.winnerFutureMobility || 0;
    target.exactLastLossExactClosurePressureSum += stats.exactLastLoss.exactClosurePressure || 0;
    target.exactLastLossWinnerClosurePressureSum += stats.exactLastLoss.winnerClosurePressure || 0;
    target.exactLastLossExactStructureBonusSum += stats.exactLastLoss.exactStructureBonus || 0;
    target.exactLastLossWinnerStructureBonusSum += stats.exactLastLoss.winnerStructureBonus || 0;
  }
  if (stats.chainLastLoss?.seen) {
    target.chainLastLossSeen += 1;
    const phase = stats.chainLastLoss.phase || "unknown";
    if (phase === "beam-best-replace") target.chainLastLossPhaseBeamBestReplace += 1;
    else if (phase === "final-pass-best") target.chainLastLossPhaseFinalPassBest += 1;
    const winnerMode = stats.chainLastLoss.winnerMode || "other";
    if (winnerMode === "append") target.chainLastLossWinnerAppend += 1;
    else if (winnerMode === "single") target.chainLastLossWinnerSingle += 1;
    else if (winnerMode === "bridge") target.chainLastLossWinnerBridge += 1;
    else if (winnerMode === "exact") target.chainLastLossWinnerExact += 1;
    else if (winnerMode === "joker") target.chainLastLossWinnerJoker += 1;
    else target.chainLastLossWinnerOther += 1;
    const closureType = stats.chainLastLoss.chainClosureType || "other";
    if (closureType === "free-only") target.chainLastLossClosureFreeOnly += 1;
    else if (closureType === "free+rack") target.chainLastLossClosureFreePlusRack += 1;
    else if (closureType === "retained-assist") target.chainLastLossClosureRetainedAssist += 1;
    else if (closureType === "rollback") target.chainLastLossClosureRollback += 1;
    else target.chainLastLossClosureOther += 1;
    target.chainLastLossScoreGapSum += stats.chainLastLoss.scoreGap || 0;
  }
  target.nullDetailNoGeneratedCandidates += stats.nullDetail?.noGeneratedCandidates || 0;
  target.nullDetailNoRearrangementCandidates += stats.nullDetail?.noRearrangementCandidates || 0;
  target.nullDetailBeamNoFinishable += stats.nullDetail?.beamNoFinishable || 0;
  target.nullDetailTimeoutNoFinishableEver += stats.nullDetail?.timeoutNoFinishableEver || 0;
  target.nullDetailTimeoutAfterSomeFinishable += stats.nullDetail?.timeoutAfterSomeFinishable || 0;
  target.nullDetailOpeningConstraint += stats.nullDetail?.openingConstraint || 0;
  target.nullDetailFinishabilityRescueTriggered += stats.nullDetail?.finishabilityRescueTriggered || 0;
  target.nullDetailFinishabilityRescueSucceeded += stats.nullDetail?.finishabilityRescueSucceeded || 0;
  const rescueMode = stats.nullDetail?.finishabilityRescueMode || null;
  if (rescueMode === "append") target.nullDetailFinishabilityRescueModeAppend += 1;
  else if (rescueMode === "single") target.nullDetailFinishabilityRescueModeSingle += 1;
  else if (rescueMode === "bridge") target.nullDetailFinishabilityRescueModeBridge += 1;
  else if (rescueMode === "chain") target.nullDetailFinishabilityRescueModeChain += 1;
  else if (rescueMode === "exact") target.nullDetailFinishabilityRescueModeExact += 1;
  else if (rescueMode) target.nullDetailFinishabilityRescueModeOther += 1;
  target.finalSelectionExactReachedDispatcher += stats.finalSelectionReason?.exactReachedDispatcher || 0;
  target.finalSelectionExactChosenAtDispatcher += stats.finalSelectionReason?.exactChosenAtDispatcher || 0;
  target.finalSelectionExactLostAtDispatcher += stats.finalSelectionReason?.exactLostAtDispatcher || 0;
}

function mergeDebugAggregate(target, aggregate) {
  if (!target || !aggregate) return;
  target.turns += aggregate.turns || 0;
  target.generatedExact += aggregate.generatedExact || 0;
  target.generatedChain += aggregate.generatedChain || 0;
  target.afterQuotaExact += aggregate.afterQuotaExact || 0;
  target.afterQuotaChain += aggregate.afterQuotaChain || 0;
  target.afterReserveExact += aggregate.afterReserveExact || 0;
  target.afterReserveChain += aggregate.afterReserveChain || 0;
  target.finishableExact += aggregate.finishableExact || 0;
  target.finishableChain += aggregate.finishableChain || 0;
  target.topSeenExact += aggregate.topSeenExact || 0;
  target.topSeenChain += aggregate.topSeenChain || 0;
  target.finalChosenExact += aggregate.finalChosenExact || 0;
  target.finalChosenChain += aggregate.finalChosenChain || 0;
  target.rejectedLegacyFloorExact += aggregate.rejectedLegacyFloorExact || 0;
  target.rejectedLegacyFloorChain += aggregate.rejectedLegacyFloorChain || 0;
  target.rejectedLevel6FloorExact += aggregate.rejectedLevel6FloorExact || 0;
  target.rejectedLevel6FloorChain += aggregate.rejectedLevel6FloorChain || 0;
  target.rejectedStrategicDrawExact += aggregate.rejectedStrategicDrawExact || 0;
  target.rejectedStrategicDrawChain += aggregate.rejectedStrategicDrawChain || 0;
  target.nullNoCandidates += aggregate.nullNoCandidates || 0;
  target.nullNoFinishable += aggregate.nullNoFinishable || 0;
  target.nullSoftDeadline += aggregate.nullSoftDeadline || 0;
  target.chainTailMissing += aggregate.chainTailMissing || 0;
  target.chainLeftoverFreeTiles += aggregate.chainLeftoverFreeTiles || 0;
  target.chainInvalidRetained += aggregate.chainInvalidRetained || 0;
  target.chainInvalidRecipient += aggregate.chainInvalidRecipient || 0;
  target.chainNoRepairFound += aggregate.chainNoRepairFound || 0;
  target.chainTailClosureLowPotential += aggregate.chainTailClosureLowPotential || 0;
  target.chainRepairDonorReclosed += aggregate.chainRepairDonorReclosed || 0;
  target.chainRepairRecipientRollback += aggregate.chainRepairRecipientRollback || 0;
  target.chainRepairRecipientRollbackTailAware += aggregate.chainRepairRecipientRollbackTailAware || 0;
  target.chainRepairMicroTailBuilt += aggregate.chainRepairMicroTailBuilt || 0;
  target.chainRepairRepairedFinishable += aggregate.chainRepairRepairedFinishable || 0;
  target.chainRepairRetainedAssistTail += aggregate.chainRepairRetainedAssistTail || 0;
  target.chainRepairFreeOnlyTail += aggregate.chainRepairFreeOnlyTail || 0;
  target.chainRepairFreePlusRackTail += aggregate.chainRepairFreePlusRackTail || 0;
  target.exactLostToAppend += aggregate.exactLostToAppend || 0;
  target.exactLostToSingle += aggregate.exactLostToSingle || 0;
  target.exactLostToBridge += aggregate.exactLostToBridge || 0;
  target.exactLostToChain += aggregate.exactLostToChain || 0;
  target.exactLostToJoker += aggregate.exactLostToJoker || 0;
  target.exactLostToNonExactSameScoreBand += aggregate.exactLostToNonExactSameScoreBand || 0;
  target.exactLastLossSeen += aggregate.exactLastLossSeen || 0;
  target.exactLastLossPhaseBeamBestReplace += aggregate.exactLastLossPhaseBeamBestReplace || 0;
  target.exactLastLossPhaseFinalPassBest += aggregate.exactLastLossPhaseFinalPassBest || 0;
  target.exactLastLossPhasePostPassChoice += aggregate.exactLastLossPhasePostPassChoice || 0;
  target.exactLastLossWinnerAppend += aggregate.exactLastLossWinnerAppend || 0;
  target.exactLastLossWinnerSingle += aggregate.exactLastLossWinnerSingle || 0;
  target.exactLastLossWinnerBridge += aggregate.exactLastLossWinnerBridge || 0;
  target.exactLastLossWinnerChain += aggregate.exactLastLossWinnerChain || 0;
  target.exactLastLossWinnerJoker += aggregate.exactLastLossWinnerJoker || 0;
  target.exactLastLossWinnerOther += aggregate.exactLastLossWinnerOther || 0;
  target.exactLastLossScoreGapSum += aggregate.exactLastLossScoreGapSum || 0;
  target.exactLastLossExactRackReductionSum += aggregate.exactLastLossExactRackReductionSum || 0;
  target.exactLastLossWinnerRackReductionSum += aggregate.exactLastLossWinnerRackReductionSum || 0;
  target.exactLastLossExactFutureMobilitySum += aggregate.exactLastLossExactFutureMobilitySum || 0;
  target.exactLastLossWinnerFutureMobilitySum += aggregate.exactLastLossWinnerFutureMobilitySum || 0;
  target.exactLastLossExactClosurePressureSum += aggregate.exactLastLossExactClosurePressureSum || 0;
  target.exactLastLossWinnerClosurePressureSum += aggregate.exactLastLossWinnerClosurePressureSum || 0;
  target.exactLastLossExactStructureBonusSum += aggregate.exactLastLossExactStructureBonusSum || 0;
  target.exactLastLossWinnerStructureBonusSum += aggregate.exactLastLossWinnerStructureBonusSum || 0;
  target.chainLastLossSeen += aggregate.chainLastLossSeen || 0;
  target.chainLastLossPhaseBeamBestReplace += aggregate.chainLastLossPhaseBeamBestReplace || 0;
  target.chainLastLossPhaseFinalPassBest += aggregate.chainLastLossPhaseFinalPassBest || 0;
  target.chainLastLossWinnerAppend += aggregate.chainLastLossWinnerAppend || 0;
  target.chainLastLossWinnerSingle += aggregate.chainLastLossWinnerSingle || 0;
  target.chainLastLossWinnerBridge += aggregate.chainLastLossWinnerBridge || 0;
  target.chainLastLossWinnerExact += aggregate.chainLastLossWinnerExact || 0;
  target.chainLastLossWinnerJoker += aggregate.chainLastLossWinnerJoker || 0;
  target.chainLastLossWinnerOther += aggregate.chainLastLossWinnerOther || 0;
  target.chainLastLossClosureFreeOnly += aggregate.chainLastLossClosureFreeOnly || 0;
  target.chainLastLossClosureFreePlusRack += aggregate.chainLastLossClosureFreePlusRack || 0;
  target.chainLastLossClosureRetainedAssist += aggregate.chainLastLossClosureRetainedAssist || 0;
  target.chainLastLossClosureRollback += aggregate.chainLastLossClosureRollback || 0;
  target.chainLastLossClosureOther += aggregate.chainLastLossClosureOther || 0;
  target.chainLastLossScoreGapSum += aggregate.chainLastLossScoreGapSum || 0;
  target.nullDetailNoGeneratedCandidates += aggregate.nullDetailNoGeneratedCandidates || 0;
  target.nullDetailNoRearrangementCandidates += aggregate.nullDetailNoRearrangementCandidates || 0;
  target.nullDetailBeamNoFinishable += aggregate.nullDetailBeamNoFinishable || 0;
  target.nullDetailTimeoutNoFinishableEver += aggregate.nullDetailTimeoutNoFinishableEver || 0;
  target.nullDetailTimeoutAfterSomeFinishable += aggregate.nullDetailTimeoutAfterSomeFinishable || 0;
  target.nullDetailOpeningConstraint += aggregate.nullDetailOpeningConstraint || 0;
  target.nullDetailFinishabilityRescueTriggered += aggregate.nullDetailFinishabilityRescueTriggered || 0;
  target.nullDetailFinishabilityRescueSucceeded += aggregate.nullDetailFinishabilityRescueSucceeded || 0;
  target.nullDetailFinishabilityRescueModeAppend += aggregate.nullDetailFinishabilityRescueModeAppend || 0;
  target.nullDetailFinishabilityRescueModeSingle += aggregate.nullDetailFinishabilityRescueModeSingle || 0;
  target.nullDetailFinishabilityRescueModeBridge += aggregate.nullDetailFinishabilityRescueModeBridge || 0;
  target.nullDetailFinishabilityRescueModeChain += aggregate.nullDetailFinishabilityRescueModeChain || 0;
  target.nullDetailFinishabilityRescueModeExact += aggregate.nullDetailFinishabilityRescueModeExact || 0;
  target.nullDetailFinishabilityRescueModeOther += aggregate.nullDetailFinishabilityRescueModeOther || 0;
  target.finalSelectionExactReachedDispatcher += aggregate.finalSelectionExactReachedDispatcher || 0;
  target.finalSelectionExactChosenAtDispatcher += aggregate.finalSelectionExactChosenAtDispatcher || 0;
  target.finalSelectionExactLostAtDispatcher += aggregate.finalSelectionExactLostAtDispatcher || 0;
}

function getFeatureFlags(featureSet) {
  if (featureSet === "chain") {
    return { chainRepair: true, chainSelectionTuning: true, exactSelectionTuning: false };
  }
  if (featureSet === "exact") {
    return { chainRepair: false, chainSelectionTuning: false, exactSelectionTuning: true };
  }
  return { chainRepair: true, chainSelectionTuning: true, exactSelectionTuning: true };
}

function asMetricTargets(metricsTargets) {
  return Array.isArray(metricsTargets)
    ? metricsTargets.filter(Boolean)
    : [metricsTargets].filter(Boolean);
}

function applyAIMove(context, game, move, playerIndex, metricsTargets) {
  const targets = asMetricTargets(metricsTargets);
  const player = game.players[playerIndex];
  if (!move || move.type === "draw") {
    if (move?.type === "draw") {
      targets.forEach((metrics) => {
        metrics.strategicDraws += 1;
      });
      game.consecutiveStrategicDrawsByPlayer[playerIndex] =
        (game.consecutiveStrategicDrawsByPlayer[playerIndex] || 0) + 1;
      if (!player.opened && move.drawReasonCode === "hold-opening") {
        game.openingHoldDrawUsed[playerIndex] = (game.openingHoldDrawUsed[playerIndex] || 0) + 1;
      }
    } else {
      targets.forEach((metrics) => {
        metrics.nullFallbacks += 1;
      });
      game.consecutiveStrategicDrawsByPlayer[playerIndex] = 0;
    }

    if (game.bag.length > 0) {
      player.rack.push(game.bag.pop());
    }
    return { finished: false, moveType: move?.type || "fallback-draw" };
  }

  game.consecutiveStrategicDrawsByPlayer[playerIndex] = 0;
  player.rack = context.deepCopy(move.rack);
  game.workingTable = context.normalizeTableGroups(context.deepCopy(move.table));
  game.table = context.deepCopy(game.workingTable);
  player.opened = !!move.opened;

  if ((move.actions || []).some(action => action.mode === "exact")) {
    targets.forEach((metrics) => {
      metrics.exactMoves += 1;
    });
  }
  if ((move.stats?.chainAppendCount || 0) > 0) {
    targets.forEach((metrics) => {
      metrics.chainAppendMoves += 1;
    });
  }

  if (player.rack.length === 0) {
    game.gameOver = true;
    return { finished: true, winnerIndex: playerIndex, moveType: move.type || "move" };
  }

  return { finished: false, moveType: move.type || "move" };
}

function scorePosition(game) {
  return game.players.map((player, index) => ({
    index,
    rackCount: player.rack.length,
    rackValue: summarizeRack(player.rack)
  })).sort((a, b) =>
    a.rackCount - b.rackCount
    || a.rackValue - b.rackValue
    || a.index - b.index
  );
}

function simulateMatch(context, playerLevels, options) {
  const game = createGame(context, playerLevels, options);
  const matchMetrics = {
    totalTurns: 0,
    partialTurns: 0,
    strategicDraws: 0,
    nullFallbacks: 0,
    exactMoves: 0,
    chainAppendMoves: 0,
    crowdedTurns: 0,
    crowdedExactMoves: 0,
    crowdedChainMoves: 0,
    totalLatencyMs: 0,
    debugOverall: createDebugAggregate(),
    debugCrowded: createDebugAggregate(),
    debugNonCrowded: createDebugAggregate()
  };
  const perLevelMetrics = new Map();
  const ensureLevelMetrics = (level) => {
    if (!perLevelMetrics.has(level)) {
      perLevelMetrics.set(level, createLevelMetrics());
    }
    return perLevelMetrics.get(level);
  };

  let winnerIndex = null;
  let finishedNaturally = false;

  for (let turnCount = 0; turnCount < options.maxTurns; turnCount += 1) {
    if (game.gameOver) break;
    const playerIndex = game.turn;
    const player = game.currentPlayer;
    if (!player || player.type !== "AI") {
      throw new Error("Simulation expects AI-only players.");
    }

    const levelMetrics = ensureLevelMetrics(player.aiLevel);
    const state = game.buildGameStateForAI();
    state.aiDebug = true;
    const crowded = state.table.length >= 8;
    if (crowded) {
      matchMetrics.crowdedTurns += 1;
      levelMetrics.crowdedTurns += 1;
    }

    const budgetMs = getTimeBudgetMs(context, player.aiLevel, options.timeScale);
    const startedAt = Date.now();
    const result = context.RummyAI.chooseMove(state, player.aiLevel, {
      budgetMs,
      softDeadlineAt: Date.now() + budgetMs,
      allowPartial: true,
      includeDebug: true,
      featureFlags: getFeatureFlags(options.featureSet)
    });
    const move = result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "move")
      ? result.move
      : result;
    const debugStats = result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "debugStats")
      ? result.debugStats
      : null;
    const latencyMs = Date.now() - startedAt;
    matchMetrics.totalLatencyMs += latencyMs;
    levelMetrics.totalLatencyMs += latencyMs;
    matchMetrics.totalTurns += 1;
    levelMetrics.totalTurns += 1;

    if (move?.searchTruncated) {
      matchMetrics.partialTurns += 1;
      levelMetrics.partialTurns += 1;
    }
    if (crowded && (move?.actions || []).some(action => action.mode === "exact")) {
      matchMetrics.crowdedExactMoves += 1;
      levelMetrics.crowdedExactMoves += 1;
    }
    if (crowded && (move?.stats?.chainAppendCount || 0) > 0) {
      matchMetrics.crowdedChainMoves += 1;
      levelMetrics.crowdedChainMoves += 1;
    }
    if (debugStats) {
      mergeDebugStats(matchMetrics.debugOverall, debugStats);
      mergeDebugStats(levelMetrics.debugOverall, debugStats);
      if (debugStats.crowded) {
        mergeDebugStats(matchMetrics.debugCrowded, debugStats);
        mergeDebugStats(levelMetrics.debugCrowded, debugStats);
      } else {
        mergeDebugStats(matchMetrics.debugNonCrowded, debugStats);
        mergeDebugStats(levelMetrics.debugNonCrowded, debugStats);
      }
    }

    const applied = applyAIMove(context, game, move, playerIndex, [matchMetrics, levelMetrics]);
    if (applied.finished) {
      winnerIndex = applied.winnerIndex;
      finishedNaturally = true;
      break;
    }

    game.turn = (game.turn + 1) % game.players.length;
    game.beginTurn();
  }

  if (winnerIndex === null) {
    winnerIndex = scorePosition(game)[0].index;
  }

  return {
    players: [...playerLevels],
    winnerIndex,
    finishedNaturally,
    rackSnapshot: game.players.map(player => ({
      rackCount: player.rack.length,
      rackValue: summarizeRack(player.rack),
      opened: player.opened
    })),
    metrics: matchMetrics,
    perLevelMetrics: Object.fromEntries([...perLevelMetrics.entries()].map(([level, metrics]) => [String(level), metrics]))
  };
}

function runTournament(options) {
  const context = loadEngineContext();
  const summary = new Map();
  const pairwise = [];

  const ensureSummary = (level) => {
    if (!summary.has(level)) {
        summary.set(level, {
          level,
          wins: 0,
        losses: 0,
        draws: 0,
        games: 0,
        naturalFinishes: 0,
        partialTurns: 0,
        totalTurns: 0,
        totalLatencyMs: 0,
        strategicDraws: 0,
        nullFallbacks: 0,
          exactMoves: 0,
          chainAppendMoves: 0,
          crowdedTurns: 0,
          crowdedExactMoves: 0,
          crowdedChainMoves: 0,
          debugOverall: createDebugAggregate(),
          debugCrowded: createDebugAggregate(),
          debugNonCrowded: createDebugAggregate()
        });
      }
      return summary.get(level);
  };

  if (Array.isArray(options.players) && options.players.length >= 2) {
    for (let round = 0; round < options.roundsPerPair; round += 1) {
      const result = simulateMatch(context, options.players, options);
      const winnerLevel = result.players[result.winnerIndex];
      const metrics = result.metrics;
      const uniqueLevels = [...new Set(result.players)];

      result.players.forEach((level, index) => {
        const entry = ensureSummary(level);
        entry.games += 1;
        if (index === result.winnerIndex) {
          entry.wins += 1;
          if (result.finishedNaturally) entry.naturalFinishes += 1;
        } else {
          entry.losses += 1;
        }
      });
      uniqueLevels.forEach((level) => {
        const entry = ensureSummary(level);
        mergeLevelMetrics(entry, result.perLevelMetrics[String(level)]);
      });

      pairwise.push({
        pair: `ffa-${options.players.join("-")}`,
        games: round + 1,
        winnerLevel,
        naturalFinishes: result.finishedNaturally ? 1 : 0,
        partialTurns: metrics.partialTurns,
        totalTurns: metrics.totalTurns,
        totalLatencyMs: metrics.totalLatencyMs,
        crowdedTurns: metrics.crowdedTurns,
        crowdedExactMoves: metrics.crowdedExactMoves,
        crowdedChainMoves: metrics.crowdedChainMoves
      });
    }
  } else {
    const levels = options.levels;
    for (let i = 0; i < levels.length; i += 1) {
      for (let j = i + 1; j < levels.length; j += 1) {
        const levelA = levels[i];
        const levelB = levels[j];
        const pairRecord = {
          pair: `${levelA}-${levelB}`,
          games: 0,
          levelA,
          levelB,
          winsA: 0,
          winsB: 0,
          naturalFinishes: 0,
          partialTurns: 0,
          totalTurns: 0,
          totalLatencyMs: 0,
          crowdedTurns: 0,
          crowdedExactMoves: 0,
          crowdedChainMoves: 0
        };

        for (let round = 0; round < options.roundsPerPair; round += 1) {
          const players = round % 2 === 0 ? [levelA, levelB] : [levelB, levelA];
          const result = simulateMatch(context, players, options);
          const winnerLevel = result.players[result.winnerIndex];
          const loserLevel = result.players[(result.winnerIndex + 1) % 2];

          const winnerSummary = ensureSummary(winnerLevel);
          const loserSummary = ensureSummary(loserLevel);
          winnerSummary.wins += 1;
          loserSummary.losses += 1;
          winnerSummary.games += 1;
          loserSummary.games += 1;

          if (result.finishedNaturally) {
            winnerSummary.naturalFinishes += 1;
            pairRecord.naturalFinishes += 1;
          }

          mergeLevelMetrics(winnerSummary, result.perLevelMetrics[String(winnerLevel)]);
          mergeLevelMetrics(loserSummary, result.perLevelMetrics[String(loserLevel)]);

          pairRecord.games += 1;
          pairRecord.partialTurns += result.metrics.partialTurns;
          pairRecord.totalTurns += result.metrics.totalTurns;
          pairRecord.totalLatencyMs += result.metrics.totalLatencyMs;
          pairRecord.crowdedTurns += result.metrics.crowdedTurns;
          pairRecord.crowdedExactMoves += result.metrics.crowdedExactMoves;
          pairRecord.crowdedChainMoves += result.metrics.crowdedChainMoves;

          if (winnerLevel === levelA) pairRecord.winsA += 1;
          if (winnerLevel === levelB) pairRecord.winsB += 1;
        }

        pairwise.push(pairRecord);
      }
    }
  }

  return {
    settings: options,
    byLevel: [...summary.values()].sort((a, b) => a.level - b.level),
    pairwise
  };
}

function formatPct(numerator, denominator) {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function printSummary(result) {
  console.log("=== Tournament Settings ===");
  console.log(JSON.stringify(result.settings));
  console.log();
  console.log("=== By Level ===");
  result.byLevel.forEach((entry) => {
    const avgLatency = entry.totalTurns > 0 ? entry.totalLatencyMs / entry.totalTurns : 0;
    console.log(
      [
        `AI-${entry.level}`,
        `W-L=${entry.wins}-${entry.losses}`,
        `games=${entry.games}`,
        `natural=${entry.naturalFinishes}`,
        `partialRate=${formatPct(entry.partialTurns, entry.totalTurns)}`,
        `avgLatencyMs=${avgLatency.toFixed(1)}`,
        `strategicDraws=${entry.strategicDraws.toFixed(1)}`,
        `nullFallbacks=${entry.nullFallbacks.toFixed(1)}`,
        `exactMoves=${entry.exactMoves.toFixed(1)}`,
        `chainMoves=${entry.chainAppendMoves.toFixed(1)}`,
        `crowdedTurns=${entry.crowdedTurns.toFixed(1)}`,
        `crowdedExactRate=${formatPct(entry.crowdedExactMoves, entry.crowdedTurns)}`,
        `crowdedChainRate=${formatPct(entry.crowdedChainMoves, entry.crowdedTurns)}`
      ].join(" | ")
    );
  });
  console.log();
  console.log("=== Pairwise ===");
  result.pairwise.forEach((entry) => {
    const avgLatency = entry.totalTurns > 0 ? entry.totalLatencyMs / entry.totalTurns : 0;
    if (entry.levelA !== undefined && entry.levelB !== undefined) {
      console.log(
        [
          `AI-${entry.levelA} vs AI-${entry.levelB}`,
          `${entry.winsA}-${entry.winsB}`,
          `games=${entry.games}`,
          `natural=${entry.naturalFinishes}`,
          `partialRate=${formatPct(entry.partialTurns, entry.totalTurns)}`,
          `avgLatencyMs=${avgLatency.toFixed(1)}`,
          `crowdedTurns=${entry.crowdedTurns}`,
          `crowdedExactRate=${formatPct(entry.crowdedExactMoves, entry.crowdedTurns)}`,
          `crowdedChainRate=${formatPct(entry.crowdedChainMoves, entry.crowdedTurns)}`
        ].join(" | ")
      );
      return;
    }

    console.log(
      [
        entry.pair,
        `winner=AI-${entry.winnerLevel}`,
        `natural=${entry.naturalFinishes}`,
        `partialRate=${formatPct(entry.partialTurns, entry.totalTurns)}`,
        `avgLatencyMs=${avgLatency.toFixed(1)}`,
        `crowdedTurns=${entry.crowdedTurns}`,
        `crowdedExactRate=${formatPct(entry.crowdedExactMoves, entry.crowdedTurns)}`,
        `crowdedChainRate=${formatPct(entry.crowdedChainMoves, entry.crowdedTurns)}`
      ].join(" | ")
    );
  });
  console.log();
  console.log("=== Debug By Level (Crowded Only) ===");
  result.byLevel.forEach((entry) => {
    console.log(formatDebugSummary(`AI-${entry.level}`, entry.debugCrowded));
  });
  console.log();
  console.log("=== Debug By Level (Non-Crowded Only) ===");
  result.byLevel.forEach((entry) => {
    console.log(formatDebugSummary(`AI-${entry.level}`, entry.debugNonCrowded));
  });
}

function dominantLabel(entries) {
  const sorted = entries
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  return sorted.length > 0 ? `${sorted[0].label}:${sorted[0].value}` : "none";
}

function formatAverage(sum, count) {
  if (!count) return "n/a";
  return (sum / count).toFixed(1);
}

function formatDebugSummary(label, aggregate) {
  const exactLossCount = aggregate.exactLastLossSeen || 0;
  const chainLossCount = aggregate.chainLastLossSeen || 0;
  const exactLossPhase = dominantLabel([
    { label: "beam-best-replace", value: aggregate.exactLastLossPhaseBeamBestReplace || 0 },
    { label: "final-pass-best", value: aggregate.exactLastLossPhaseFinalPassBest || 0 },
    { label: "post-pass-choice", value: aggregate.exactLastLossPhasePostPassChoice || 0 }
  ]);
  const exactLossWinner = dominantLabel([
    { label: "append", value: aggregate.exactLastLossWinnerAppend || 0 },
    { label: "single", value: aggregate.exactLastLossWinnerSingle || 0 },
    { label: "bridge", value: aggregate.exactLastLossWinnerBridge || 0 },
    { label: "chain", value: aggregate.exactLastLossWinnerChain || 0 },
    { label: "joker", value: aggregate.exactLastLossWinnerJoker || 0 },
    { label: "other", value: aggregate.exactLastLossWinnerOther || 0 }
  ]);
  const chainLossPhase = dominantLabel([
    { label: "beam-best-replace", value: aggregate.chainLastLossPhaseBeamBestReplace || 0 },
    { label: "final-pass-best", value: aggregate.chainLastLossPhaseFinalPassBest || 0 }
  ]);
  const chainLossWinner = dominantLabel([
    { label: "append", value: aggregate.chainLastLossWinnerAppend || 0 },
    { label: "single", value: aggregate.chainLastLossWinnerSingle || 0 },
    { label: "bridge", value: aggregate.chainLastLossWinnerBridge || 0 },
    { label: "exact", value: aggregate.chainLastLossWinnerExact || 0 },
    { label: "joker", value: aggregate.chainLastLossWinnerJoker || 0 },
    { label: "other", value: aggregate.chainLastLossWinnerOther || 0 }
  ]);
  const chainLossClosure = dominantLabel([
    { label: "free-only", value: aggregate.chainLastLossClosureFreeOnly || 0 },
    { label: "free+rack", value: aggregate.chainLastLossClosureFreePlusRack || 0 },
    { label: "retained-assist", value: aggregate.chainLastLossClosureRetainedAssist || 0 },
    { label: "rollback", value: aggregate.chainLastLossClosureRollback || 0 },
    { label: "other", value: aggregate.chainLastLossClosureOther || 0 }
  ]);
  const rescueMode = dominantLabel([
    { label: "append", value: aggregate.nullDetailFinishabilityRescueModeAppend || 0 },
    { label: "single", value: aggregate.nullDetailFinishabilityRescueModeSingle || 0 },
    { label: "bridge", value: aggregate.nullDetailFinishabilityRescueModeBridge || 0 },
    { label: "chain", value: aggregate.nullDetailFinishabilityRescueModeChain || 0 },
    { label: "exact", value: aggregate.nullDetailFinishabilityRescueModeExact || 0 },
    { label: "other", value: aggregate.nullDetailFinishabilityRescueModeOther || 0 }
  ]);
  return [
    label,
    `turns=${aggregate.turns}`,
    `generated=${aggregate.generatedExact}/${aggregate.generatedChain}`,
    `afterQuota=${aggregate.afterQuotaExact}/${aggregate.afterQuotaChain}`,
    `afterReserve=${aggregate.afterReserveExact}/${aggregate.afterReserveChain}`,
    `finishable=${aggregate.finishableExact}/${aggregate.finishableChain}`,
    `topSeen=${aggregate.topSeenExact}/${aggregate.topSeenChain}`,
    `finalChosen=${aggregate.finalChosenExact}/${aggregate.finalChosenChain}`,
    `chainReject=${aggregate.chainTailMissing}/${aggregate.chainLeftoverFreeTiles}/${aggregate.chainInvalidRetained}/${aggregate.chainInvalidRecipient}/${aggregate.chainNoRepairFound}/${aggregate.chainTailClosureLowPotential}`,
    `chainRepair=${aggregate.chainRepairRecipientRollback}/${aggregate.chainRepairRecipientRollbackTailAware}/${aggregate.chainRepairFreeOnlyTail}/${aggregate.chainRepairFreePlusRackTail}/${aggregate.chainRepairRetainedAssistTail}/${aggregate.chainRepairRepairedFinishable}`,
    `chainLastLoss=${chainLossCount}|${chainLossPhase}|${chainLossWinner}|closure=${chainLossClosure}|gap=${formatAverage(aggregate.chainLastLossScoreGapSum, chainLossCount)}`,
    `exactLoss=${aggregate.exactLostToAppend}/${aggregate.exactLostToSingle}/${aggregate.exactLostToBridge}/${aggregate.exactLostToChain}/${aggregate.exactLostToJoker}/${aggregate.exactLostToNonExactSameScoreBand}`,
    `exactLastLoss=${exactLossCount}|${exactLossPhase}|${exactLossWinner}|gap=${formatAverage(aggregate.exactLastLossScoreGapSum, exactLossCount)}|rack=${formatAverage(aggregate.exactLastLossExactRackReductionSum, exactLossCount)}/${formatAverage(aggregate.exactLastLossWinnerRackReductionSum, exactLossCount)}|mob=${formatAverage(aggregate.exactLastLossExactFutureMobilitySum, exactLossCount)}/${formatAverage(aggregate.exactLastLossWinnerFutureMobilitySum, exactLossCount)}`,
    `legacyReject=${aggregate.rejectedLegacyFloorExact}/${aggregate.rejectedLegacyFloorChain}`,
    `level6Reject=${aggregate.rejectedLevel6FloorExact}/${aggregate.rejectedLevel6FloorChain}`,
    `drawReject=${aggregate.rejectedStrategicDrawExact}/${aggregate.rejectedStrategicDrawChain}`,
    `dispatcher=${aggregate.finalSelectionExactReachedDispatcher}/${aggregate.finalSelectionExactChosenAtDispatcher}/${aggregate.finalSelectionExactLostAtDispatcher}`,
    `null=${aggregate.nullNoCandidates}/${aggregate.nullNoFinishable}/${aggregate.nullSoftDeadline}`,
    `nullDetail=${aggregate.nullDetailNoGeneratedCandidates}/${aggregate.nullDetailNoRearrangementCandidates}/${aggregate.nullDetailBeamNoFinishable}/${aggregate.nullDetailTimeoutNoFinishableEver}/${aggregate.nullDetailTimeoutAfterSomeFinishable}/${aggregate.nullDetailOpeningConstraint}`,
    `rescue=${aggregate.nullDetailFinishabilityRescueTriggered}/${aggregate.nullDetailFinishabilityRescueSucceeded}|${rescueMode}`
  ].join(" | ");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = runTournament(options);
  printSummary(result);
}

main();
