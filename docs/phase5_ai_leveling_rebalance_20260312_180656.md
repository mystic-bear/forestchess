# Phase 5 AI Leveling Rebalance

## Goal

Bring the public `AI-1` to `AI-7` labels closer to their intended real-game feel without changing the current coach hint strength.

## Policy

1. `AI-1` to `AI-4`
   - Stay on the existing weak MultiPV path.
   - Use lower `movetime`, lower `skillLevel`, and weighted candidate noise.
   - Keep only basic blunder guards.
2. `AI-5` to `AI-7`
   - Switch to `UCI_LimitStrength + UCI_Elo`.
   - `AI-5`: `1600` with `80/20` top-two selection.
   - `AI-6`: `1800` with `90/10` top-two selection.
   - `AI-7`: `2000` with top-line only.
   - Allow second-choice noise only when the cp gap from the best move stays small enough.
3. Coach hints
   - Keep the current strong profile.
   - Explicitly force `limitStrength: false` so coach analysis does not inherit Elo-limited game settings.

## Implementation

- `shared/constants.js`
  - Added `mode`, `limitStrength`, `uciElo`, and `maxCpGapFromBest` to engine profiles.
- `worker/stockfish-adapter.js`
  - Added `UCI_LimitStrength` and `UCI_Elo` option support.
- `worker/ai-worker.js`
  - Added cp-gap narrowing before weighted candidate choice.
  - Passed Elo-limit options into the engine session.
  - Kept coach and review analysis on unrestricted engine strength.

## Validation

- `node --check shared/constants.js`
- `node --check worker/stockfish-adapter.js`
- `node --check worker/ai-worker.js`
- `node test/phase5-ai-profile-balance.js`
- `node test/phase3-choosemove-smoke.js`
- `node test/phase3-hint-smoke.js`
- `node test/phase3-worker-bootstrap.js`
- `node test/phase3-stale-response.js`
- `node test/phase5-review-analysis-smoke.js`

## Local Snapshot

- `legacy_code/full_code_20260312_180656_no_stockfish_no_legacy.md`
