# Chain Tail Closure + Exact Last-Loss Reposition Results

Date: 2026-03-12 10:21:39

## Scope

This round applied:

- chain tail-closure prioritization
- staged tail search
- tail-aware recipient rollback
- chain closure counters
- exact last-loss payload moved into base strategy
- null timeout split

Not changed in this round:

- crowded cap easing
- strategic draw easing
- level6 floor easing
- tailless illegal fallback

## Files changed

- `worker/ai-base.js`
- `worker/ai-dispatcher.js`
- `worker/ai-levels.js`
- `test/ai-winrate-sim.js`

## Smoke

Commands:

```bash
node test/chain-append-smoke.js
node test/crowded-selection-smoke.js
```

Result:

- `chain-append-smoke`: PASS
- `crowded-selection-smoke`: PASS

Key smoke read:

- exact scenarios still generate and survive through `afterReserve` and `finishableSeen`
- chain scenarios still generate strongly
- `chain-obvious-2/3` still do not reach `finishableSeen`

## A. Chain Only

Commands:

```bash
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules hard --feature-set chain
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules base --feature-set chain
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules base --feature-set chain
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules hard --feature-set chain
```

### Win/Loss summary

| Test | AI-4 | AI-5 | AI-6 |
|---|---:|---:|---:|
| 2p hard | 7-13 | 8-12 | 15-5 |
| 4p base | 2-10 | 4-8 | 6-18 |
| 2p base | 8-12 | 12-8 | 10-10 |
| 4p hard | 2-10 | 5-7 | 5-19 |

### Chain metrics

What changed:

- `tailClosureLowPotential` is now visible and large.
- `freePlusRackTail` is now visible.
- `recipientRollbackTailAware` is now visible in non-crowded hard for AI-6.

Representative readings:

- 2p hard, `AI-6`, non-crowded:
  - `generated=300/264`
  - `afterReserve=52/19`
  - `finishable=6/4`
  - `topSeen=2/1`
  - `finalChosen=0/0`
  - `chainReject=3644/57/0/0/192/3722`
  - `chainRepair=3/3/0/12/0/3`
- 2p hard, `AI-5`, crowded:
  - `generated=28/78`
  - `afterReserve=8/17`
  - `finishable=2/0`
  - `finalChosen=0/0`
  - `chainReject=989/0/0/0/71/2130`
  - `chainRepair=0/0/4/0/0/0`

Interpretation:

- `freePlusRackTail` and `tail-aware rollback` are now firing.
- This means the new closure logic is being exercised.
- But `finalChosenChain` remains `0` in self-play.
- The success criterion `finalChosenChain > 0` was not reached.

Main chain bottleneck after this round:

- still closure/selection rather than raw generation
- `tailClosureLowPotential` and `tailMissing` remain dominant

## B. Exact Only

Commands:

```bash
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules hard --feature-set exact
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules base --feature-set exact
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules base --feature-set exact
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules hard --feature-set exact
```

### Win/Loss summary

| Test | AI-4 | AI-5 | AI-6 |
|---|---:|---:|---:|
| 2p hard | 6-14 | 10-10 | 14-6 |
| 4p base | 3-9 | 4-8 | 5-19 |
| 2p base | 10-10 | 9-11 | 11-9 |
| 4p hard | 2-10 | 1-11 | 9-15 |

### Exact metrics

Observed:

- `generatedExact`, `afterReserveExact`, and sometimes `topSeenExact` still appear.
- `finalChosenExact` remains `0`.
- `exactLastLoss` stayed `0` in pure exact runs.

Representative readings:

- 2p hard, `AI-5`, non-crowded:
  - `generated=108/49`
  - `afterReserve=52/7`
  - `finishable=8/0`
  - `topSeen=8/0`
  - `finalChosen=0/0`
  - `exactLastLoss=0|none|none`
- 4p hard, `AI-6`, non-crowded:
  - `generated=40/31`
  - `afterReserve=8/6`
  - `finishable=0/1`
  - `topSeen=0/1`
  - `finalChosen=0/0`
  - `exactLastLoss=0|none|none`

Interpretation:

- Exact is still mostly not becoming the active best inside the path where the payload is recorded.
- The loss payload moved to the right area, but exact-only runs still do not produce enough real exact-to-non-exact replacement events.

## C. Combined

Commands:

```bash
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules hard --feature-set combined
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules base --feature-set combined
node test/ai-winrate-sim.js --levels 4,5,6 --rounds 10 --max-turns 120 --time-scale 0.2 --rules base --feature-set combined
node test/ai-winrate-sim.js --players 4,5,6,6 --rounds 12 --max-turns 180 --time-scale 0.2 --rules hard --feature-set combined
```

### Win/Loss summary

| Test | AI-4 | AI-5 | AI-6 |
|---|---:|---:|---:|
| 2p hard | 5-15 | 11-9 | 14-6 |
| 4p base | 4-8 | 2-10 | 6-18 |
| 2p base | 5-15 | 13-7 | 12-8 |
| 4p hard | 0-12 | 4-8 | 8-16 |

### Combined metrics

This is the first phase where `exactLastLoss` produced a non-zero real payload.

Representative reading:

- 2p hard, `AI-6`, non-crowded:
  - `generated=151/150`
  - `afterReserve=57/19`
  - `finishable=12/10`
  - `topSeen=5/2`
  - `finalChosen=0/0`
  - `exactLoss=0/0/0/2/0/2`
  - `exactLastLoss=1|final-pass-best:1|chain:1|gap=0.0|rack=2.0/2.0|mob=0.0/0.0`

Interpretation:

- Exact is finally being observed losing inside base strategy.
- The first visible winner pattern was `winnerMode=chain`.
- The loss happened at `phase=final-pass-best`.
- It was a near-tie: `scoreGap=0`, same rack reduction, same future mobility.

This is useful because it narrows the next exact patch:

- the problem is not dispatcher-level only
- the first real visible loss point is inside pass-final best competition

### Chain status under combined

Representative readings:

- 2p hard, `AI-6`, crowded:
  - `generated=58/199`
  - `afterReserve=22/36`
  - `finishable=2/1`
  - `topSeen=1/1`
  - `finalChosen=0/0`
  - `chainReject=6136/0/0/0/173/10831`
  - `chainRepair=0/0/0/3/0/0`
- 2p base, `AI-5`, crowded:
  - `generated=6/42`
  - `afterReserve=5/8`
  - `finishable=0/0`
  - `finalChosen=0/0`
  - `chainReject=331/0/0/0/39/648`
  - `chainRepair=0/0/0/2/0/0`

Interpretation:

- Chain closure helpers are active but still not enough.
- `finalChosenChain` remained `0` across combined self-play.

## Null fallback breakdown

The split was useful.

Observed pattern:

- `timeoutNoFinishableEver` is the dominant null bucket.
- `timeoutAfterSomeFinishable` is usually `0`.
- `openingConstraint` is present in hard non-crowded segments, but secondary.

Representative readings:

- 2p hard combined, `AI-4`, crowded:
  - `nullDetail=10/0/0/438/0/0`
- 2p hard combined, `AI-4`, non-crowded:
  - `nullDetail=23/0/0/160/0/63`
- 4p hard combined, `AI-4`, crowded:
  - `nullDetail=0/0/0/112/0/0`

Interpretation:

- null fallback is still mostly "never found finishable before time"
- not "found some finishable and then ran out of time"

## Success criteria check

### Chain

Target:

- `finalChosenChain > 0`
- `tailMissing` decrease
- `freePlusRackTail` or `retainedAssistTail` visible

Result:

- `finalChosenChain > 0`: failed
- `freePlusRackTail`: succeeded
- `retainedAssistTail`: not meaningfully visible
- `tailMissing` is no longer the only useful signal, but low-potential closure is still dominant

### Exact

Target:

- `exactLastLoss` populated
- winner pattern visible
- `finalChosenExact` > 0 or exact loss reason becomes concrete

Result:

- `exactLastLoss`: succeeded, but only in combined and sparsely
- first visible winner pattern: `chain`
- `finalChosenExact > 0`: failed

### Null

Target:

- distinguish `timeoutNoFinishableEver` vs `timeoutAfterSomeFinishable`

Result:

- succeeded
- dominant pattern is clearly `timeoutNoFinishableEver`

## Overall conclusion

1. Chain closure improved technically, but not enough to change real selection.
   - `freePlusRackTail` and tail-aware rollback now fire.
   - But chain still does not become final chosen in self-play.

2. Exact loss capture finally became informative.
   - The first non-zero real signal says exact can lose to `chain` at `final-pass-best`.
   - This is much more actionable than the previous dispatcher-level counters.

3. Null fallback is now clearer.
   - The main problem is still "no finishable found before timeout".
   - It is not primarily "some finishable existed but time ran out later".

## Recommended next patch

- Chain:
  - focus on converting `freePlusRackTail` success into actual final choice
  - inspect why repaired/closed chain is still not becoming `topSeen` or `finalChosen`

- Exact:
  - inspect `final-pass-best` exact-vs-chain comparison directly
  - compare tie-break and terminal evaluation around that site

- Null:
  - investigate why crowded and non-crowded both still spend so many turns in `timeoutNoFinishableEver`
