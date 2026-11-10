# 보안 기능 관리 (PRD: `docs/product-specs/service.md` F9)

비밀번호, 보안정책, 관리 IP, 계정, 감사기록, 자체점검, 강제 변경, viewer 권한. 왜 화면에 서버 규칙이 적혀 있는지는 `docs/design-docs/decisions/013`. 화면의 규칙은 안내용이고 최종 판정은 서버가 한다.

테스트 러너가 없어 전부 `수동` 이다. 2026-11-11 에 로컬 백엔드(api-service dev 머지본, `localhost:8084`)에 붙여 확인한 항목은 비고 열이 아니라 이 문서 아래 "확인 기록" 에 적는다.

## 인증 흐름

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| KS-1 | 로그인 실패는 사유와 무관하게 한 문장만 보인다 | 없는 계정과 틀린 비밀번호로 각각 로그인해 문구가 같은지 본다 | `docs/product-specs/service.md` F9 | 수동 |
| KS-2 | 기본 비밀번호로 로그인하면 `/password-change` 로 가고, 바꾸기 전에는 다른 화면으로 못 간다 | 계정 만들기로 만든 viewer 로 첫 로그인한 뒤 `/dashboard` 를 직접 연다 | `docs/product-specs/service.md` F9 | 수동 |
| KS-3 | 서버가 403(`password_change_required`)을 주면 강제 변경 화면으로 간다 | localStorage `edrdog.auth` 의 `mustChangePassword` 를 false 로 바꾸고 `/threats` 를 연다 | `src/api/client.ts` | 수동 |
| KS-4 | 세션이 끝나면(401) 로그인 화면으로 가고 안내가 뜬다. 데모로 나가도 다시 튕기지 않는다 | 같은 계정을 다른 곳에서 로그인하고 클릭한다. 유휴 종료는 정책을 1분으로 두고 기다린다 | `docs/product-specs/service.md` F9 | 수동 |
| KS-5 | 로그인이 필요한 화면(`/settings/*`, `/audit`, `/selftest`, `/password-change`)을 비로그인으로 열면 로그인 화면으로 간다 | 로그아웃 상태로 `/settings` 를 연다 | `docs/design-docs/decisions/013-kisa-security-screens-show-server-rules.md` | 수동 |

## 비밀번호

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| KS-6 | 새 비밀번호를 쓰면 규칙 8개가 지킴·어김으로 바뀌고, 어기거나 확인이 다르면 저장 버튼이 막힌다 | `/settings/password` 에서 `qwe12345` 등을 쳐 본다 | `src/lib/password.ts` | 수동 |
| KS-7 | 규칙 판정이 서버와 같다 | 화면이 통과시킨 값이 서버에서 400 이 되지 않는지, 화면이 막은 값이 서버에서도 400 인지 몇 개 대조한다 | `docs/design-docs/decisions/013-kisa-security-screens-show-server-rules.md` | 수동 |
| KS-8 | 현재 비밀번호 불일치, 직전 비밀번호 재사용은 서버 문구가 그대로 보인다 | 틀린 현재 비밀번호로, 같은 값으로 바꿔 본다 | `docs/design-docs/decisions/013-kisa-security-screens-show-server-rules.md` | 수동 |
| KS-9 | 가입 화면에도 같은 규칙이 보이고, 로그인 화면에는 규칙이 없다 | `/login` 의 두 탭을 본다 | `docs/product-specs/service.md` F9 | 수동 |

## 보안정책, 관리 IP, 계정

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| KS-10 | 보안정책 값이 범위를 벗어나면 그 칸에 오류가 나고 저장이 막힌다. 저장한 값은 새로고침해도 유지된다 | 연속 실패에 9 를 넣고, 3 으로 저장한 뒤 새로고침 | `docs/design-docs/decisions/013-kisa-security-screens-show-server-rules.md` | 수동 |
| KS-11 | 관리 IP 에 범위·와일드카드·형식 오류·중복은 서버를 부르기 전에 막힌다. 목록이 비어 있으면 처음 등록은 내 IP 만 된다 | `10.0.0.0/8`, 같은 IP 두 번, 내 IP 가 아닌 첫 IP 를 쳐 본다 | `docs/design-docs/decisions/013-kisa-security-screens-show-server-rules.md` | 수동 |
| KS-12 | 다른 IP 가 남아 있는 동안 내 IP 의 삭제 버튼이 막히고, 마지막 하나를 지우면 제한 없음이 된다 | IP 두 개를 등록하고 삭제를 눌러 본다 | `docs/product-specs/service.md` F9 | 수동 |
| KS-13 | viewer 계정을 만들고 나면 성공 문구에 비밀번호가 없고 입력칸이 비워진다. 중복 이메일은 서버 문구가 보인다 | 계정 만들기를 두 번 | `docs/product-specs/service.md` F9 | 수동 |

## 감사기록, 자체점검

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| KS-14 | 기간·사건 유형·행위자·결과 필터와 시각 정렬이 서버 쿼리로 나간다(화면에서 거르지 않는다) | 필터를 바꾸며 네트워크 탭의 `/api/audit` 쿼리를 본다 | `docs/product-specs/service.md` F9 | 수동 |
| KS-15 | 쪽을 넘겨도 행이 겹치지 않는다. 첫 쪽의 `X-Time-To` 를 다음 쪽 `to` 로 되돌려준다 | 2쪽을 열고 요청의 `to` 를 첫 쪽 응답의 `X-Time-To` 와 대조 | `docs/design-docs/decisions/007-server-pagination.md` | 수동 |
| KS-16 | 서버 offset 상한(10,000)을 넘는 쪽은 번호를 내지 않고 기간을 좁히라고 알린다 | 기록이 1만 건을 넘는 조직에서 마지막 쪽 번호를 본다 | `docs/design-docs/decisions/007-server-pagination.md` | 수동 |
| KS-17 | 자체점검 "지금 실행" 을 누르면 새 실행이 목록 맨 위에 생기고 고른 상태가 된다 | 지금 실행 | `docs/product-specs/service.md` F9 | 수동 |
| KS-18 | 무결성 항목이 FAIL 이면 그 행이 강조되고 변조를 의심하라는 안내가 뜬다. 자체시험 항목이 FAIL 이면 그 안내는 뜨지 않는다 | FAIL 응답으로 확인 | `docs/product-specs/service.md` F9 | 수동 |

## viewer

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| KS-19 | viewer 는 사이드바 PLATFORM 묶음(수집 알림 연동, 감사기록, 자체점검, 설정)을 못 본다 | viewer 로 로그인 | `docs/product-specs/service.md` F9 | 수동 |
| KS-20 | viewer 는 위협 확정·오탐, 사건 판단, 프로세스 종료 버튼을 못 보고 "조회 전용 계정입니다" 안내가 뜬다 | 알림이 있는 조직에서 viewer 로 대시보드, 사건 상세를 연다 | `docs/product-specs/service.md` F9 | 수동 |
| KS-21 | viewer 가 admin 전용 화면 주소를 직접 열면 서버의 403 문구가 보인다 | viewer 로 `/audit` 를 연다 | `docs/product-specs/service.md` F9 | 수동 |

## 확인 기록

2026-11-11, 로컬 백엔드(`localhost:8084`, api-service dev 머지본)에 헤드리스 Chrome 으로 붙여 확인했다. 확인용 계정은 회원가입 화면으로 만들었다.

- 확인함: KS-1(없는 계정으로만. 서버가 사유와 무관하게 401 하나라 틀린 비밀번호도 같다), 2, 3, 4(중복 로그인과 유휴 1분 종료 둘 다), 5, 6, 8, 9, 10, 11, 12, 13, 14, 15(2쪽 요청의 `to` 가 첫 쪽 응답의 `X-Time-To` 와 같다), 17, 19, 21.
- 확인하지 못함: KS-7(화면이 통과시킨 값은 서버도 받았고 화면이 막은 약한 값을 서버에 보내 본 적은 없다), KS-16(기록이 1만 건 미만), KS-18(서버가 FAIL 을 만들지 않아 응답을 바꿔 모양만 봤다), KS-20(확인한 조직에 알림이 없어 화면에서 못 봤다. 코드로만 확인했다).
