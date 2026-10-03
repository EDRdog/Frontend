# 001. 날짜변경선을 넘는 나라 때문에 지도가 띠로 깨졌다

## 증상
위협 지도가 깨져 보였다. 지도를 가로지르는 띠가 생겼다.

## 원인
`world-atlas` 110m 은 러시아·피지·남극처럼 날짜변경선을 넘는 나라를 폴리곤 하나에 담는다. 링 안에서 경도가 179°→-179° 로 건너뛴다. echarts geo 는 경위도를 평면에 그대로 찍으므로 그 한 변이 지도를 가로지르는 띠가 된다.

## 해결
등록 전에 링을 펴서(unwrap) 이음매에서 Sutherland-Hodgman 으로 자르고 제자리로 되돌린다(normalize). 외부 의존성은 늘리지 않았다.

중심 경도는 150°E 로 잡았다. 127°E(서울)로 두면 이음매가 53°W 라 브라질이 좌우로 잘린다.

## 재발 방지
`world-atlas` 를 갈아끼우거나 중심 경도를 바꾸면 이 클리핑을 다시 봐야 한다. 근거를 `ThreatMap.tsx` 주석과 `docs/design-docs/decisions/006-map-polygon-clipping.md` 에 남겼다.

## 관련
- `docs/design-docs/decisions/006-map-polygon-clipping.md`
