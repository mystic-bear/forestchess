# AI Leveling Bugfix

## Problem

`AI-7` was effectively too strong for a "2000 challenge" label, and `AI-5` / `AI-6` were still too close to the same top-line engine behavior.

## Cause

- Upper levels still depended on `Skill Level` instead of Elo-limited strength.
- MultiPV noise was either too weak or absent in the upper-mid range.
- Coach analysis risked inheriting the game engine's limited-strength options if they were not reset explicitly.

## Fix

1. Split the ladder into two modes:
   - `weak_multipv`: `AI-1` to `AI-4`
   - `elo_limit`: `AI-5` to `AI-7`
2. Set upper-level Elo targets:
   - `AI-5`: `1600`
   - `AI-6`: `1800`
   - `AI-7`: `2000`
3. Added guarded top-two selection:
   - `AI-5`: `80/20`
   - `AI-6`: `90/10`
   - `AI-7`: top-1 only
4. Added cp-gap filtering so the second candidate is only used when it is still close to the best move.
5. Forced coach/review analysis back to unrestricted strength.

## Result

- `AI-5` to `AI-7` should track their intended public labels better.
- `AI-7` remains the challenge tier without drifting too close to near-maximum Stockfish behavior.
- Coach hints keep the current quality level.
