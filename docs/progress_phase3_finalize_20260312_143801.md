# Forest Chess Phase 3 Finalize

**Timestamp:** 2026-03-12 14:38:01

## Finalize Notes

- Added repo hygiene for Stockfish vendor assets in `.gitignore`.
- Kept the runtime asset set limited to:
  - `stockfish-18-lite.js`
  - `stockfish-18-lite.wasm`
  - `stockfish-18-lite-single.js`
  - `stockfish-18-lite-single.wasm`
  - `stockfish-18-asm.js`
- Left oversized and unused vendor binaries out of the tracked set:
  - `stockfish-18.js`
  - `stockfish-18.wasm`
  - `stockfish-18-single.js`
  - `stockfish-18-single.wasm`
  - `stockfish.js-18.0.0/`

## Reason

- The app now prefers the lighter browser engine path and does not need the oversized 100MB-class full wasm assets for Phase 3.
- Keeping the tracked set focused avoids GitHub size problems and matches the actual runtime dependency graph.

## Snapshot Refresh

- Regenerated the full code snapshot after the final Phase 3 docs and `.gitignore` updates.
