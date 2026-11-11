# 랜딩 (PRD: `docs/product-specs/service.md` F1)

`/` 의 스크롤 스토리텔링 랜딩. 왜 이렇게 정했는지는 `docs/design-docs/decisions/014-landing-scroll-storytelling.md`, 설계는 `docs/design-docs/landing-v2.md`.

## 연출과 구성

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| LD-1 | 히어로가 고정된 채 이벤트 흐름 → 탐지 게이트 → 대시보드 채우기 순으로 스크롤에 맞춰 바뀌고, 되감으면 같은 자리로 돌아온다 | `/` 에서 처음부터 끝까지 내렸다가 올린다 | `docs/design-docs/landing-v2.md` | 수동 |
| LD-2 | 조사·대응 콘솔이 경보 열기, 증거 체인, 프로세스 종료, 격리 순으로 스크롤에 맞춰 진행된다 | `#flow` 구간을 천천히 내린다 | `docs/design-docs/landing-v2.md` | 수동 |
| LD-3 | 위협 지도의 궤적과 외부 연결 목록이 화면에 보이는 동안만 움직이고, 관계 그래프는 모으기 → 잇기 → 판정 순으로 그려진다 | `#map` 구간을 내리고 화면 밖일 때 CPU 사용을 본다 | `docs/design-docs/landing-v2.md` | 수동 |
| LD-4 | 기능 타일 6개가 보이는 동안만 작은 동작이 돌고, 마지막 CTA 의 로그인, 데모 보기 링크가 `/login`, `/dashboard` 로 간다 | `#features`, `#start` 를 내려 확인하고 링크를 누른다 | `docs/design-docs/landing-v2.md` | 수동 |
| LD-5 | 내비의 동작 방식, 위협 지도, 기능 링크가 각 구간으로 이동하고, 로그인과 데모 보기가 기존 라우트(`/login`, `/dashboard`)로 간다 | 내비 링크를 모두 누른다 | `src/pages/Landing.tsx` | 수동 |

## 테마

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| LD-6 | 내비의 해·달 버튼 하나로 다크와 라이트가 바뀌고, 글자 라벨 없이 `aria-label` 로 설명한다 | 버튼을 눌러 전환, 스크린리더 라벨 확인 | `DESIGN.md` 5장 | 수동 |
| LD-7 | 테마를 바꿔도 캔버스(히어로 흐름, 위협 지도, CTA 점)가 새 색으로 다시 그려지고 스크롤 진행도가 유지된다 | 히어로 중간, 지도 구간에서 테마를 바꾼다 | `docs/design-docs/decisions/014-landing-scroll-storytelling.md` | 수동 |
| LD-8 | 랜딩 토큰이 `.landing` 안에만 있어 콘솔 화면의 색이 바뀌지 않는다 | `/dashboard` 를 열어 색이 이전과 같은지 확인 | `docs/design-docs/decisions/014-landing-scroll-storytelling.md` | 수동 |
| LD-9 | 랜딩에 DESIGN.md 에 없는 색, 곡률, 글꼴이 없고 아이콘 라이브러리, 이모지를 쓰지 않는다 | `scripts/check.sh::no_icon_library` 와 화면 점검 | `AGENTS.md` 금지사항 | 수동 |

## 번들과 정리

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| LD-10 | gsap 이 랜딩 청크에만 들어가고 메인 청크와 로그인, 콘솔에는 들어가지 않는다 | `npm run build` 산출물에서 `index-*.js` 에 gsap 이 없고 `Landing-*.js` 가 따로 있는지 확인 | `docs/design-docs/decisions/014-landing-scroll-storytelling.md` | 수동 |
| LD-11 | `/` 를 떠나면 rAF, 관찰자, 타이머, ScrollTrigger 가 모두 정리된다 | `/` → `/dashboard` → `/` 를 반복해 콘솔 에러와 중복 고정 구간이 없는지 본다 | `docs/design-docs/decisions/014-landing-scroll-storytelling.md` | 수동 |
| LD-12 | 움직임 줄이기 설정을 켜도 랜딩 연출은 그대로 돈다 | OS 설정으로 움직임 줄이기를 켜고 `/` 를 연다 | `DESIGN.md` 6장, ADR 014 | 수동 |

## 모바일 (390px)

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| LD-13 | 조사·대응 콘솔의 글자가 화면에서 약 11px 이상으로 읽히고 가로로 넘치지 않는다. 높이 700px 이하 폰(390x667, 375x667)에서는 부수 요소(창 제목줄, 호스트 상세, 표 아래 두 줄, 단계 설명)를 빼고 콘솔을 좁고 낮게 그려 줄어들지 않게 한다 | 390x844, 390x667, 375x667 에서 `#flow` 구간을 내린다. 2026-11-11 Playwright 로 콘솔 최소 글자(글자 크기 x 축소 배율)가 667px 높이에서 11.0px 이상, 가로 넘침 없음을 쟀다 | `docs/exec-plans/completed/2026-11-11-landing-scroll-story.md` 5단계 | 수동 |
| LD-14 | 위협 지도가 작아도 점, 궤적, 목록이 읽히고 가로 스크롤이 생기지 않는다 | 390x844 에서 `#map` 구간을 내린다 | `docs/exec-plans/completed/2026-11-11-landing-scroll-story.md` 5단계 | 수동 |
