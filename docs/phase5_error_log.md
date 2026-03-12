# Phase 5 Error Log

## Purpose

Track archive, post-game analysis, review cards, play-from-here, and legacy-isolation issues discovered during Phase 5. Each resolved issue should keep its cause and fix summary so the next pass can trace regressions quickly.

---

## Open issues

- None yet.

---

## Resolved issues

- 2026-03-12 18:06
  - Symptom: `AI-5` to `AI-7` were still too close to full-strength Stockfish, and `AI-7` overshot the intended "2000 challenge" feel.
  - Cause: All levels were still driven mainly by `Skill Level` and `movetime`, while upper levels had no Elo cap and weaker levels had no clear split from the stronger profiles.
  - Fix: Reworked the level model into two bands. `AI-1` to `AI-4` now stay on `weak_multipv` with weighted candidate selection, while `AI-5` to `AI-7` use `UCI_LimitStrength + UCI_Elo`. Added cp-gap filtering so `AI-5` uses an `80/20` top-two split only when the second move is close enough, `AI-6` uses `90/10`, and `AI-7` stays on the top line. Kept coach and review analysis on `limitStrength: false`.
  - Result: Higher levels now align better with their public labels, while the coach remains at the current strong analysis quality.

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
