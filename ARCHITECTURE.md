# Architecture

백엔드의 조회 API 를 읽어 그리는 SPA 다. 쓰기는 트리아지, 대응 실행, 개인 설정 셋뿐이고 나머지는 전부 읽기다.

## 레이어

```
pages/        화면 한 장. 라우트와 1:1
  ↓
hooks/        useApi, usePagedList — 조회·로딩·에러·재조회를 한 군데서 처리
  ↓
api/          client.ts(fetch 래퍼) + index.ts(엔드포인트 함수) + demo.ts(비로그인 데이터)
  ↓
백엔드 /api
```

옆으로 `components/ui/`(표시 전용)와 `store/`(zustand)가 붙는다.

| 디렉터리 | 책임 |
|---|---|
| `src/pages/` | 화면. 데이터를 모으고 배치한다 |
| `src/components/layout/` | `AppLayout`, `Sidebar`, `Topbar` |
| `src/components/landing/` | 랜딩 섹션(`Hero`, `Flow`, `ThreatMap`, `Features`)과 `landing.css`. gsap 은 여기서만 쓴다 |
| `src/components/ui/` | 표시 전용 조각. `AsyncState`, `ScrollArea`, `RelationGraph`, `AttackPath`, `AttackFlow`(세로 흐름), `FocusList`(포커스 배치 오른쪽 목록), `EvidenceChain` 등 |
| `src/hooks/` | `useApi`(단건), `usePagedList`(목록) |
| `src/api/` | 서버 통신과 DTO 타입, 비로그인 데모 데이터 |
| `src/store/` | `auth`, `alerts`, `refresh`, `theme` |

## 의존 방향

- **페이지는 `api/` 를 직접 부르지 않고 `hooks/` 를 거친다.** 자동 새로고침 구독과 재조회 시 데이터 유지가 훅 안에 들어 있어서, 직접 부르면 그 화면만 멈춘 데이터를 보여준다.
- **`components/ui/` 는 서버를 모른다.** props 로 받은 것만 그린다. 예외는 echarts 를 직접 쓰는 `ThreatTrendChart` 인데, 이것도 데이터는 props 로 받는다.
- **`store/` 는 데이터를 들고 있지 않다.** `alerts` 와 `refresh` 는 재조회 신호(version 카운터)만 들고, 실제 응답은 훅의 로컬 상태에 있다.
- **색은 심각도 전용이다.** 이벤트 유형처럼 심각도가 아닌 축에 색을 주지 않는다. 주면 위험도로 잘못 읽힌다.

## 라우트

`AppLayout` 밖: `/`(Landing), `/login`, `/password-change`. 나머지는 전부 `AppLayout` 안이다. `Landing` 은 gsap 때문에 `lazy()` 로 별도 청크다(ADR `docs/design-docs/decisions/014-landing-scroll-storytelling.md`).

`/settings/*`, `/audit`, `/selftest`, `/password-change` 는 데모가 없어 `RequireAuth` 로 감싼다. 토큰이 없으면 로그인 화면으로 간다. 나머지 조회 탭은 로그인 없이 열린다.

| 경로 | 화면 |
|---|---|
| `/dashboard` | 가장 급한 미판단 위협 하나(세로 공격 흐름, 권고, 판정), 대기열, 엔드포인트 상태, 접히는 한눈에 보기(탐지 추이, 위협 TOP5), 수집 수치 줄 |
| `/threats` | 상태별 보드(미판단, 확정, 오탐). 열마다 `alertPage` 를 status 하나씩 따로 부르고 따로 이어 받는다. 심각도 칩 필터 |
| `/endpoints`, `/endpoints/:host` | 포커스(고른 호스트의 위험도·프로세스 트리·위협 + 오른쪽 위험도 순 목록)와 상세(프로세스 트리, 이 호스트의 위협·사건·로그) |
| `/events` | 원시 이벤트. 포커스(고른 이벤트 하나를 크게, 원본 JSON까지 + 오른쪽 이벤트 흐름) |
| `/incidents`, `/incidents/:id` | 사건 체인 카드(루트 프로세스 → 탐지)와 상세(계보, 구성 알림, 증거 사슬, 타임라인) |
| `/intelligence` | 관계 분석. egress 토폴로지 그래프 |
| `/lookup` | IP·도메인 조회. 상관 그래프 + 실시간 DNS |
| `/map` | 위협 지도. echarts 세계지도 |
| `/onboarding` | 에이전트 설치, Slack webhook, 내 기기 등록 |
| `/settings/:tab` | 비밀번호 변경, 보안정책, 관리 IP, 계정(`password` `policy` `ip` `accounts`). 탭 본문은 `src/pages/settings/` |
| `/audit` | 감사기록. 필터, 정렬, 쪽 이동 |
| `/selftest` | 서버 자체시험과 무결성 검증 |
| `/password-change` | 기본 비밀번호 강제 변경. `AppLayout` 밖이라 셸이 없다 |

`/report`, `/sequence`, `/operations` 는 없어진 탭이라 각각 `/dashboard`, `/incidents`, `/onboarding` 으로 리다이렉트한다. 북마크와 예전 링크를 죽이지 않으려고 남겨 둔 것이다.

`/intelligence`, `/lookup`, `/map` 은 `lazy()` + `Suspense` 로 별도 청크다. echarts 와 지도 데이터가 무거워서 첫 화면에 딸려오면 안 된다.

## 상태

| 스토어 | 들고 있는 것 | 비고 |
|---|---|---|
| `auth` | `token`, `user`(`role`, `mustChangePassword` 포함), `sessionEnded` | localStorage 를 직접 읽고 쓴다. zustand `persist` 는 안 쓴다. `sessionEnded` 는 저장하지 않는다 |
| `alerts` | `version`, `bump()` | 트리아지 후 재조회 신호. 데이터는 안 들고 있다 |
| `refresh` | `version`, `lastAt`, `interval` | 전역 새로고침 신호. 기본값은 **꺼짐** |
| `theme` | `dark` / `light` | 최초값은 항상 `dark`(OS 설정을 따르지 않는다). 저장하지 않는다 |

자동 새로고침이 기본 꺼짐인 이유는 켜 두면 조사하는 도중에 목록이 바뀌어 보던 줄을 놓치기 때문이다. 켜는 것은 사용자가 정한다.

## 서버 통신

| | |
|---|---|
| Base URL | `VITE_API_BASE_URL`. 없으면 `/api` 로 떨어져 dev 프록시를 탄다 |
| dev 프록시 | `/api` → `API_PROXY_TARGET`(기본 `http://localhost:8084`). api-service 에 CORS 설정이 없어서 같은 출처처럼 부른다 |
| 인증 | `Authorization: Bearer <token>` + 항상 `X-API-Key`(`VITE_API_KEY`) |
| 목록 페이지 정보 | 응답 헤더 `X-Total-Count`, `X-Has-More`, `X-Time-From`, `X-Time-To` |
| 네트워크 실패 | status 0 + `UNREACHABLE` 로 변환. 5xx 도 같게 취급 |
| 401 | 세션이 끝난 것이라 로그아웃시키고 로그인 화면으로 보낸다(`sessionEnded`). 단 `/tenant/` 경로에서 본문이 `X-API-Key` 를 말하면 예외 |
| 403 + `code: password_change_required` | 기본 비밀번호를 안 바꾼 계정이다. `auth.user.mustChangePassword` 를 켜면 `AppLayout` 이 `/password-change` 로 보낸다 |

`/tenant/` 의 `X-API-Key` 401 만 예외인 이유는 그게 세션 종료가 아니라 키 불일치라서다. 그 경우 재로그인해도 해결되지 않는데 로그아웃시키면 사용자가 같은 일을 반복한다. 같은 `/tenant/` 경로에서도 세션이 끝난 401 은 본문이 헤더 이름을 말하지 않으므로 로그아웃시킨다.

세션이 끝나도 데모로 조용히 떨어지지 않고 로그인 화면으로 간다. 조회 탭이 비로그인으로도 열리기 때문에, 신호(`sessionEnded`)가 없으면 사용자는 로그아웃된 줄 모르고 데모 데이터를 실데이터로 본다.

**페이지네이션은 서버가 적용한 구간(`from`/`to`)을 다음 쪽에 그대로 실어 보낸다.** 조회가 최신순이라 그사이 새 데이터가 쌓이면 offset 이 밀려 행이 겹치거나 건너뛰어진다.

## 비로그인 동작

데이터 조회 탭은 로그인 없이 열리고, 토큰이 없으면 `api/demo.ts` 의 데모 데이터를 그린다. 판정은 `api/index.ts` 의 `isDemo()`(토큰이 `null` 인지)가 한다.

`/me/*` 와 `/tenant/*` 는 데모 폴백이 없어 비로그인 시 아예 호출하지 않는다. 보안 기능 화면도 마찬가지라 `RequireAuth` 로 막는다.

## 권한

역할은 `admin` 과 `viewer` 다. viewer 에게는 PLATFORM 묶음 메뉴와 대응·판단 버튼을 숨기기만 한다. 판정은 서버가 하고 viewer 의 요청은 403 이다.

## 외부 연동

| 대상 | 용도 |
|---|---|
| 백엔드 `api-service` | 전부. 호출하는 경로 목록은 `src/api/index.ts` |
| echarts | 탐지 추이 라인 차트, 위협 지도 |
| world-atlas + topojson-client | 세계 국가 폴리곤. 번들에 들어가 오프라인으로 조달된다 |
| Vercel | 배포. `vercel.json` 이 모든 경로를 `index.html` 로 리라이트한다(SPA) |

지도는 날짜변경선을 넘는 폴리곤을 직접 잘라 재배치한다. 중심 경도를 150° 로 둔 것은 127° 로 두면 이음매가 53°W 라 브라질이 좌우로 잘리기 때문이다. 150° 면 이음매가 대서양 30°W 로 떨어져 아메리카와 아프리카가 온전하다. 지도 색은 echarts 가 CSS 변수를 읽지 못해서 `getComputedStyle` 로 현재 테마의 토큰 값을 읽어 넘긴다(`RelationGraph` 와 같은 방식).
