# Bugfix Result Modal Scroll

- Generated: 2026-03-12 22:51:48 KST

## Symptom

The post-game result modal grew vertically with the analysis cards, so the bottom action buttons were partially hidden and the user had to fight the whole overlay to reach them.

## Cause

The modal container did not have a result-specific height layout. The summary block, analysis progress block, and analysis card list all expanded naturally, so the card list consumed the remaining viewport height.

## Fix

- Added `result-card` layout rules with a bounded modal height.
- Split the modal into fixed sections plus a `minmax(0, 1fr)` scroll section for `analysis-card-list`.
- Added a stable footer treatment for `.overlay-actions`.
- Reduced visible card stack height so the list naturally previews about one and a half cards.

## Result

The critical-moment list now scrolls inside its own area and the bottom action buttons remain visible.
