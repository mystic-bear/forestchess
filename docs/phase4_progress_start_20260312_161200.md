# Phase 4 Start

## Started

- Date: 2026-03-12 16:12
- Scope: autosave, resume, result review summary, replay mode, PGN export, FEN copy

## Initial plan

1. Add `js/persistence/save-manager.js` and keep storage logic out of `js/game.js`.
2. Connect autosave and resume in `js/game.js`.
3. Add `js/chess/pgn.js` and `js/chess/review.js`.
4. Extend start screen and result modal UI for resume, review, export.
5. Add Phase 4 tests and rerun Phase 1-3 regressions.

## Current baseline

- Phase 3 gameplay, AI, and coach pipeline are working.
- Bilingual UI selector is already connected.
- No storage or review system exists yet.
