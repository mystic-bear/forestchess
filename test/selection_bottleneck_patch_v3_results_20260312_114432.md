# selection_bottleneck_patch_v3 results

## Scope
- Patch files:
  - `worker/ai-base.js`
  - `worker/ai-dispatcher.js`
  - `worker/ai-levels.js`
  - `test/ai-winrate-sim.js`
- Raw logs:
  - `test/_v3_chain_2p_hard.txt`
  - `test/_v3_chain_4p_base.txt`
  - `test/_v3_chain_2p_base.txt`
  - `test/_v3_chain_4p_hard.txt`
  - `test/_v3_exact_2p_hard.txt`
  - `test/_v3_exact_4p_base.txt`
  - `test/_v3_exact_2p_base.txt`
  - `test/_v3_exact_4p_hard.txt`
  - `test/_v3_combined_2p_hard.txt`
  - `test/_v3_combined_4p_base.txt`
  - `test/_v3_combined_2p_base.txt`
  - `test/_v3_combined_4p_hard.txt`

## Smoke
- `node test/chain-append-smoke.js`
  - `PASS`
- `node test/crowded-selection-smoke.js`
  - `PASS`
  - notable:
    - `exact-obvious-2 (AI-6)` generated `172/216`, finishable `14/18`, topSeen `3/6`, finalChosen `0/0`
    - `chain-obvious-1 (AI-5)` generated `101/580`, finishable `38/53`, topSeen `2/8`, finalChosen `0/0`
    - `chain-obvious-2/3 (AI-6)` generated `58/589`, finishable `0/0`, finalChosen `0/0`

## A. chain
- `2p hard`
  - AI-5 `13-7`
  - AI-6 `10-10`
  - AI-4 `7-13`
  - crowded `finalChosenChain` stayed `0` for all levels
  - AI-6 had `chainMoves=1`, but crowded chosen chain rate was still `0.0%`
- `2p base`
  - AI-6 `14-6`
  - AI-5 `9-11`
  - AI-4 `7-13`
  - crowded and non-crowded both kept `finalChosenChain=0`
- `4p base`
  - wins: AI-6 `6`, AI-5 `4`, AI-4 `2`
  - chosen exact/chain remained `0`
- `4p hard`
  - wins: AI-6 `7`, AI-5 `3`, AI-4 `2`
  - chosen exact/chain remained `0`
- chain debug summary:
  - `chainReject.tailMissing` stayed dominant
  - `freePlusRackTail` and `microTailBuilt` appeared in some AI-5/6 runs
  - `recipientRollbackTailAware` appeared, but did not convert into self-play `finalChosenChain`
  - `chainLastLoss` stayed empty in all 4 chain runs

## B. exact
- `2p hard`
  - AI-5 `13-7`
  - AI-6 `9-11`
  - AI-4 `8-12`
- `2p base`
  - AI-6 `13-7`
  - AI-4 `10-10`
  - AI-5 `7-13`
- `4p base`
  - wins: AI-6 `8`, AI-5 `2`, AI-4 `2`
- `4p hard`
  - wins: AI-6 `7`, AI-5 `4`, AI-4 `1`
- exact debug summary:
  - self-play에서 `topSeenExact > 0`인 구간은 있었음
  - 예:
    - `exact 2p hard / AI-5 crowded`: `generatedExact=19`, `finishableExact=1`, `topSeenExact=0`
    - `exact 2p base / AI-6 non-crowded`: `generatedExact=13`, `afterReserveExact=12`, `topSeenExact=0`
    - `combined 2p base / AI-6 non-crowded`: `finishableExact=3`, `topSeenExact=2`, `finalChosenExact=0`
  - 하지만 `exactLastLoss` payload는 모든 self-play run에서 끝까지 `0`
  - 즉 이번 배치에서도 exact loss 기록 지점이 실제 탈락 지점을 아직 못 잡고 있음

## C. combined
- `2p hard`
  - AI-5 `13-7`
  - AI-6 `11-9`
  - AI-4 `6-14`
- `2p base`
  - AI-6 `11-9`
  - AI-5 `10-10`
  - AI-4 `9-11`
- `4p base`
  - wins: AI-4 `5`, AI-6 `4`, AI-5 `3`
- `4p hard`
  - wins: AI-6 `8`, AI-5 `3`, AI-4 `1`
- combined debug summary:
  - `finalChosenChain=0` persisted in all 4 runs
  - `finalChosenExact=0` persisted in all 4 runs
  - `chainLastLoss=0` persisted in all 4 runs
  - `exactLastLoss=0` persisted in all 4 runs
  - rescue:
    - one visible trigger only:
      - `combined 2p base / AI-5 non-crowded`
      - `rescue=1/0|none`
    - no successful rescue in any run

## Key findings
- v3 did not achieve the primary chain goal.
  - self-play에서 `finalChosenChain > 0`는 끝내 나오지 않았다.
- v3 did not yet expose the exact last-loss site in self-play.
  - `topSeenExact` is no longer strictly zero everywhere.
  - but `exactLastLoss` still never populated in the A/B/C tournament runs.
- finishability rescue is not materially helping yet.
  - one trigger appeared
  - success remained `0`
- null fallback pressure still looks closer to `timeoutNoFinishableEver` / pre-finishability failure than to late final comparison.
- current bottleneck looks earlier than the final-pass-best hook.
  - chain: closure succeeded in some repair paths, but still rarely reaches a stable finishable top candidate
  - exact: some exact candidates reach `finishable` and even `topSeen`, but the current loss payload still misses the real displacement point

## Practical conclusion
- chain:
  - next patch should stop focusing on extra closure variants
  - it should inspect why a repaired chain that reaches `finishableSeen/topSeen` still never becomes `finalChosen`
- exact:
  - next patch should move loss capture even closer to the actual best replacement site used by the pass/global handoff
  - current `final-pass-best` capture is still too late or on the wrong comparison edge
- rescue:
  - the trigger condition is firing too rarely and the candidate subset is too weak
  - next patch should inspect the rescue pool composition before changing the threshold

