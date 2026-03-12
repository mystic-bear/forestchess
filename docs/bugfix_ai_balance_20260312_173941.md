# AI Difficulty Balance Bugfix

## Problem

Low-level AI still felt too strong. Even `AI-1` often behaved like a reliable tactical engine because the worker mostly differed by `movetime` and `skillLevel`, then returned the best move from a single-engine line.

## Root Cause

- All levels used the same Stockfish family engine.
- `handleChooseMove()` effectively converted engine output into the top move.
- Low levels did not use MultiPV candidate noise or controlled blunder allowance.

## Fix

1. Lowered engine budgets for `AI-1` to `AI-5`.
2. Increased MultiPV counts for weaker levels.
3. Added weighted candidate selection.
4. Added safety guards:
   - always reject moves that lose by immediate mate-in-one
   - reject some large immediate material collapses on higher low/mid levels

## Result

- `AI-1` to `AI-3` now make more visible beginner-level inaccuracies.
- `AI-4` and `AI-5` remain stable but no longer snap to the top engine line every turn.
- `AI-6` and `AI-7` remain close to the strongest behavior.

## Related Files

- `shared/constants.js`
- `worker/ai-worker.js`
- `test/phase5-ai-profile-balance.js`
- `docs/phase5_error_log.md`
