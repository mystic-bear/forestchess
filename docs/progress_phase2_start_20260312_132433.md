# Forest Chess Phase 2 시작 기록

**작성 시각:** 2026-03-12 13:24:33  
**기준 커밋:** `585afae`

## 1. 시작 판단

Phase 1은 체스 코어 관점에서 완료됐다.

Phase 2의 실제 목표는 다음 두 축을 한 번에 닫는 것이다.

- 남아 있는 앱 전환 작업
- 사람 vs 사람 로컬 체스 UI 완성

즉, 이번 단계는 루미큐브 화면/상태 흐름을 제거하고 2인 체스 앱으로 바꾸는 단계다.

## 2. 이번 단계 목표

- 시작/세팅/대국 화면을 체스 기준으로 교체
- White / Black 2인 세팅 구조로 전환
- AI-1~AI-7 표기와 프리셋 정리
- 8x8 보드 렌더러 구현
- 선택/이동/프로모션 UI 연결
- 현재 턴 / 체크 / 마지막 수 / 수순 / 잡힌 기물 표시
- 동물 스킨 표시 모드 기본형 연결

## 3. 이번 단계 정책

- 공개 워커 진입점은 계속 `worker/ai-worker.js`
- 이번 단계에서는 AI와 힌트는 실제 연결하지 않음
- 관련 버튼은 자리만 두거나 비활성 처리
- 규칙 판단은 `ChessState`, `ChessRules`에 맡김
- UI 상태는 최소한만 유지

## 4. 우선 수정 파일

- `index.html`
- `shared/constants.js`
- `shared/utils.js`
- `js/game.js`
- `js/ui.js`
- `css/style.css`

## 5. 기록 규칙

- 오류는 `docs/phase2_error_log.md`에 누적 기록
- 단계별 진행상황은 `docs/`에 타임스탬프 문서로 기록
- 전체 코드 스냅샷은 `legacy_code/full_code_타임스탬프.md`로 기록

