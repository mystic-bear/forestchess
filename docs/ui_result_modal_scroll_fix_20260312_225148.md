# UI Result Modal Scroll Fix

- Generated: 2026-03-12 22:51:48 KST
- Scope: post-game result modal layout adjustment

## Goal

The result modal was letting the critical-moment card list grow too tall, which pushed the bottom action buttons off-screen. The goal was to keep the full action row visible while showing only about one and a half analysis cards before scrolling.

## Changes

- Added a dedicated `result-card` class to the result modal container in `index.html`.
- Updated `css/style.css` so the result modal uses a fixed grid layout instead of natural full-height flow.
- Limited only the `analysis-card-list` area to an internal scroll region.
- Kept the action button area pinned at the bottom with a top divider and solid background fade.
- Tuned mobile behavior so the same pattern holds on smaller screens.
- Bumped the stylesheet cache version in `index.html`.

## Files

- `index.html`
- `css/style.css`

## Expected UI Result

- Review summary stays visible at the top.
- Critical-moment cards show roughly one to one-and-a-half cards before scrolling.
- Bottom buttons such as restart, menu, analyze, replay, PGN export, and FEN copy remain visible without needing to scroll the whole modal.

## Full Code Snapshot

- Local-only snapshot: `legacy_code/full_code_20260312_225148_no_stockfish_no_legacy.md`
