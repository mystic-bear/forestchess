# Phase 5 Error Log

## Purpose

Track archive, post-game analysis, review cards, play-from-here, and legacy-isolation issues discovered during Phase 5. Each resolved issue should keep its cause and fix summary so the next pass can trace regressions quickly.

---

## Open issues

- None yet.

---

## Resolved issues

- 2026-03-12 23:45
  - Symptom: The start screen presets still felt visually sparse, and the player setup / in-game side panels did not carry any player-facing animal identity beyond the piece theme.
  - Cause: The UI still relied on a five-card auto-fit preset grid and only stored seat state (`HUMAN`, `AI-x`) without a separate player-animal profile layer.
  - Fix: Added a dedicated 18-entry `PLAYER_ANIMALS` pool, randomized animals for recommended presets, added manual animal cycling for custom setup, and persisted `setupPlayerAnimals` through latest-save and archive flows. The start screen preset grid was also reshaped into a denser six-card layout with per-card emoji rows.
  - Result: The menu and player panels now look closer to a family animal-chess app, and player animal choices survive save/resume/archive paths.

- 2026-03-12 23:17
  - Symptom: The first final ladder draft would have weakened `AI-1` too much and still left several public labels behind the intended final 800-2000 ladder.
  - Cause: The earlier rebalance draft optimized for mid and top separation first, which made the entry tier feel too soft and left the UI labels out of sync with the intended final values.
  - Fix: Finalized the level ladder to `800 / 1000 / 1150 / 1300 / 1500 / 1750 / 2000`, restored a sturdier `AI-1`/`AI-2` profile, and raised `AI-7` from `900ms` to `1000ms`.
  - Result: The displayed ladder and engine parameters now match the intended final progression, with `AI-1` and `AI-2` staying beginner-friendly without becoming too random.

- 2026-03-12 22:51
  - Symptom: The post-game result modal let the critical-moment cards grow until the bottom action buttons were partially hidden.
  - Cause: The result overlay used the generic modal layout, so the analysis card list expanded with content instead of becoming the only scroll region.
  - Fix: Added a dedicated `result-card` layout in `index.html` and `css/style.css`, bounded the modal height, and moved scrolling responsibility to the analysis-card list.
  - Result: The result summary stays visible, the critical-moment cards scroll internally, and the bottom action buttons remain reachable.

- 2026-03-12 19:20
  - Symptom: The first headless AI ladder report produced impossible color splits such as white-side score rates over 100%.
  - Cause: The simulator aggregated `whiteScoreRate` and `blackScoreRate` using total draws instead of color-specific draws.
  - Fix: Updated `test/chess-ai-winrate-sim.js` to track `whiteDraws` and `blackDraws` separately, then regenerated the full matrix output.
  - Result: Color-split win-rate fields now stay within a valid 0-100% range, and the final matrix artifacts reflect the corrected aggregation.

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
