# AI Winrate Simulator Bugfix

## Problem

The first tournament report generated valid games, but the color-split score fields were wrong. Some `whiteScoreRate` values exceeded `100%`, which made the summary unusable for calibration.

## Cause

The simulator tracked overall draws correctly, but reused that global draw count when computing white-side and black-side score rates.

## Fix

- Added `whiteDraws` and `blackDraws` to the level aggregate state.
- Updated the color-split score formulas to use side-specific draw counts.
- Reran the full `AI-1` to `AI-7` tournament after the fix.

## Result

- `whiteScoreRate` and `blackScoreRate` now stay inside valid bounds.
- The final matrix and CSV artifacts now match the corrected side-based aggregation.
