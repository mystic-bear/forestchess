# Forest Chess Phase 3 Error Log

## Tracking Rules

- Record each failure with timestamp, symptom, root cause, and fix.
- When a problem is fixed, keep the original note and append the resolution.
- Use this log to preserve debugging context across repeated worker and engine issues.

---

## 2026-03-12 13:50:22 - Initial Note

### Observation

- The original local Stockfish asset was a Windows executable and could not be used directly by the browser worker pipeline.

### Updated Status

- Browser-ready assets were expanded after the initial note.
- Final engine candidate order is `stockfish-18-lite.js -> stockfish-18-lite-single.js -> stockfish-18-asm.js`.
- The browser path now prefers the smaller `lite` multithread build, then falls back to single-thread and asm builds.

### Action

- Rebuild the adapter around browser worker messaging instead of native executable spawning for the primary path.

---

## 2026-03-12 14:06:00 - Engine Session Init Deadlock

### Symptom

- `worker/stockfish-adapter.js` used `init() -> ready() -> initPromise` recursion.
- This could deadlock the first engine boot because `ready()` waited on the same unresolved `initPromise`.

### Root Cause

- The first version of the adapter reused `ready()` from inside `init()`.
- `ready()` awaited `this.initPromise`, but `this.initPromise` was the promise currently executing `init()`.

### Fix

- Replaced the recursive `await this.ready()` call inside `init()` with a direct `isready` wait.
- Kept `ready()` as a public method, but changed it to call `init()` only when initialization has not started yet.

### Result

- Worker bootstrap and engine warmup now complete correctly.
- `phase3-worker-bootstrap`, `phase3-choosemove-smoke`, and `phase3-hint-smoke` all pass.

---

## 2026-03-12 14:12:00 - Sandbox `spawn EPERM` During Engine Smoke Tests

### Symptom

- Node-based Phase 3 worker smoke tests failed with `spawn EPERM`.

### Root Cause

- This was not a product bug.
- The sandbox blocked the child-process spawn that the engine adapter uses for local verification.

### Fix

- Re-ran the worker smoke tests with escalated permissions.
- Confirmed the product path itself works and boots `../stockfish-18-lite.js`.

### Result

- The engine worker returns legal moves and staged hints when allowed to spawn its test child process.

---

## 2026-03-12 14:21:00 - Phase 2 Static Smoke Test Drift

### Symptom

- `test/phase2-static-smoke.js` failed even though the current HTML structure was correct.

### Root Cause

- The test still matched a broken encoded string from the older Phase 2 HTML instead of the current Phase 3 markup.

### Fix

- Rewrote the static smoke test to validate the current chess setup text, coach panel, and the absence of Rummikub UI terms.

### Result

- `test/phase2-static-smoke.js` passes again and now reflects the live UI structure.

---

## 2026-03-12 14:54:01 - Custom Setup Panel Visible Before Click

### Symptom

- The custom setup card appeared on the start screen before pressing `Open custom setup`.
- The panel rendered lower on the page instead of staying collapsed under the summary card.

### Root Cause

- `index.html` marked the setup panel with `class="hidden"`, but `css/style.css` only hid `.screen.hidden`.
- Because there was no global `.hidden` rule, `#menu-setup` stayed visible at initial render.

### Fix

- Added a global `.hidden { display: none !important; }` rule.
- Added an explicit `ui.hideSetup()` call during `js/app.js` bootstrap so the menu state is correct even if the DOM is re-rendered.

### Result

- The start screen now opens with only the summary card visible.
- The full White/Black custom setup panel opens only after pressing the setup button.

---

## 2026-03-12 14:54:01 - Browser Engine Candidate Order Caused Practical AI Failure

### Symptom

- The browser app reported engine-unavailable behavior even though the Node smoke tests could boot the worker.
- In-browser AI felt like it never started.

### Root Cause

- The browser candidate order preferred `stockfish-18-lite.js` before `stockfish-18-lite-single.js`.
- The checked-in repo does not include the extra multithread helper asset that the lite multithread build expects, so the browser path could stall or fail before reaching a usable candidate.

### Fix

- Reordered browser engine candidates to prefer `stockfish-18-lite-single.js`, then `stockfish-18-asm.js`, with `stockfish-18-lite.js` moved behind them as a last fallback.
- Kept the resolved-worker URL patch in `js/ai-bridge.js` and `worker/stockfish-adapter.js` so worker paths are built from absolute browser URLs.

### Result

- `phase3-choosemove-smoke` now reports `../stockfish-18-lite-single.js` as the active engine path.
- Browser-targeted startup is aligned to the smaller, weaker, but actually runnable engine first.

---

## 2026-03-12 15:05:05 - `file://` Launch Shows Worker Access Error

### Symptom

- The board opened, but the info panel showed a raw browser error like:
- `Failed to construct 'Worker': Script at 'file:///...' cannot be accessed from origin 'null'.`

### Root Cause

- This is the browser security model for pages opened directly from disk.
- When `index.html` is opened through `file://`, the page origin is `null`, and worker script loading is blocked in many browsers.
- This is not the same failure mode as running from `http://localhost` or a deployed site.

### Fix

- Added a `file://` guard in `js/ai-bridge.js` before worker startup.
- The bridge now marks AI and coach as unavailable with a direct message:
- `AI and coach need http://localhost or a deployed site. Browsers block worker scripts on file:// pages.`

### Result

- Local file launches now fail in a predictable and readable way.
- The issue is isolated to `file://` runs, not to normal local-server runs.

---

## 2026-03-12 15:05:05 - Board Width Shifted With Layout Space

### Symptom

- The chess board could visually grow or shrink too much depending on the surrounding panel width.
- The center board area did not keep a stable desktop size.

### Root Cause

- The center grid column was flexible, and the board shell followed the full available width of that column.
- There was no explicit maximum board size or centered board-width cap in the panel.

### Fix

- Added `--board-max-size: 760px`.
- Centered the board header and board shell to `min(100%, var(--board-max-size))`.
- Set the game grid to `align-items: start` and the board panel to grid layout so the board keeps a stable top-aligned block.

### Result

- The board keeps a stable desktop footprint instead of continuing to expand with empty horizontal space.
- Smaller screens still shrink correctly because the cap is `min(100%, 760px)`.
