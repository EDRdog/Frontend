# 공통 (PRD: `docs/product-specs/service.md` F1, F2, F8)

라우팅, 인증, 데모, 새로고침, 테마. 왜 이렇게 정했는지는 `docs/design-docs/decisions/002`, `008`.

## 라우팅

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| SH-1 | `/report`, `/sequence`, `/operations` 가 각각 `/dashboard`, `/incidents`, `/onboarding` 으로 간다 | 세 경로를 직접 열어 리다이렉트 확인 | `ARCHITECTURE.md` 라우트 | 수동 |
| SH-2 | `/intelligence`, `/lookup`, `/map` 이 별도 청크로 떨어진다 | `scripts/check.sh::echarts_pages_are_lazy` | `docs/design-docs/decisions/001-lazy-load-echarts-pages.md` | 자동 |
| SH-3 | 배포본에서 `/dashboard` 를 직접 열어도 404 가 아니다 | `vercel.json` 리라이트. 배포 후 직접 접속 | `docs/product-specs/service.md` F3 | 수동 |

## 인증과 데모

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| SH-4 | 로그인 없이 조회 탭이 열리고 데모 데이터가 보인다 | 로그아웃 상태로 `/threats` 등을 연다 | `docs/design-docs/decisions/002-demo-without-login.md` | 수동 |
| SH-5 | 새로고침해도 로그인이 유지된다 | 로그인 후 새로고침 | `docs/product-specs/service.md` F1 | 수동 |
| SH-6 | localStorage 값이 깨져 있으면 로그아웃 상태로 시작한다 | 값을 임의로 망가뜨리고 새로고침 | `src/store/auth.ts` 주석 | 수동 |
| SH-7 | 토큰 만료(401)면 로그아웃된다 | 토큰을 지우고 조회 요청 | `ARCHITECTURE.md` 서버 통신 | 수동 |
| SH-8 | `/tenant/` 의 401 은 로그아웃시키지 않고 원인을 보여준다 | 틀린 `VITE_API_KEY` 로 온보딩 설정 저장 | `docs/design-docs/failures/003-api-key-401-mistaken-for-expiry.md` | 수동 |
| SH-9 | 비로그인 상태에서 `/me/*`, `/tenant/*` 를 호출하지 않는다 | 로그아웃 상태로 네트워크 탭 확인 | `docs/design-docs/decisions/002-demo-without-login.md` | 수동 |
| SH-10 | 보호 라우트 가드가 배선돼 있다 | `RequireAuth` 가 어디서도 import 되지 않는다 | `docs/exec-plans/tech-debt.md` | 미충족 |

## 새로고침

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| SH-11 | 자동 새로고침 기본값이 꺼짐이다 | 첫 방문에서 상단바 간격이 꺼짐 | `docs/design-docs/decisions/008-global-refresh-in-hook.md` | 수동 |
| SH-12 | 간격을 켜면 모든 화면이 같이 갱신된다 | 10초로 두고 여러 탭을 돈다 | `docs/design-docs/decisions/008-global-refresh-in-hook.md` | 수동 |
| SH-13 | 재조회 때 화면이 비워지지 않는다 | 목록을 보는 중에 갱신이 돌게 둔다 | `docs/design-docs/failures/009-refresh-wiped-loaded-pages.md` | 수동 |
| SH-14 | 여러 쪽을 내려본 뒤 갱신해도 쌓인 쪽이 남는다 | 3쪽까지 내리고 수동 새로고침 | `docs/design-docs/failures/009-refresh-wiped-loaded-pages.md` | 수동 |

## 표시

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| SH-15 | 테마 최초값이 OS 설정을 따른다 | OS 를 라이트로 두고 첫 방문 | `src/store/theme.ts` | 수동 |
| SH-16 | 로딩·에러·빈 상태가 화면마다 같은 모양이다 | `AsyncState` 를 쓰는지 코드 확인 + 화면 확인 | `ARCHITECTURE.md` 레이어 | 수동 |
| SH-17 | 모바일에서 드로어 하단이 잘리지 않는다 | 모바일 브라우저에서 드로어를 연다 | `docs/design-docs/failures/008-mobile-drawer-cut-off.md` | 수동 |
| SH-18 | 색이 심각도에만 쓰인다 | 이벤트 유형 칩에 색이 없는지 확인 | `docs/product-specs/service.md` 비기능 요건 | 수동 |
| SH-19 | 아이콘 라이브러리 의존성이 없다 | `scripts/check.sh::no_icon_library` | `docs/design-docs/decisions/012-no-icon-library.md` | 자동 |
