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
