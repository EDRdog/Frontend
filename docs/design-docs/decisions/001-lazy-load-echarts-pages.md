# 001. echarts 를 쓰는 화면은 지연 로드한다

- 날짜: 2026-07-24
- 상태: 채택

## 배경
위협 지도와 시계열 차트를 넣으면서 echarts, echarts-for-react, world-atlas, topojson-client 가 들어왔다. 이것들이 메인 번들에 들어가면 랜딩과 로그인 화면까지 같이 무거워진다.

## 결정
`React.lazy` + `Suspense` 로 `/intelligence`, `/lookup`, `/map` 과 대시보드의 추이 차트를 별도 청크로 분리한다.

## 근거
> ThreatMap·ThreatTrendChart를 React.lazy로 분리 → echarts를 온디맨드 청크로, 메인 번들에서 제외. 랜딩/로그인/기타 페이지 초기 로딩 경량화

지도를 보러 오는 사람보다 랜딩과 로그인을 거치는 사람이 많다. 안 쓰는 사람이 비용을 내지 않게 한다.

## 결과/영향
- 빌드 결과에서 `ThreatMap`, `Intelligence`, `Lookup`, `RelationGraph`, `ThreatTrendChart` 가 각각 청크로 떨어진다.
- 그래도 echarts 본체 청크가 1.1MB(gzip 377KB)로 남아 있다. 지도를 처음 여는 사람은 이걸 받는다. `docs/exec-plans/tech-debt.md`
- `echarts-for-react` 가 쓰는 `tslib` 를 의존성으로 직접 명시해야 했다. 전이 의존성으로 두면 빌드가 깨졌다.

## 관련
- [005](005-hand-drawn-svg-graph.md)
