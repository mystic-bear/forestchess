# Forest Chess Phase 3 Complete

**Timestamp:** 2026-03-12 14:35:37  
**Phase Goal:** Stockfish browser worker integration, AI-1~AI-7 play, 3-stage coach hints, stale-response safety

## Outcome

- `worker/ai-worker.js` now stays as the single public worker entry point.
- Stockfish integration is live through `worker/stockfish-adapter.js`.
- Browser engine candidate order is now:
  1. `stockfish-18-lite.js`
  2. `stockfish-18-lite-single.js`
  3. `stockfish-18-asm.js`
- AI-1 through AI-7 can now request real engine moves.
- Coach hints now return partial and final packets with staged guidance.
- `stateVersion` stale-response guards are active in the game layer.
- Engine failure now degrades gracefully to a local board instead of breaking the app.

## Main Changes

### Worker / Engine

- Added `worker/stockfish-adapter.js` for UCI lifecycle, move search, and info parsing.
- Added `worker/coach-dispatcher.js` for staged chess hint packets.
- Replaced the old Rummy worker logic in `worker/ai-worker.js` with chess-only routing for:
  - `chooseMove`
  - `getHint`
  - `partialHint`
  - `moveResult`
  - `hintResult`
  - `progress`

### Game / UI

- Reworked `js/game.js` to support:
  - Human vs AI start
  - automatic AI turns
  - hint session lifecycle
  - stale-response discard by `stateVersion`
  - graceful fallback when the engine fails
- Reworked `js/ui.js`, `index.html`, and `css/style.css` to show:
  - engine status
  - coach panel
  - hint stage buttons
  - hint source/target board highlights
  - live button state for AI / hint actions
- Updated `js/ai-bridge.js` to support browser and Node usage, callback-based partials, and a safer default worker path.
- Converted `shared/constants.js` and `shared/utils.js` into shared browser/Node modules.

### Tests

- Added:
  - `test/phase3-worker-bootstrap.js`
  - `test/phase3-choosemove-smoke.js`
  - `test/phase3-hint-smoke.js`
  - `test/phase3-stale-response.js`
- Updated `test/phase2-static-smoke.js` to match the current chess UI.

## Verification

### Core Regression

- `node test/chess-state-core-smoke.js`
- `node test/chess-state-perft.js`
- `node test/chess-fen-roundtrip.js`
- `node test/chess-special-rules-regression.js`
- `node test/chess-rules-status.js`
- `node test/phase2-static-smoke.js`
- `node test/phase3-stale-response.js`

### Worker / Engine Smoke

- `node test/phase3-worker-bootstrap.js`
- `node test/phase3-choosemove-smoke.js`
- `node test/phase3-hint-smoke.js`

All of the above passed.

## Phase 3 Completion Check

- Human vs AI play works through the single worker entry point.
- AI-1 to AI-7 now use real engine search.
- Hint requests return partial and final staged coach cards.
- Stale responses no longer overwrite the current board state.
- Engine load failure no longer kills the app.

## Next Step

- Phase 4 can now focus on persistence and review features on top of the working chess + engine + coach pipeline.
