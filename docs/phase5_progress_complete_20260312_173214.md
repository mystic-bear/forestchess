# Phase 5 Complete

## Completed at

- Date: 2026-03-12 17:32
- Scope: game archive, post-game analysis, critical moment cards, play-from-here, legacy isolation

## Delivered

1. Extended `js/persistence/save-manager.js` with archive storage and finished-game CRUD.
2. Added `worker/review-dispatcher.js` and `analyzeGame` support in the shared worker pipeline.
3. Extended `js/game.js` with archive save/update, post-game analysis requests, archive review opening, and play-from-here training starts.
4. Extended `js/ui.js`, `index.html`, and `shared/i18n.js` with archive overlay, analysis progress, and critical moment cards.
5. Isolated legacy Rummikub core and worker files into `legacy_rummikub/`.

## Main behavior now

- Finished games are stored in a recent-game archive.
- The archive can reopen old games and their replay timeline.
- Post-game analysis extracts critical moments and stores them back into the archive.
- Each moment card can jump to the replay point or start a new board from that position.
- `latest-save` now stays focused on in-progress games, while finished games live in the archive.

## Verification

- `node --check js/game.js`
- `node --check js/ui.js`
- `node --check js/ai-bridge.js`
- `node --check worker/ai-worker.js`
- `node --check worker/review-dispatcher.js`
- `node --check js/persistence/save-manager.js`
- `node --check js/chess/review.js`
- `node --check shared/constants.js`
- `node --check shared/i18n.js`
- `node test/phase5-archive-save.js`
- `node test/phase5-critical-moment-classify.js`
- `node test/phase5-play-from-here.js`
- `node test/phase5-archive-resume-separation.js`
- `node test/phase5-review-analysis-smoke.js`
- `node test/phase4-save-restore.js`
- `node test/phase4-autosave-resume.js`
- `node test/phase4-review-summary.js`
- `node test/phase4-pgn-export.js`
- `node test/phase4-fen-copy.js`
- `node test/chess-state-core-smoke.js`
- `node test/chess-state-perft.js`
- `node test/chess-fen-roundtrip.js`
- `node test/chess-special-rules-regression.js`
- `node test/chess-rules-status.js`
- `node test/phase2-static-smoke.js`
- `node test/phase3-stale-response.js`
- `node test/phase3-worker-bootstrap.js`
- `node test/phase3-choosemove-smoke.js`
- `node test/phase3-hint-smoke.js`

## Notes

- `legacy_rummikub/` is intentionally excluded from the Phase 5 full-code snapshot.
- Stockfish assets and the isolated legacy files stay out of the local Phase 5 snapshot.
