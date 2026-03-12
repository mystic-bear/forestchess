const assert = require("node:assert/strict");

const { AI_LEVEL_INFO } = require("../shared/constants.js");

const expectedProfiles = {
  1: { mode: "weak_multipv", limitStrength: false, movetime: 35, skillLevel: 0, multipv: 4, choiceWeights: [0.4, 0.3, 0.2, 0.1] },
  2: { mode: "weak_multipv", limitStrength: false, movetime: 55, skillLevel: 1, multipv: 4, choiceWeights: [0.5, 0.25, 0.15, 0.1] },
  3: { mode: "weak_multipv", limitStrength: false, movetime: 80, skillLevel: 2, multipv: 3, choiceWeights: [0.6, 0.25, 0.15] },
  4: { mode: "weak_multipv", limitStrength: false, movetime: 130, skillLevel: 4, multipv: 2, choiceWeights: [0.75, 0.25] },
  5: { mode: "elo_limit", limitStrength: true, movetime: 320, uciElo: 1600, multipv: 2, choiceWeights: [0.8, 0.2], maxCpGapFromBest: 80 },
  6: { mode: "elo_limit", limitStrength: true, movetime: 550, uciElo: 1800, multipv: 2, choiceWeights: [0.9, 0.1], maxCpGapFromBest: 45 },
  7: { mode: "elo_limit", limitStrength: true, movetime: 900, uciElo: 2000, multipv: 1, choiceWeights: [1] }
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
assert.equal(AI_LEVEL_INFO[5].engine.choiceWeights[0], 0.8, "AI-5 should keep 80/20 split");
assert.equal(AI_LEVEL_INFO[6].engine.choiceWeights[0], 0.9, "AI-6 should keep 90/10 split");
assert.equal(AI_LEVEL_INFO[7].engine.multipv, 1, "AI-7 should always use the top line");

console.log("phase5-ai-profile-balance: ok");
