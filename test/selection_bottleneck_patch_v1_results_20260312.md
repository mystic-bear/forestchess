# Selection Bottleneck Patch v1 Results

Date: 2026-03-12

## Scope

This round applied and tested:

- chain finishable repair
- chain reject / repair debug breakdown
- exact final-loss / selection debug
- null fallback detail breakdown
- no additional crowded budget easing

Feature-set test phases:

- A: `chain`
- B: `exact`
- C: `combined`

## Commands

Smoke:

```bash
node test/chain-append-smoke.js
node test/crowded-selection-smoke.js
```

A. Chain only:

```bash
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules hard --feature-set chain
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules base --feature-set chain
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules base --feature-set chain
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules hard --feature-set chain
```

B. Exact only:

```bash
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules hard --feature-set exact
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules base --feature-set exact
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules base --feature-set exact
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules hard --feature-set exact
```

C. Combined:

```bash
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules hard --feature-set combined
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules base --feature-set combined
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules base --feature-set combined
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules hard --feature-set combined
```

## Smoke

- `chain-append-smoke`: PASS
- `crowded-selection-smoke`: PASS

Representative smoke read:

- `exact-obvious-1 (AI-5)`: `generated=347/0`, `afterReserve=81/0`, `finishable=81/0`, `topSeen=6/0`, `finalChosen=0/0`
- `exact-obvious-2 (AI-6)`: `generated=223/308`, `afterReserve=20/33`, `finishable=17/33`, `topSeen=3/9`, `finalChosen=0/0`
- `chain-obvious-2 (AI-6)`: `generated=112/632`, `afterReserve=58/48`, `finishable=0/0`, `topSeen=0/0`, `finalChosen=0/0`

Interpretation:

- exact generation and reserve survival exist
- chain generation also exists
- chain still often dies before finishable
- exact still rarely becomes final chosen in these fixed scenarios

## A. Chain Only

### Win/Loss summary

| Test | AI-4 | AI-5 | AI-6 |
|---|---:|---:|---:|
| 2p hard | 7-13 | 10-10 | 13-7 |
| 4p base | 2-10 | 2-10 | 8-16 |
| 2p base | 14-6 | 10-10 | 6-14 |
| 4p hard | 0-12 | 3-9 | 9-15 |

### Debug summary

- Chain repair fired only in a small number of cases.
- Dominant reject reason was `tailMissing`.
- `recipientRollback` produced a few repairs, but `donorReclosed` and `microTailBuilt` were effectively absent.
- `finalChosenChain` stayed effectively zero in self-play.

Representative readings:

- 2p hard, `AI-5` crowded:
  - `generated=59/302`
  - `afterReserve=21/59`
  - `finishable=5/2`
  - `topSeen=1/1`
  - `finalChosen=0/0`
  - `chainReject=5837/0/0/0/230`
  - `chainRepair=0/24/0/24`
- 2p hard, `AI-6` crowded:
  - `generated=91/277`
  - `afterReserve=22/40`
  - `finishable=4/2`
  - `topSeen=1/2`
  - `finalChosen=0/0`
  - `chainReject=8541/0/0/0/255`
  - `chainRepair=0/2/0/2`

### Phase verdict

- Chain repair is not the main fix yet.
- The current bottleneck remains closure: mostly `tailMissing`, secondarily `noRepairFound`.
- This phase alone does not restore actual chain selection in self-play.

## B. Exact Only

### Win/Loss summary

| Test | AI-4 | AI-5 | AI-6 |
|---|---:|---:|---:|
| 2p hard | 5-15 | 10-10 | 15-5 |
| 4p base | 1-11 | 5-7 | 6-18 |
| 2p base | 7-13 | 11-9 | 12-8 |
| 4p hard | 0-12 | 3-9 | 9-15 |

### Debug summary

- `generatedExact`, `afterReserveExact`, `finishableExact`, and sometimes `topSeenExact` all appear.
- `finalChosenExact` remained effectively zero.
- `exactFinalLoss.*` counters stayed near zero.
- dispatcher-level `chosenExact / chosenNonExactOverExact / exactSurvivedToDispatcher` also stayed near zero.

Representative readings:

- 2p hard, `AI-6` non-crowded:
  - `generatedExact=513`
  - `afterReserveExact=95`
  - `finishableExact=6`
  - `topSeenExact=3`
  - `finalChosenExact=0`
- 4p hard, `AI-6` crowded:
  - `generatedExact=158`
  - `afterReserveExact=82`
  - `finishableExact=9`
  - `topSeenExact=1`
  - `finalChosenExact=0`

### Phase verdict

- Exact-only tuning helped practical strength, especially `AI-6` in 2p hard/base.
- But the new exact-loss instrumentation is still too narrow: it is not yet capturing where exact is actually getting displaced.

## C. Combined

### Win/Loss summary

| Test | AI-4 | AI-5 | AI-6 |
|---|---:|---:|---:|
| 2p hard | 8-12 | 14-6 | 8-12 |
| 4p base | 3-9 | 4-8 | 5-19 |
| 2p base | 6-14 | 10-10 | 14-6 |
| 4p hard | 1-11 | 4-8 | 7-17 |

### Combined debug highlights

2p hard:

- `AI-5` crowded:
  - `generated=59/302`
  - `afterReserve=21/59`
  - `finishable=5/2`
  - `topSeen=1/1`
  - `finalChosen=0/0`
  - `chainReject=5837/0/0/0/230`
  - `chainRepair=0/24/0/24`
- `AI-6` crowded:
  - `generated=91/277`
  - `afterReserve=22/40`
  - `finishable=4/2`
  - `topSeen=1/2`
  - `finalChosen=0/0`
  - `chainReject=8541/0/0/0/255`
  - `chainRepair=0/2/0/2`

2p base:

- `AI-5` crowded:
  - `generated=16/245`
  - `afterReserve=13/46`
  - `finishable=0/0`
  - `finalChosen=0/0`
  - `chainReject=1729/0/0/0/213`
- `AI-6` crowded:
  - `generated=51/270`
  - `afterReserve=17/53`
  - `finishable=0/0`
  - `finalChosen=0/0`
  - `chainReject=1479/0/0/0/206`

4p hard:

- `AI-6` crowded:
  - `generated=53/253`
  - `afterReserve=33/38`
  - `finishable=5/10`
  - `topSeen=0/4`
  - `finalChosen=0/0`
  - `chainReject=8970/0/0/0/176`
  - `chainRepair=0/48/0/48`
  - `legacyReject=0/2`

### Phase verdict

- Combined patch is mixed.
- `AI-6` is strongest in 2p base.
- `AI-5` is strongest in 2p hard.
- In 4p mixed tests, `AI-6` is still the strongest of the three by winner count, but not by a large margin.
- Exact/chain final selection is still rare in real self-play.

## Null fallback detail

Observed pattern:

- `nullDetail.timeoutBeforeFinishable` is still the dominant null bucket where nulls exist.
- `openingConstraint` also appears meaningfully in hard tests.
- `noRearrangementCandidates` is usually zero.

Representative readings:

- 2p hard, `AI-4` crowded: `nullDetail=5/0/0/381/0`
- 2p hard, `AI-4` non-crowded: `nullDetail=40/0/0/161/53`
- 2p base, `AI-4` crowded: `nullDetail=2/0/3/373/0`
- 4p hard, `AI-4` crowded: `nullDetail=2/0/0/46/1`

Interpretation:

- Null fallback is not primarily caused by zero candidate generation.
- It is much more often a deadline / completion issue, plus some opening-lock cases.

## Overall conclusions

1. Chain is still dying mostly before finishable.
   - Dominant reason remains `tailMissing`.
   - `recipientRollback` can help, but only marginally.
   - `donorReclosed` and `microTailBuilt` are currently not moving the needle.

2. Exact has moved from "not seen" to "seen but not selected".
   - Generation, quota survival, reserve survival, and some finishable/topSeen events now occur.
   - But exact still rarely reaches `finalChosen`.
   - Current exact-loss instrumentation does not yet expose the actual displacement site.

3. Null fallbacks are more about completion/timing than zero generation.
   - `timeoutBeforeFinishable` is the main bucket.
   - `openingConstraint` is secondary.

4. Combined patch does not justify more crowded cap easing yet.
   - The current bottleneck remains selection/closure, not candidate generation alone.

## Recommended next step

- For chain:
  - improve legal closure after chain construction
  - focus on tail closure and retained-donor reclosure, not more generation

- For exact:
  - move the loss instrumentation closer to the real final replacement site
  - inspect the last non-exact winner over exact inside base strategy, not only dispatcher

- For nulls:
  - inspect why finishable is not reached before deadline
  - especially in non-crowded and opening-constrained turns
