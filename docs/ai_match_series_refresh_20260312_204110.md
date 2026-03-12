# Forest Chess Match Series Refresh

- Generated: 2026-03-12 20:41:10 KST
- Scope:
  - `AI-6 vs AI-7` for 10 games
  - `Coach vs AI-6` for 5 games
  - `Coach vs AI-7` for 5 games
- Engine path:
  - AI levels use the normal `chooseMove` worker pipeline.
  - Coach uses the stronger review/coach profile directly.

## Summary

### AI-6 vs AI-7

- Source: `docs/ai_match_series_ai_6_vs_ai_7_20260312_203911.*`
- Score:
  - `AI-6`: `45.0%`
  - `AI-7`: `55.0%`
- Draw rate: `70.0%`
- Wins:
  - `AI-6`: `1`
  - `AI-7`: `2`
  - Draws: `7`
- Average plies: `116.8`
- Main finish reasons:
  - `threefold-repetition: 4`
  - `max-plies-limit: 3`
  - `checkmate: 3`

Interpretation:
- `AI-7` is still stronger than `AI-6`, but the gap is modest.
- The pair still collapses into many long draws, so top-end separation is not yet wide.

### Coach vs AI-6

- Source: `docs/ai_match_series_coach_vs_ai_6_20260312_204047.*`
- Score:
  - `Coach`: `70.0%`
  - `AI-6`: `30.0%`
- Draw rate: `60.0%`
- Wins:
  - `Coach`: `2`
  - `AI-6`: `0`
  - Draws: `3`
- Average plies: `116.8`
- Main finish reasons:
  - `max-plies-limit: 2`
  - `threefold-repetition: 1`
  - `checkmate: 2`

Interpretation:
- Coach is clearly above `AI-6`.
- `AI-6` still survives into many drawn end states, but it failed to convert a win in this sample.

### Coach vs AI-7

- Source: `docs/ai_match_series_coach_vs_ai_7_20260312_204029.*`
- Score:
  - `Coach`: `60.0%`
  - `AI-7`: `40.0%`
- Draw rate: `80.0%`
- Wins:
  - `Coach`: `1`
  - `AI-7`: `0`
  - Draws: `4`
- Average plies: `94.0`
- Main finish reasons:
  - `threefold-repetition: 4`
  - `checkmate: 1`

Interpretation:
- `AI-7` is closer to Coach than `AI-6` is.
- Even so, Coach still came out ahead in the sample.
- The high draw rate suggests the current top profile is solid but still conservative.

## Rating/Log Notes

Each series JSON contains:

- per-game result metadata
- PGN
- SAN history
- UCI history
- `moveLogs[]` with:
  - `fenBefore`
  - `fenAfter`
  - `moveUci`
  - `moveSan`
  - `depth`
  - `scoreCp`
  - `scoreMate`
  - `latencyMs`
  - `aiLevel`
  - `enginePath`

This is enough to run a later rating-fit pass or move-quality regression without replaying the games.

## Current Takeaway

- `AI-6 -> AI-7` gap exists, but it is still smaller than ideal.
- `Coach > AI-7 > AI-6` is visible in this sample.
- If the goal is a clearer top-end ladder, `AI-7` likely needs either:
  - a slightly stronger `UCI_Elo` / time budget, or
  - reduced draw-prone move selection at the top end.
