# AI Winrate Refresh

## Run

- Timestamp: `20260312_200724`
- Levels: `AI-1` to `AI-7`
- Games per pair: `4`
- Max plies: `140`
- Concurrency: `2`

## Latest Artifacts

- Matrix report: `docs/ai_winrate_matrix_20260312_200724.md`
- Raw dataset: `docs/ai_winrate_matrix_20260312_200724.json`
- Pairwise CSV: `docs/ai_winrate_matrix_20260312_200724_pairwise.csv`
- Level summary CSV: `docs/ai_winrate_matrix_20260312_200724_levels.csv`

## Headline Results

- `AI-1`: `8.3%`
- `AI-2`: `20.8%`
- `AI-3`: `25.0%`
- `AI-4`: `54.2%`
- `AI-5`: `70.8%`
- `AI-6`: `85.4%`
- `AI-7`: `85.4%`

## Notes

- `AI-6` vs `AI-7` ended in `4` draws, so the top two levels are still too close in this sample.
- `AI-5` vs `AI-6` scored `37.5% / 62.5%` with `75%` draws.
- Every game record in the JSON still includes full move logs, SAN/UCI histories, FEN snapshots, engine depth, score, and latency.
