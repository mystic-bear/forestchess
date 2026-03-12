# Bugfix AI Leveling Final

- Generated: 2026-03-12 23:17:27 KST

## Symptom

The previous draft would have lowered `AI-1` too far below the intended beginner feel, while the public labels no longer matched the target ladder structure.

## Cause

The first rebalance draft pulled the entry tier down too aggressively and still used the older public labels for several levels.

## Fix

- Updated public labels to `800 / 1000 / 1150 / 1300 / 1500 / 1750 / 2000`.
- Kept `AI-1` at `skillLevel: 0` but restored a more stable profile:
  - `movetime: 45`
  - `choiceWeights: [0.40, 0.30, 0.20, 0.10]`
  - `maxImmediateNetLoss: 800`
- Updated `AI-2` to:
  - `movetime: 65`
  - `choiceWeights: [0.48, 0.24, 0.18, 0.10]`
  - `maxImmediateNetLoss: 500`
- Reapplied the previously approved final structure for `AI-3` to `AI-7`.
- Raised `AI-7` movetime from `900` to `1000`.

## Result

The bottom tier stays usable for beginners, the top tier keeps the stronger challenge profile, and the public labels now match the intended final ladder.
