# Forest Chess AI Winrate Matrix

- Generated: 2026-03-12T17:00:26.303Z
- Levels: AI-1, AI-2, AI-3, AI-4, AI-5, AI-6, AI-7
- Games per pair: 20
- Max plies: 220
- Concurrency: 2
- Raw JSON includes per-game PGN, SAN/UCI history, and move-by-move logs with FEN, depth, score, and latency.

## Score Matrix

Row AI score rate against column AI. `100%` means the row AI scored every point, `50%` means even, `0%` means it scored nothing.

| Lv | AI-1 | AI-2 | AI-3 | AI-4 | AI-5 | AI-6 | AI-7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-1 | - | 40.0% | 15.0% | 20.0% | 0.0% | 0.0% | 0.0% |
| AI-2 | 60.0% | - | 30.0% | 10.0% | 2.5% | 0.0% | 0.0% |
| AI-3 | 85.0% | 70.0% | - | 25.0% | 7.5% | 0.0% | 0.0% |
| AI-4 | 80.0% | 90.0% | 75.0% | - | 2.5% | 2.5% | 0.0% |
| AI-5 | 100.0% | 97.5% | 92.5% | 97.5% | - | 15.0% | 15.0% |
| AI-6 | 100.0% | 100.0% | 100.0% | 97.5% | 85.0% | - | 25.0% |
| AI-7 | 100.0% | 100.0% | 100.0% | 100.0% | 85.0% | 75.0% | - |

## Draw Matrix

| Lv | AI-1 | AI-2 | AI-3 | AI-4 | AI-5 | AI-6 | AI-7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-1 | - | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| AI-2 | 0.0% | - | 0.0% | 0.0% | 5.0% | 0.0% | 0.0% |
| AI-3 | 0.0% | 0.0% | - | 0.0% | 15.0% | 0.0% | 0.0% |
| AI-4 | 0.0% | 0.0% | 0.0% | - | 5.0% | 5.0% | 0.0% |
| AI-5 | 0.0% | 5.0% | 15.0% | 5.0% | - | 30.0% | 30.0% |
| AI-6 | 0.0% | 0.0% | 0.0% | 5.0% | 30.0% | - | 40.0% |
| AI-7 | 0.0% | 0.0% | 0.0% | 0.0% | 30.0% | 40.0% | - |

## Game Count Matrix

| Lv | AI-1 | AI-2 | AI-3 | AI-4 | AI-5 | AI-6 | AI-7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-1 | - | 20 | 20 | 20 | 20 | 20 | 20 |
| AI-2 | 20 | - | 20 | 20 | 20 | 20 | 20 |
| AI-3 | 20 | 20 | - | 20 | 20 | 20 | 20 |
| AI-4 | 20 | 20 | 20 | - | 20 | 20 | 20 |
| AI-5 | 20 | 20 | 20 | 20 | - | 20 | 20 |
| AI-6 | 20 | 20 | 20 | 20 | 20 | - | 20 |
| AI-7 | 20 | 20 | 20 | 20 | 20 | 20 | - |

## By Level

| Level | W | L | D | Score | White Score | Black Score | Avg Plies | Avg Game ms | Avg Move ms | Avg Depth | Avg Score cp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI-1 | 15 | 105 | 0 | 12.5% | 10.0% | 15.0% | 79.4 | 14278.2 | 63.5 | 21.19 | -223.89 |
| AI-2 | 20 | 99 | 1 | 17.1% | 19.2% | 15.0% | 88.6 | 16284.1 | 74.2 | 21.53 | -192.33 |
| AI-3 | 36 | 81 | 3 | 31.3% | 32.5% | 30.0% | 95.3 | 19977.0 | 106.2 | 22.18 | -102.22 |
| AI-4 | 49 | 69 | 2 | 41.7% | 37.5% | 45.8% | 94.6 | 21251.0 | 129.7 | 22.09 | -52.63 |
| AI-5 | 75 | 28 | 17 | 69.6% | 70.0% | 69.2% | 99.7 | 33370.4 | 281.2 | 22.44 | 33.44 |
| AI-6 | 94 | 11 | 15 | 84.6% | 87.5% | 81.7% | 96.8 | 41619.4 | 512.8 | 24.06 | 169.46 |
| AI-7 | 105 | 1 | 14 | 93.3% | 96.7% | 90.0% | 94.1 | 57044.5 | 971.3 | 27.61 | 353.53 |

## Pairwise Detail

| Pair | Record | Score | Draw | Avg Plies | Avg Game ms | Left as White | Left as Black | Reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI-1 vs AI-2 | 8-12-0 | 40.0% / 60.0% | 0.0% | 104.0 | 7097.4 | 40.0% | 40.0% | checkmate:20 |
| AI-1 vs AI-3 | 3-17-0 | 15.0% / 85.0% | 0.0% | 86.5 | 7303.3 | 20.0% | 10.0% | checkmate:20 |
| AI-1 vs AI-4 | 4-16-0 | 20.0% / 80.0% | 0.0% | 91.9 | 8857.1 | 0.0% | 40.0% | checkmate:20 |
| AI-1 vs AI-5 | 0-20-0 | 0.0% / 100.0% | 0.0% | 66.8 | 11537.1 | 0.0% | 0.0% | checkmate:20 |
| AI-1 vs AI-6 | 0-20-0 | 0.0% / 100.0% | 0.0% | 65.1 | 18622.5 | 0.0% | 0.0% | checkmate:20 |
| AI-1 vs AI-7 | 0-20-0 | 0.0% / 100.0% | 0.0% | 61.8 | 32251.8 | 0.0% | 0.0% | checkmate:20 |
| AI-2 vs AI-3 | 6-14-0 | 30.0% / 70.0% | 0.0% | 113.1 | 10094.7 | 40.0% | 20.0% | checkmate:20 |
| AI-2 vs AI-4 | 2-18-0 | 10.0% / 90.0% | 0.0% | 99.2 | 10151.8 | 10.0% | 10.0% | checkmate:20 |
| AI-2 vs AI-5 | 0-19-1 | 2.5% / 97.5% | 5.0% | 74.5 | 13419.6 | 5.0% | 0.0% | checkmate:19, threefold-repetition:1 |
| AI-2 vs AI-6 | 0-20-0 | 0.0% / 100.0% | 0.0% | 71.4 | 20927.2 | 0.0% | 0.0% | checkmate:20 |
| AI-2 vs AI-7 | 0-20-0 | 0.0% / 100.0% | 0.0% | 69.3 | 36014.3 | 0.0% | 0.0% | checkmate:20 |
| AI-3 vs AI-4 | 5-15-0 | 25.0% / 75.0% | 0.0% | 109.8 | 13060.4 | 20.0% | 30.0% | checkmate:20 |
| AI-3 vs AI-5 | 0-17-3 | 7.5% / 92.5% | 15.0% | 96.0 | 18880.9 | 5.0% | 10.0% | checkmate:17, insufficient-material:1, threefold-repetition:1, max-plies-limit:1 |
| AI-3 vs AI-6 | 0-20-0 | 0.0% / 100.0% | 0.0% | 84.2 | 26352.5 | 0.0% | 0.0% | checkmate:20 |
| AI-3 vs AI-7 | 0-20-0 | 0.0% / 100.0% | 0.0% | 82.3 | 44170.3 | 0.0% | 0.0% | checkmate:20 |
| AI-4 vs AI-5 | 0-19-1 | 2.5% / 97.5% | 5.0% | 92.3 | 19177.7 | 5.0% | 0.0% | checkmate:19, threefold-repetition:1 |
| AI-4 vs AI-6 | 0-19-1 | 2.5% / 97.5% | 5.0% | 87.5 | 28379.3 | 0.0% | 5.0% | checkmate:19, threefold-repetition:1 |
| AI-4 vs AI-7 | 0-20-0 | 0.0% / 100.0% | 0.0% | 87.2 | 47880.0 | 0.0% | 0.0% | checkmate:20 |
| AI-5 vs AI-6 | 0-14-6 | 15.0% / 85.0% | 30.0% | 138.6 | 55345.6 | 15.0% | 15.0% | checkmate:14, threefold-repetition:3, insufficient-material:1, max-plies-limit:2 |
| AI-5 vs AI-7 | 0-14-6 | 15.0% / 85.0% | 30.0% | 130.3 | 81861.5 | 15.0% | 15.0% | checkmate:14, threefold-repetition:5, fifty-move-rule:1 |
| AI-6 vs AI-7 | 1-11-8 | 25.0% / 75.0% | 40.0% | 133.8 | 100089.4 | 45.0% | 5.0% | threefold-repetition:5, insufficient-material:2, checkmate:12, max-plies-limit:1 |

## Notable Upsets

- AI-6 beat AI-7 | reason=checkmate | plies=175 | opening=e4 e6 Nc3 Nf6 d4 d5 e5 Nfd7 f4 a6 Nce2 c5
- AI-3 beat AI-4 | reason=checkmate | plies=215 | opening=e3 e6 Be2 Nf6 c4 c5 Nf3 d5 d3 d4 b4 dxe3
- AI-3 beat AI-4 | reason=checkmate | plies=154 | opening=e4 c5 Nf3 d6 d4 Nf6 Nc3 cxd4 Nxd4 Nc6 Bg5 a6
- AI-3 beat AI-4 | reason=checkmate | plies=98 | opening=d4 Nf6 c4 d5 cxd5 c6 Nc3 cxd5 Bf4 e6 Rc1 Nc6
- AI-3 beat AI-4 | reason=checkmate | plies=99 | opening=e4 c5 Nf3 Nc6 Bb5 g6 d3 Bg7 O-O d6 Bxc6+ Bd7
- AI-3 beat AI-4 | reason=checkmate | plies=152 | opening=e4 c5 Nf3 Nc6 Bb5 d6 O-O a6 Bc4 e5 c3 b5
- AI-2 beat AI-4 | reason=checkmate | plies=158 | opening=e4 e6 Nf3 d5 e5 c5 c3 Ne7 d4 Nbc6 Bd3 Nf5
- AI-2 beat AI-4 | reason=checkmate | plies=143 | opening=e3 e6 Be2 Nf6 d4 d5 Nf3 Bd6 b3 O-O O-O Nbd7
- AI-1 beat AI-4 | reason=checkmate | plies=112 | opening=e4 c5 Nf3 d6 d4 cxd4 Nxd4 e5 Bb5+ Nc6 Ne2 Nf6
- AI-1 beat AI-4 | reason=checkmate | plies=106 | opening=e4 e6 Nc3 c5 Nf3 a6 a3 Nc6 d4 d6 d5 Nce7
