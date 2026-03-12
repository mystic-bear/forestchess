# Forest Chess Match Series Remeasure

- Generated: 2026-03-12 21:56:48 KST
- Scope:
  - `AI-5 vs AI-6`, `AI-5 vs AI-7`, `AI-6 vs AI-7`
  - `Coach vs AI-5`, `Coach vs AI-6`, `Coach vs AI-7`
- Measurement patch:
  - randomized opening set (`10` openings)
  - longer game cap (`220` plies)
  - per-game `ucinewgame` reset for worker AI and direct Coach engine
  - fixed seed: `20260312`

## Results

| Matchup | Left Score | Right Score | Draw Rate | Main Notes |
| --- | --- | --- | --- | --- |
| AI-5 vs AI-6 | 40.0% | 60.0% | 80.0% | Gap exists, but many draws remain |
| AI-5 vs AI-7 | 5.0% | 95.0% | 10.0% | Clear top-end separation |
| AI-6 vs AI-7 | 45.0% | 55.0% | 90.0% | Still heavily draw-bound |
| Coach vs AI-5 | 80.0% | 20.0% | 40.0% | Coach clearly above AI-5 |
| Coach vs AI-6 | 75.0% | 25.0% | 50.0% | Coach clearly above AI-6 |
| Coach vs AI-7 | 60.0% | 40.0% | 80.0% | AI-7 is closest to Coach |

## File Map

- `AI-5 vs AI-6`
  - `docs/ai_match_series_remeasure_ai_5_vs_ai_6_20260312_212736.*`
- `AI-5 vs AI-7`
  - `docs/ai_match_series_remeasure_ai_5_vs_ai_7_20260312_212846.*`
- `AI-6 vs AI-7`
  - `docs/ai_match_series_remeasure_ai_6_vs_ai_7_20260312_213041.*`
- `Coach vs AI-5`
  - `docs/ai_match_series_remeasure_coach_vs_ai_5_20260312_214700.*`
- `Coach vs AI-6`
  - `docs/ai_match_series_remeasure_coach_vs_ai_6_20260312_215606.*`
- `Coach vs AI-7`
  - `docs/ai_match_series_remeasure_coach_vs_ai_7_20260312_215156.*`

Each JSON includes:

- PGN
- SAN/UCI history
- full move logs with:
  - `fenBefore`
  - `fenAfter`
  - `moveUci`
  - `moveSan`
  - `depth`
  - `scoreCp`
  - `scoreMate`
  - `latencyMs`
  - `enginePath`
- opening metadata

## What Changed Compared To The Earlier Short-Cap Runs

- `AI-5` separated much more clearly from `AI-7`.
- `Coach` separated more clearly from `AI-5` and `AI-6`.
- `AI-6 vs AI-7` still did **not** open up much, even after:
  - random openings
  - longer ply cap
  - per-game engine reset

## Current Interpretation

- The earlier concern about measurement bias was real for `AI-5` and `Coach vs lower top tiers`.
- But the remaining `AI-6 vs AI-7` compression looks like a **profile design issue**, not just a measurement issue.
- In practical terms:
  - `AI-5` is now clearly below `AI-7`
  - `Coach` is clearly above `AI-5` and `AI-6`
  - `AI-7` is still only modestly above `AI-6`

## Next Design Target

If you want stronger top-end separation, the next adjustment target is not the simulator first. It is the engine profile itself:

- push `AI-7` a bit higher
- or pull `AI-6` a bit lower
- or reduce draw-prone conservatism in `AI-7`

Right now the measurement patch was enough to expose that `AI-6 < AI-7` exists, but the gap is still too small for a clean ladder.
