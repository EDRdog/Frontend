# #103 랜딩을 스크롤 스토리텔링으로 교체 (끝남, PR #106)

- 시안: `docs/design-docs/previews/landing-v2.html` (다크), `landing-v2-light.html` (라이트)
- 설계: `docs/design-docs/landing-v2.md`

## 단계
1. [x] `gsap` 의존성 추가. 랜딩 경로에서만 불러온다(`Landing` 은 lazy 로딩).
2. [x] 섹션 4개를 `src/components/landing/` 의 컴포넌트로 옮긴다: `Hero`, `Flow`, `ThreatMap`, `Features`. 각자 `useEffect` 안에서 `gsap.context` 로 시작하고 정리한다.
3. [x] 색은 `.landing` 안에 정의한 DESIGN.md 토큰(`landing.css`)을 읽는다. 콘솔 토큰(`src/index.css`)이 아직 옛 값이라 따로 뒀다(ADR 014). canvas 는 `html[data-theme]` 변화를 보고 색을 다시 읽는다.
4. [x] `src/pages/Landing.tsx` 를 새 섹션으로 교체한다. 상단 내비, 로그인·데모 링크는 기존 라우트를 쓴다.
5. [x] 모바일 390px 콘솔 글자 크기를 다듬는다. 콘솔을 380px 폭으로 다시 짜(증거 체인 세로 목록, 호스트 카드 두 줄) 배율을 0.95 근처로 올렸다.
6. [x] 검증: `scripts/check.sh`, 브라우저에서 다크·라이트·모바일·reduced-motion 확인.

## 결정
- 앱 테마를 따라간다(사용자 선택, 2026-11-11). 라이트 고정, 다크 고정은 버렸다.
- 랜딩 토큰은 `.landing` 에만 둔다. 콘솔 토큰 이전은 별도 작업(`docs/exec-plans/tech-debt.md`). 결정 기록은 `docs/design-docs/decisions/014-landing-scroll-storytelling.md`.
