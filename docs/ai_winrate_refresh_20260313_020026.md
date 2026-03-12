## AI Winrate Refresh 2026-03-13 02:00:26

### Run
- Levels: `AI-1` to `AI-7`
- Games per pair: `20`
- Max plies: `220`
- Concurrency: `2`

### Artifacts
- [ai_winrate_matrix_20260313_020026.md](d:/프로젝트/forest%20chess/docs/ai_winrate_matrix_20260313_020026.md)
- [ai_winrate_matrix_20260313_020026.json](d:/프로젝트/forest%20chess/docs/ai_winrate_matrix_20260313_020026.json)
- [ai_winrate_matrix_20260313_020026_pairwise.csv](d:/프로젝트/forest%20chess/docs/ai_winrate_matrix_20260313_020026_pairwise.csv)
- [ai_winrate_matrix_20260313_020026_levels.csv](d:/프로젝트/forest%20chess/docs/ai_winrate_matrix_20260313_020026_levels.csv)

### Key Takeaways
- Final aggregate score rates:
  - `AI-1`: `12.5%`
  - `AI-2`: `17.1%`
  - `AI-3`: `31.3%`
  - `AI-4`: `41.7%`
  - `AI-5`: `69.6%`
  - `AI-6`: `84.6%`
  - `AI-7`: `93.3%`
- Upper ladder separation improved:
  - `AI-5 vs AI-6`: `15.0% / 85.0%`, draw `30.0%`
  - `AI-5 vs AI-7`: `15.0% / 85.0%`, draw `30.0%`
  - `AI-6 vs AI-7`: `25.0% / 75.0%`, draw `40.0%`
- Lower ladder still shows some noisy upsets:
  - `AI-1 vs AI-4`: `20.0% / 80.0%`
  - `AI-2 vs AI-4`: `10.0% / 90.0%`
  - `AI-3 vs AI-4`: `25.0% / 75.0%`

### Notes
- The run took about `6,150,591 ms` (`~102.5 minutes`).
- Raw JSON includes per-game PGN, SAN/UCI history, and per-move logs with FEN, depth, score, and latency for later rating-style analysis.
