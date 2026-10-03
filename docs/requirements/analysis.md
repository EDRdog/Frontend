# 분석 화면 (PRD: `docs/product-specs/service.md` F5)

관계 그래프, IP·도메인 조회, 위협 지도. 왜 이렇게 정했는지는 `docs/design-docs/decisions/005`, `006`, `010`.

## 관계 그래프

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| ANA-1 | 한 엔드포인트가 목적지 수백 곳으로 뻗어도 그래프 높이가 화면을 벗어나지 않는다 | 실데이터로 `/intelligence` 를 연다. 과거에 18120px 까지 늘어났다 | `docs/design-docs/failures/002-graph-grew-to-18000px.md` | 수동 |
| ANA-2 | 노드가 컨테이너 밖으로 잘리지 않는다 | 관계 수를 늘려가며 확인 | `docs/design-docs/decisions/005-hand-drawn-svg-graph.md` | 수동 |
| ANA-3 | 알림이 있는 연결과 없는 연결이 선 스타일로 구분된다 | `/intelligence` 에서 확인 | `docs/product-specs/service.md` F5 | 수동 |
| ANA-4 | 라벨이 노드 아래로 흩어지지 않고 박스 안에 들어간다 | 그래프 확인 | `docs/design-docs/decisions/005-hand-drawn-svg-graph.md` | 수동 |

## IP·도메인 조회

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| ANA-5 | 관측·추정·실시간 DNS 가 출처별로 구분돼 보인다 | `/lookup` 에서 도메인 조회 | `docs/design-docs/decisions/010-no-fake-empty-state.md` | 수동 |
| ANA-6 | 토폴로지에 없는 목적지를 지어내 그리지 않는다 | 관측되지 않은 도메인을 조회 | `docs/design-docs/decisions/010-no-fake-empty-state.md` | 수동 |
| ANA-7 | 실시간 정방향·역방향 DNS 결과가 따로 표시된다 | `/lookup` 확인 | `docs/product-specs/service.md` F5 | 수동 |

## 위협 지도

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| ANA-8 | 날짜변경선을 넘는 나라 때문에 띠가 생기지 않는다 | `/map` 을 열어 러시아·피지 주변 확인 | `docs/design-docs/failures/001-map-antimeridian.md` | 수동 |
| ANA-9 | 아메리카와 아프리카가 좌우로 잘리지 않는다 | `/map` 확인. 중심 경도 150°E | `docs/design-docs/decisions/006-map-polygon-clipping.md` | 수동 |
| ANA-10 | 로그인 상태에서 수집된 외부 연결이 없으면 예시로 채우지 않고 안내를 보여준다 | 데이터가 없는 계정으로 `/map` | `docs/design-docs/decisions/010-no-fake-empty-state.md` | 수동 |
| ANA-11 | 비로그인 데모에서는 지도가 비어 보이지 않는다 | 로그아웃 상태로 `/map` | `docs/design-docs/decisions/002-demo-without-login.md` | 수동 |
| ANA-12 | 백엔드의 `GET /events/geo` 를 부른다 | 네트워크 탭 확인. 과거에 없는 경로를 불렀다 | `docs/design-docs/failures/006-map-called-nonexistent-endpoint.md` | 수동 |
| ANA-13 | 확대한 뒤 다른 지역으로 이동할 수 있다 | 휠클릭 드래그 | `docs/design-docs/decisions/006-map-polygon-clipping.md` | 수동 |
