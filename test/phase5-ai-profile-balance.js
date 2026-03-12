const assert = require("node:assert/strict");

const { AI_LEVEL_INFO } = require("../shared/constants.js");

const expectedProfiles = {
  1: { mode: "weak_multipv", limitStrength: false, movetime: 45, skillLevel: 0, multipv: 4, choiceWeights: [0.40, 0.30, 0.20, 0.10] },
  2: { mode: "weak_multipv", limitStrength: false, movetime: 65, skillLevel: 1, multipv: 4, choiceWeights: [0.48, 0.24, 0.18, 0.10] },
  3: { mode: "weak_multipv", limitStrength: false, movetime: 90, skillLevel: 3, multipv: 4, choiceWeights: [0.58, 0.24, 0.12, 0.06] },
  4: { mode: "weak_multipv", limitStrength: false, movetime: 125, skillLevel: 4, multipv: 3, choiceWeights: [0.68, 0.20, 0.12] },
  5: { mode: "elo_limit", limitStrength: true, movetime: 280, uciElo: 1550, multipv: 3, choiceWeights: [0.76, 0.16, 0.08], maxCpGapFromBest: 80 },
  6: { mode: "elo_limit", limitStrength: true, movetime: 520, uciElo: 1750, multipv: 3, choiceWeights: [0.84, 0.12, 0.04], maxCpGapFromBest: 55 },
  7: { mode: "elo_limit", limitStrength: true, movetime: 1000, uciElo: 2000, multipv: 1, choiceWeights: [1], maxCpGapFromBest: 0 }
};

for (const [levelKey, expected] of Object.entries(expectedProfiles)) {
  const level = Number(levelKey);
  const profile = AI_LEVEL_INFO[level]?.engine;
  assert.ok(profile, `AI-${level} profile should exist`);
  assert.equal(profile.mode, expected.mode, `AI-${level} mode mismatch`);
  assert.equal(profile.limitStrength, expected.limitStrength, `AI-${level} limit-strength mismatch`);
  assert.equal(profile.movetime, expected.movetime, `AI-${level} movetime mismatch`);
  if (Object.prototype.hasOwnProperty.call(expected, "skillLevel")) {
    assert.equal(profile.skillLevel, expected.skillLevel, `AI-${level} skill mismatch`);
  }
  if (Object.prototype.hasOwnProperty.call(expected, "uciElo")) {
    assert.equal(profile.uciElo, expected.uciElo, `AI-${level} UCI Elo mismatch`);
  }
  assert.equal(profile.multipv, expected.multipv, `AI-${level} multipv mismatch`);
  assert.deepEqual(profile.choiceWeights, expected.choiceWeights, `AI-${level} choice weights mismatch`);
  if (Object.prototype.hasOwnProperty.call(expected, "maxCpGapFromBest")) {
    assert.equal(profile.maxCpGapFromBest, expected.maxCpGapFromBest, `AI-${level} cp-gap mismatch`);
  }
  assert.equal(profile.choiceWeights.length, profile.multipv, `AI-${level} weights should match multipv`);
  assert.equal(profile.avoidMateInOne, true, `AI-${level} should avoid mate in one`);
}

assert.ok(AI_LEVEL_INFO[1].engine.multipv > AI_LEVEL_INFO[7].engine.multipv, "entry AI should consider more candidates than challenge AI");
assert.ok(AI_LEVEL_INFO[1].engine.movetime < AI_LEVEL_INFO[7].engine.movetime, "entry AI should think for less time than challenge AI");
assert.equal(AI_LEVEL_INFO[5].engine.choiceWeights[0], 0.76, "AI-5 should keep the configured top-choice weight");
assert.equal(AI_LEVEL_INFO[6].engine.choiceWeights[0], 0.84, "AI-6 should keep the configured top-choice weight");
assert.equal(AI_LEVEL_INFO[7].engine.multipv, 1, "AI-7 should always use the top line");

console.log("phase5-ai-profile-balance: ok");
