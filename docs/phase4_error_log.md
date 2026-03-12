# Phase 4 Error Log

## Purpose

Track storage, resume, review, and export issues discovered during Phase 4. Each resolved issue should keep its cause and fix summary so the next pass can trace regressions quickly.

---

## Open issues

- None yet.

---

## Resolved issues

- 2026-03-12 16:25
  - Symptom: New Phase 4 smoke tests failed immediately with `TypeError` on `squareToIndex` and `playMoves`.
  - Cause: The tests imported `ChessState` and `ChessRules` as named exports, but the project UMD modules export direct objects.
  - Fix: Updated `test/phase4-save-restore.js`, `test/phase4-autosave-resume.js`, `test/phase4-review-summary.js`, `test/phase4-pgn-export.js`, and `test/phase4-fen-copy.js` to import the modules using the actual export shape.
  - Result: All Phase 4 tests passed after the import correction.
