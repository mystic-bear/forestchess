const assert = require("node:assert/strict");

const { AI_LEVEL_INFO } = require("../shared/constants.js");

const expectedProfiles = {
  1: { movetime: 35, skillLevel: 0, multipv: 4, choiceWeights: [0.4, 0.3, 0.2, 0.1] },
  2: { movetime: 60, skillLevel: 1, multipv: 3, choiceWeights: [0.55, 0.3, 0.15] },
  3: { movetime: 100, skillLevel: 3, multipv: 3, choiceWeights: [0.7, 0.2, 0.1] },
  4: { movetime: 180, skillLevel: 5, multipv: 2, choiceWeights: [0.85, 0.15] },
  5: { movetime: 320, skillLevel: 8, multipv: 2, choiceWeights: [0.94, 0.06] },
  6: { movetime: 550, skillLevel: 12, multipv: 1, choiceWeights: [1] },
  7: { movetime: 1000, skillLevel: 18, multipv: 1, choiceWeights: [1] }
};

for (const [levelKey, expected] of Object.entries(expectedProfiles)) {
  const level = Number(levelKey);
  const profile = AI_LEVEL_INFO[level]?.engine;
  assert.ok(profile, `AI-${level} profile should exist`);
  assert.equal(profile.movetime, expected.movetime, `AI-${level} movetime mismatch`);
  assert.equal(profile.skillLevel, expected.skillLevel, `AI-${level} skill mismatch`);
  assert.equal(profile.multipv, expected.multipv, `AI-${level} multipv mismatch`);
  assert.deepEqual(profile.choiceWeights, expected.choiceWeights, `AI-${level} choice weights mismatch`);
  assert.equal(profile.choiceWeights.length, profile.multipv, `AI-${level} weights should match multipv`);
  assert.equal(profile.avoidMateInOne, true, `AI-${level} should avoid mate in one`);
}

assert.ok(AI_LEVEL_INFO[1].engine.multipv > AI_LEVEL_INFO[7].engine.multipv, "entry AI should consider more candidates than challenge AI");
assert.ok(AI_LEVEL_INFO[1].engine.movetime < AI_LEVEL_INFO[7].engine.movetime, "entry AI should think for less time than challenge AI");

console.log("phase5-ai-profile-balance: ok");
