# Phase 1 오류 추적 문서

이 문서는 Phase 1 진행 중 발생한 오류, 원인 분석, 수정 여부를 기록한다.

## 오류 목록

| ID | 시각 | 상태 | 위치 | 증상 요약 |
|----|------|------|------|-----------|
| P1-001 | 2026-03-12 13:10 | 수정 완료 | `test/chess-state-perft.js` | Kiwipete perft 기준값 불일치 |
| P1-002 | 2026-03-12 13:16 | 수정 완료 | `test/chess-special-rules-regression.js` | 프로모션 테스트 FEN 파싱 실패 |
| P1-003 | 2026-03-12 13:16 | 수정 완료 | `test/chess-rules-status.js` | 50수 룰 테스트가 기물 부족 정책과 충돌 |
| P1-004 | 2026-03-12 13:18 | 수정 완료 | `test/chess-rules-status.js` | 같은 색 비숍 기물 부족 테스트 데이터 오류 |

---

## P1-001

### 증상

- `node test\\chess-state-perft.js` 실행 시 Kiwipete depth 3 노드 수가 기준값과 다르게 나옴
- 실제값: `79608`
- 기대값: `97862`

### 원인 추적

- 규칙 구현 오류처럼 보였지만 depth 1 legal move 수가 44로 나와 비정상 징후 확인
- 표준 Kiwipete 포지션은 depth 1 legal move 수가 48이어야 함
- 테스트에 입력된 FEN이 표준 Kiwipete FEN과 달랐음

### 수정 방법

- `test/chess-state-perft.js`의 Kiwipete FEN을 표준 참조값으로 교체

### 수정 내역

- 잘못된 FEN:
  - `r3k2r/p1ppqpb1/bn2pnp1/2PN4/1p2P3/2N2Q1p/PPPB1PPP/R3K2R w KQkq - 0 1`
- 수정된 FEN:
  - `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1`

### 결과

- perft 테스트 통과

---

## P1-002

### 증상

- `node test\\chess-special-rules-regression.js` 실행 시 FEN 파싱에서 킹 개수 오류 발생
- 에러 메시지:
  - `Board must contain exactly one king for each side`

### 원인 추적

- 프로모션 테스트용 FEN에 흑 킹이 2개 포함되어 있었음
- 첫 번째 랭크의 `4k3`와 마지막 랭크의 `4K2k`가 동시에 존재해 흑 킹이 중복됨

### 수정 방법

- 마지막 랭크의 추가 흑 킹을 제거해 정상 포지션으로 변경

### 수정 내역

- 잘못된 FEN:
  - `4k3/P7/8/8/8/8/7p/4K2k w - - 0 1`
- 수정된 FEN:
  - `4k3/P7/8/8/8/8/7p/4K3 w - - 0 1`

### 결과

- 프로모션 테스트 정상 진행

---

## P1-003

### 증상

- `node test\\chess-rules-status.js` 실행 시 50수 룰 관련 기대값이 실패
- 실제 이유: `insufficient-material`
- 기대 이유: `fifty-move-rule`

### 원인 추적

- 테스트에 사용한 포지션이 킹 대 킹이라 제품 정책상 자동 무승부인 기물 부족 상태였음
- Phase 1 정책에서는 기물 부족이 50수 claim보다 먼저 처리됨

### 수정 방법

- 50수 claim 검증용 포지션을 기물 부족이 아닌 포지션으로 교체
- 백 룩 1개를 추가해 자동 무승부 우선순위를 제거

### 수정 내역

- 잘못된 FEN:
  - `4k3/8/8/8/8/8/3K4/8 w - - 100 50`
- 수정된 FEN:
  - `4k3/8/8/8/8/8/3K4/R7 w - - 100 50`

### 결과

- 50수 룰 claim 테스트가 정책에 맞게 통과

---

## P1-004

### 증상

- `node test\\chess-rules-status.js` 실행 시 "same-colored bishops" 케이스가 실패
- 실제값: `false`
- 기대값: `true`

### 원인 추적

- 기물 부족 판정 로직보다 테스트 FEN을 먼저 점검
- 기존 테스트 포지션의 두 비숍은 실제로 서로 다른 색 칸에 놓여 있었음

### 수정 방법

- 두 비숍이 같은 색 칸에 놓이도록 FEN을 교체

### 수정 내역

- 잘못된 FEN:
  - `8/8/8/8/8/8/2B1K3/6bk w - - 0 1`
- 수정된 FEN:
  - `8/8/8/8/b7/8/2B1K3/7k w - - 0 1`

### 결과

- 같은 색 비숍 기물 부족 테스트 통과
