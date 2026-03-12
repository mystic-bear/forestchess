# Phase 5 AI Balance Progress

## Scope

- Rebalance low-level AI so `AI-1` to `AI-4` feel closer to beginner and club-strength opponents.
- Stop returning the engine top line unconditionally for weak levels.
- Preserve legality, mate-in-one defense, and the current worker contract.

## Implementation

1. `shared/constants.js`
   - Reduced low-level `movetime` and `skillLevel`.
   - Raised `multipv` for `AI-1` to `AI-5`.
   - Added `choiceWeights`, `avoidMateInOne`, and `maxImmediateNetLoss`.
2. `worker/ai-worker.js`
   - Added MultiPV candidate extraction.
   - Added weighted random move selection for weaker profiles.
   - Added immediate tactical risk filtering before final move output.
3. `test/phase5-ai-profile-balance.js`
   - Added regression coverage for the new level policy.

## Validation

- `node --check shared/constants.js`
- `node --check worker/ai-worker.js`
- `node test/phase5-ai-profile-balance.js`
- `node test/phase3-choosemove-smoke.js`
- `node test/phase3-hint-smoke.js`
- `node test/phase3-worker-bootstrap.js`
- `node test/phase3-stale-response.js`
- `node test/phase5-review-analysis-smoke.js`

## Outputs

- Error log: `docs/phase5_error_log.md`
- Bugfix summary: `docs/bugfix_ai_balance_20260312_173941.md`
- Local full-code snapshot: `legacy_code/full_code_20260312_173941_no_stockfish_no_legacy.md`
