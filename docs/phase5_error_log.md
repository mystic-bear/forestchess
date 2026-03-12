# Phase 5 Error Log

## Purpose

Track archive, post-game analysis, review cards, play-from-here, and legacy-isolation issues discovered during Phase 5. Each resolved issue should keep its cause and fix summary so the next pass can trace regressions quickly.

---

## Open issues

- None yet.

---

## Resolved issues

- 2026-03-12 17:39
  - Symptom: `AI-1` to `AI-3` still felt too strong because they played like short-search Stockfish rather than beginner opponents.
  - Cause: Difficulty differences were driven almost entirely by `movetime` and `skillLevel`, while `chooseMove` still returned the engine's top line directly.
  - Fix: Rebalanced `shared/constants.js` low-level engine profiles to use lower `movetime`, lower `skillLevel`, higher `multipv`, and weighted candidate selection. Updated `worker/ai-worker.js` so low levels choose from MultiPV candidates with mate-in-one and immediate-loss guards instead of always taking the top move.
  - Result: `AI-1` to `AI-4` can now make visible, human-like inaccuracies while still blocking illegal moves and the worst immediate collapses.

- 2026-03-12 17:24
  - Symptom: The last-move board highlight was too faint, so it was hard to see the most recent move on the board.
  - Cause: `.square.last-from` and `.square.last-to` used a very light inset ring and a weak fill, so they blended into the board colors.
  - Fix: Strengthened the inset contrast and background tint in `css/style.css` for both last-move states.
  - Result: The most recent move squares now stand out clearly during play and review.
