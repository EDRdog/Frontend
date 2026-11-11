# 014. 랜딩을 스크롤 스토리텔링으로 만들고 GSAP 은 랜딩 경로에만 싣는다

- 날짜: 2026-11-11
- 상태: 채택 (#103)

## 배경
기존 랜딩은 카드와 문장 등장(IntersectionObserver)이 전부였고, 제품이 실제로 하는 일(이벤트를 받아 위협만 거르고, 경보에서 조치까지 한 화면에서 끝낸다)을 보여주지 못했다. 1차 히어로 시안 5개는 서비스와 안 맞고 밋밋하다는 평가로 모두 버렸다(`docs/design-docs/landing-v2.md`). 사용자가 제안한 흐름(이벤트 → 탐지 → 빈 대시보드 채우기)을 스크롤 단계로 만든다.

## 결정
1. **스크롤 스토리텔링.** 한 페이지가 히어로, 조사·대응, 위협 지도·관계 분석, 기능 벤토, CTA 순으로 이어진다. 고정(pin)된 장면이 스크롤 진행도에 맞춰 바뀐다. 섹션 하나가 컴포넌트 하나다(`src/components/landing/`).
2. **GSAP + ScrollTrigger 는 랜딩 경로에서만 불러온다.** `App.tsx` 에서 `Landing` 을 `lazy()` 로 둬서 gsap 이 랜딩 청크에만 들어간다. 로그인과 콘솔은 gsap 을 받지 않는다. Vercel Hobby 대역폭을 아끼고(ADR `decisions/001` 과 같은 이유) 콘솔 첫 화면을 가볍게 둔다. 각 섹션은 `useEffect` 안에서 `gsap.context` 로 연출을 만들고, 언마운트 때 `revert`, rAF 취소, 관찰자 해제, 타이머 정리를 한다.
3. **랜딩 토큰은 `.landing` 래퍼 안에서만 정의한다.** `DESIGN.md` 2장의 미드나잇/클라우드 값을 쓰는데, 콘솔(`src/index.css`)은 아직 옛 값이고 이름도 다르다(`--surface`, `--panel` 의미 차이 등). 콘솔을 한꺼번에 바꾸면 범위가 커지고 모든 화면이 흔들리므로, 랜딩만 새 토큰을 `.landing`(다크 기본, `:root[data-theme='light'] .landing`)에 두고 공통 클래스(`.btn`, `.badge`, `.card`, `.eyebrow`, `.h2`, `.lead`, `.wrap`, `.nav`)도 `.landing` 밑으로 가둔다. 콘솔 토큰 이전은 `docs/exec-plans/tech-debt.md` 에 남긴다.
4. **캔버스 색은 CSS 변수에서 읽는다.** 캔버스는 CSS 를 못 읽으므로 `.landing` 의 계산된 변수에서 값을 꺼내 쓰고, `html[data-theme]` 변화를 MutationObserver 로 보고 다시 읽는다. 스크롤 상태와 입자 위치는 그대로 둔다. 앱 테마(`useThemeStore`)를 따라간다(사용자 선택, 2026-11-11).
5. **DESIGN.md 6장 모션 규칙의 예외: SVG `stroke-dashoffset`.** 관계 그래프의 선은 스크롤에 맞춰 그려져야 해서 `stroke-dashoffset` 을 움직인다(`transform`, `opacity` 만 허용하던 규칙의 예외). 선 길이만큼의 dash 로 그려지는 표현은 transform 으로 대체할 수 없다. 예외는 이 한 곳이고 `DESIGN.md` 6장에도 적었다.

## 근거
- 버린 대안: 3D 지구 히어로, 강아지 로고 입자 연출(진행 중 방향이 바뀜), raea 영상 히어로(영상 용량이 Vercel Hobby 대역폭에 부담이고 스크롤과 맞물리기 어려움).
- 버린 대안: 랜딩 토큰을 `src/index.css` 에 합치기. 콘솔 화면 전체의 색이 같이 바뀌어 리뷰 범위가 폭발한다.
- 버린 대안: gsap 을 메인 번들에 두기. 콘솔만 쓰는 사람도 랜딩 전용 라이브러리를 받는다.
- 버린 대안: 랜딩 테마를 다크 고정 또는 라이트 고정. 앱 테마를 따라가는 쪽이 로그인과 콘솔로 이어질 때 어긋나지 않는다.
- ~~`prefers-reduced-motion` 이면 고정 없이 마지막 상태를 차례로 보여준다.~~ 2026-11-11 바꿨다. 아래 갱신 참고.

## 결과/영향
- `package.json` 에 `gsap` 추가. `src/pages/Landing.tsx` 는 껍데기(내비, 푸터)만 두고 `components/landing/` 의 `Hero`, `Flow`, `ThreatMap`, `Features` 를 이어 붙인다.
- `src/index.css` 의 옛 랜딩 전용 규칙(`[data-hero-panel]`, `edrPulse`, `edrCritGlow`, `edrCtaGlow`)을 지웠다.
- 콘솔 토큰이 `DESIGN.md` 와 아직 다르다(`docs/exec-plans/tech-debt.md`).
- `index.html` 의 JetBrains Mono 에 굵기 600 을 추가했다(랜딩 숫자와 라벨이 600 을 쓴다).

## 관련
- `docs/design-docs/landing-v2.md`, `docs/exec-plans/completed/2026-11-11-landing-scroll-story.md`
- `docs/requirements/landing.md`, `DESIGN.md` 2장, 6장
- ADR 015 (`docs/design-docs/decisions/015-redesign-direction.md`)

## 갱신 (2026-11-11)
- **랜딩은 움직임 줄이기 설정을 따르지 않는다.** 갤럭시에서 애니메이션 제거를 켜 둔 사용자에게 랜딩이 스크린샷처럼 멈춰 보였다. 이 설정을 켠 사람이 생각보다 흔하고(절전이나 기기 성능 때문에 켜 두기도 한다), 랜딩의 핵심 메시지가 움직임으로 전달돼서 정지 화면으로는 서비스가 설명되지 않는다고 판단했다. 콘솔은 그대로 설정을 따른다. 정지 화면 분기 코드는 남겨 두고 `utils.ts` 의 `prefersReduced` 한 곳에서 끈다.
  - 버린 대안: 설정을 켜면 배경 흐름만 남기고 스크롤 고정 연출은 끄기. 장면 구성이 두 갈래가 되어 손이 많이 가고, 정지 화면과 같은 이유로 이야기가 끊긴다.
- **1장 위협 표시:** 흐르는 로그 중 수상한 조각이 지나가며 위협 색으로 물들고, 오른쪽 아래 숫자 카드(오늘 수집, 탐지한 위협, 심각)가 오른다. 아래 가운데에 내려가기 화살표를 둔다.
  - 버린 대안: 조준 괄호, 퍼지는 고리, 화면 가장자리 경보, 경광등 깜빡임. 효과가 겹쳐 게임 화면처럼 싸 보였다(시안 `previews/landing-hero-alert.html`).
  - 버린 대안: 제목 문구 바꾸기(보안 로그, 정상처럼 보이는 공격 등). 세 줄이 한 문장으로 이어지는 흐름이 깨지거나 길어졌다. 이벤트는 보안 담당자에게 익숙한 용어이고 배경 연출과 설명 문장이 맥락을 준다.
- **위협 지도:** 지도에 닿자마자 6개국 공격 선이 연달아 출발하고, 나라 코드와 서울까지의 옅은 경로를 항상 그린다. 전에는 1초쯤 기다려야 첫 선이 나왔고 나라 이름은 선이 출발할 때만 잠깐 보였다.

