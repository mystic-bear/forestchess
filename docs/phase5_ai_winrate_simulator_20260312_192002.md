# Phase 5 AI Winrate Simulator

## Goal

Add a headless chess self-play harness that reuses the real app AI path and produces enough data to estimate practical level strength.

## What Was Added

- `test/chess-ai-winrate-sim.js`
  - Runs AI-vs-AI games without the UI.
  - Uses the actual `worker/ai-worker.js` path instead of a mock engine.
  - Supports pairwise level tournaments, color swapping, max-ply limits, concurrency, and timestamped artifacts.

## Output Artifacts

- Matrix report: `docs/ai_winrate_matrix_20260312_192002.md`
- Raw dataset: `docs/ai_winrate_matrix_20260312_192002.json`
- Pairwise CSV: `docs/ai_winrate_matrix_20260312_192002_pairwise.csv`
- Level summary CSV: `docs/ai_winrate_matrix_20260312_192002_levels.csv`

## Raw Log Coverage

Each game record in the JSON artifact stores:

- `pgn`
- `moveHistorySan`
- `moveHistoryUci`
- `moveLogs[]`

Each `moveLogs[]` entry includes:

- `ply`
- `turn`
- `aiLevel`
- `fenBefore`
- `fenAfter`
- `moveUci`
- `moveSan`
- `from`
- `to`
- `pieceType`
- `capturedPiece`
- `promotion`
- `latencyMs`
- `depth`
- `scoreCp`
- `scoreMate`
- `backend`
- `enginePath`

That is enough to run later rating-estimation or move-quality analysis on real played games instead of only summary win rates.

## Run Settings Used

- Levels: `AI-1` to `AI-7`
- Games per pair: `2`
- Max plies: `140`
- Concurrency: `2`
- Language: `ko`

## Key Takeaways

- `AI-1` and `AI-2` are still clearly weaker than the mid ladder, but `AI-1` took a partial point from `AI-2`.
- `AI-3` and `AI-4` are no longer flatly equivalent; `AI-4` scored better overall.
- `AI-5` is strong and stable against `AI-1` to `AI-4`, then mostly draws or loses narrowly above that.
- `AI-6` and `AI-7` are currently very close in this 2-game-per-pair sample, with their head-to-head ending in two draws.

## Notes

- The current matrix is a baseline sample, not a final Elo calibration.
- For tighter confidence, rerun with more games per pair after inspecting the first matrix.
