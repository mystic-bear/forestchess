# Phase 5 AI Leveling Final

- Generated: 2026-03-12 23:17:27 KST
- Scope: public ladder labels and engine profile finalization

## Final Display Ladder

| Level | Public Rating | Position |
| --- | --- | --- |
| AI-1 | 800 | Entry |
| AI-2 | 1000 | Entry+ |
| AI-3 | 1150 | Learning |
| AI-4 | 1300 | Club |
| AI-5 | 1500 | Solid |
| AI-6 | 1750 | Strong |
| AI-7 | 2000 | Challenge |

## Final Engine Profiles

### AI-1

- `mode: weak_multipv`
- `movetime: 45`
- `skillLevel: 0`
- `multipv: 4`
- `choiceWeights: [0.40, 0.30, 0.20, 0.10]`
- `avoidMateInOne: true`
- `maxImmediateNetLoss: 800`

### AI-2

- `mode: weak_multipv`
- `movetime: 65`
- `skillLevel: 1`
- `multipv: 4`
- `choiceWeights: [0.48, 0.24, 0.18, 0.10]`
- `avoidMateInOne: true`
- `maxImmediateNetLoss: 500`

### AI-3

- `mode: weak_multipv`
- `movetime: 90`
- `skillLevel: 3`
- `multipv: 4`
- `choiceWeights: [0.58, 0.24, 0.12, 0.06]`
- `avoidMateInOne: true`
- `maxImmediateNetLoss: 300`

### AI-4

- `mode: weak_multipv`
- `movetime: 125`
- `skillLevel: 4`
- `multipv: 3`
- `choiceWeights: [0.68, 0.20, 0.12]`
- `avoidMateInOne: true`
- `maxImmediateNetLoss: 190`

### AI-5

- `mode: elo_limit`
- `movetime: 280`
- `limitStrength: true`
- `uciElo: 1550`
- `multipv: 3`
- `choiceWeights: [0.76, 0.16, 0.08]`
- `maxCpGapFromBest: 80`
- `avoidMateInOne: true`
- `maxImmediateNetLoss: 135`

### AI-6

- `mode: elo_limit`
- `movetime: 520`
- `limitStrength: true`
- `uciElo: 1750`
- `multipv: 3`
- `choiceWeights: [0.84, 0.12, 0.04]`
- `maxCpGapFromBest: 55`
- `avoidMateInOne: true`
- `maxImmediateNetLoss: 105`

### AI-7

- `mode: elo_limit`
- `movetime: 1000`
- `limitStrength: true`
- `uciElo: 2000`
- `multipv: 1`
- `choiceWeights: [1]`
- `maxCpGapFromBest: 0`
- `avoidMateInOne: true`
- `maxImmediateNetLoss: 80`

### Coach

- `movetime: 1400`
- `limitStrength: false`
- `skillLevel: 20`
- `multipv: 3`

## Notes

- `AI-1` and `AI-2` were intentionally kept a little stronger than the earlier 600/900 labeling so they do not feel broken or random.
- `AI-7` was raised from `900ms` to `1000ms`.
- Coach remains unchanged so hint quality stays stable.

## Files

- `shared/constants.js`
- `test/phase5-ai-profile-balance.js`

## Full Code Snapshot

- Local-only snapshot: `legacy_code/full_code_20260312_231727_no_stockfish_no_legacy.md`
