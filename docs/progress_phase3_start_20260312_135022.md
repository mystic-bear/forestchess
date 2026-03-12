# Forest Chess Phase 3 Start

**Timestamp:** 2026-03-12 13:50:22
**Phase Goal:** Stockfish browser worker integration, AI-1~AI-7 play, 3-stage coach hints, stale-response safety

## Start State

- Phase 1 chess core is complete and regression-tested.
- Phase 2 chess UI is complete for local human vs human play.
- `worker/ai-worker.js` is still wired to the old Rummy AI pipeline.
- `js/game.js` still blocks AI matches and `requestHint()` is a placeholder.
- Browser-ready Stockfish assets are now available and were later narrowed to the practical runtime order:
  1. `stockfish-18-lite.js`
  2. `stockfish-18-lite-single.js`
  3. `stockfish-18-asm.js`

## Phase 3 Scope

1. Keep the public worker entry point at `worker/ai-worker.js`.
2. Add a Stockfish adapter layer and a coach dispatcher layer.
3. Enable human vs AI play with AI-1 through AI-7.
4. Replace the hint placeholder with partial and final coach cards.
5. Preserve stale-response protection through `stateVersion`.
6. Fail gracefully when engine boot or analysis fails.

## Immediate Work Plan

1. Add Phase 3 worker adapter and coach dispatcher.
2. Rewire `worker/ai-worker.js` to chess messages only.
3. Rewire `js/game.js` to allow AI start, AI turns, and real hint requests.
4. Extend `js/ui.js` and `index.html` with coach hint rendering and loading/error state.
5. Add Phase 3 smoke tests plus keep Phase 1/2 regression tests green.
