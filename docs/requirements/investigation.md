# 조사 화면 (PRD: `docs/product-specs/service.md` F3, F4)

알림·호스트·이벤트·사건의 목록과 상세. 왜 이렇게 정했는지는 `docs/design-docs/decisions/007`, `009`, `010`, `011`.

## 목록과 페이지네이션

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| INV-1 | 목록이 쪽 단위로 들어온다 | 네트워크 탭에서 offset 이 늘어나는지 | `docs/design-docs/decisions/007-server-pagination.md` | 수동 |
| INV-2 | 다음 쪽 유무를 `X-Has-More` 로 판단한다 | 2쪽 이후에도 더보기가 정확한지 | `docs/design-docs/decisions/007-server-pagination.md` | 수동 |
| INV-3 | 다음 쪽 요청에 첫 쪽의 `from`/`to` 를 그대로 싣는다 | 네트워크 탭에서 파라미터 확인 | `docs/design-docs/decisions/007-server-pagination.md` | 수동 |
| INV-4 | offset 상한을 넘기면 안내가 뜬다 (400 을 그대로 터뜨리지 않는다) | 깊은 페이지까지 내려본다 | `docs/design-docs/decisions/007-server-pagination.md` | 수동 |
| INV-5 | 필터가 서버로 넘어간다. 화면에서 거르지 않는다 | 유형 필터를 바꾸고 요청 파라미터 확인 | `docs/design-docs/decisions/009-server-side-search.md` | 수동 |
| INV-6 | 상단바 검색이 서버 `GET /api/search` 를 친다 | 검색어 입력 후 네트워크 탭 | `docs/design-docs/decisions/009-server-side-search.md` | 수동 |

## 상태 표시

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| INV-7 | "수집없음" 이 "정상" 과 다른 색이다 | 이벤트가 없는 기기를 등록해 목록에서 확인 | `docs/product-specs/service.md` F4 | 수동 |
| INV-8 | 호스트 상태 판정 규칙을 화면 문구로 설명하지 않는다 | 호스트 목록·상세의 설명 문구 확인 | `docs/design-docs/decisions/011-no-server-rules-in-ui-text.md` | 수동 |
| INV-9 | 이벤트 유형 칩에 심각도 색을 쓰지 않는다 | 이벤트 목록 확인 | `docs/product-specs/service.md` 비기능 요건 | 수동 |
| INV-10 | 원본 이벤트를 못 찾으면 프로세스명을 지어내지 않는다 | 계보가 끊긴 사건을 연다 | `docs/design-docs/decisions/010-no-fake-empty-state.md` | 수동 |

## 이벤트

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| INV-11 | `script` 유형이 `process` 와 같은 규칙으로 요약된다 | 인터프리터 실행 이벤트를 목록에서 본다 | `docs/design-docs/failures/007-script-events-dumped-raw-json.md` | 수동 |
| INV-12 | 모르는 유형이 와도 원본 JSON 을 요약 칸에 뿌리지 않는다 | 백엔드가 새 유형을 내보낼 때 확인 | `docs/design-docs/failures/007-script-events-dumped-raw-json.md` | 수동 |
| INV-13 | 행을 펼치면 상세 필드와 원본 JSON 을 볼 수 있다 | 이벤트 행 클릭 | `docs/product-specs/service.md` F4 | 수동 |
| INV-14 | 검색 결과에서 특정 이벤트로 바로 들어갈 수 있다 | 검색 → 이벤트 선택 | `docs/product-specs/service.md` F8 | 수동 |

## 사건

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| INV-15 | 사건 트리아지 후에도 계보와 구성 알림이 남아 있다 | 사건 상세에서 확정을 누른다 | `docs/design-docs/failures/005-triage-wiped-detail.md` | 수동 |
| INV-16 | 알림 트리아지 후 목록이 다시 조회된다 | 알림을 확정하고 목록 수치 확인 | `ARCHITECTURE.md` 상태 | 수동 |
| INV-17 | 증거 사슬에서 추정 단계가 점선으로 구분된다 | 사건 상세의 증거 사슬 확인 | `docs/design-docs/decisions/010-no-fake-empty-state.md` | 수동 |
| INV-18 | 긴 프로세스 이름이 옆 칸과 겹치지 않는다 | 긴 경로를 가진 프로세스가 있는 계보를 연다 | `docs/design-docs/decisions/005-hand-drawn-svg-graph.md` | 수동 |
