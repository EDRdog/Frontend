# 대응과 온보딩 (PRD: `docs/product-specs/service.md` F6, F7)

조치 실행과 결과 폴링, 설치 안내, 알림 설정. 왜 이렇게 정했는지는 `docs/design-docs/decisions/003`, `004`, `011`.

## 조치 실행

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| RES-1 | 조치가 `POST /api/alerts/:id/respond` 로 나간다 (responder 직접 호출이 아니다) | 네트워크 탭 확인 | `docs/design-docs/decisions/003-kill-through-api-service.md` | 수동 |
| RES-2 | 자동으로 쏘지 않는다. 사람이 확인해야 실행된다 | 알림이 와도 조치가 저절로 나가지 않는지 | `docs/product-specs/service.md` F6 | 수동 |
| RES-3 | 결과가 1초 간격으로 조회된다 | 조치 후 네트워크 탭 | `docs/design-docs/decisions/004-poll-kill-result.md` | 수동 |
| RES-4 | 40초가 지나면 스스로 멈추고 시간 초과로 본다 | 응답하지 않는 호스트에 조치 | `docs/design-docs/decisions/004-poll-kill-result.md` | 수동 |
| RES-5 | 화면을 떠나면 조회를 멈춘다 | 조치 후 다른 탭으로 이동, 네트워크 탭 확인 | `docs/design-docs/decisions/004-poll-kill-result.md` | 수동 |
| RES-6 | 4xx 는 재시도하지 않고 바로 멈춘다 | 남의 알림 id 로 조회 | `docs/design-docs/decisions/004-poll-kill-result.md` | 수동 |
| RES-7 | 502 같은 일시 오류는 3번까지 참는다 | 백엔드를 잠깐 내렸다 올린다 | `docs/design-docs/decisions/004-poll-kill-result.md` | 수동 |
| RES-8 | 조치 결과가 눈에 띄게 표시된다 | 실제로 종료시키고 화면 확인 | `docs/design-docs/decisions/004-poll-kill-result.md` | 수동 |
| RES-9 | 격리를 격리라고 표시하지 않는다 (구현이 없다) | CRITICAL 알림의 권장 조치 확인 | `docs/product-specs/service.md` F6 | 수동 |

## 온보딩

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| RES-10 | 설치 링크를 화면에서 조립하지 않고 서버가 준 것을 쓴다 | 네트워크 응답과 화면에 보이는 명령을 대조 | `docs/design-docs/decisions/011-no-server-rules-in-ui-text.md` | 수동 |
| RES-11 | enroll secret 을 화면에 보여주지 않는다 | `/onboarding` 전체 확인 | `docs/design-docs/failures/010-stale-onboarding-instructions.md` | 수동 |
| RES-12 | osquery·Zeek·Fleet 안내가 남아 있지 않다 | `/onboarding` 문구 확인 | `docs/design-docs/failures/010-stale-onboarding-instructions.md` | 수동 |
| RES-13 | OS 별 설치 명령과 경로가 맞다 | macOS 와 Windows 에서 실제로 따라 해 본다 | `docs/product-specs/service.md` F7 | 수동 |
| RES-14 | 등록 실패가 조용히 넘어가지 않고 원인이 보인다 | 틀린 값으로 저장을 시도 | `docs/design-docs/failures/003-api-key-401-mistaken-for-expiry.md` | 수동 |

## 알림 설정

| ID | 성립해야 할 것 | 검증 | 출처 | 상태 |
|---|---|---|---|---|
| RES-15 | 개인 Slack webhook 을 등록하고 테스트 발송할 수 있다 | `/onboarding` 에서 등록 후 테스트 | `docs/product-specs/service.md` F7 | 수동 |
| RES-16 | 내 기기를 등록해야 개인 webhook 으로 알림이 간다 | 기기 등록 후 알림 수신 확인 | Backend 의 `docs/requirements/alerting.md` ALR-1 | 수동 |
| RES-17 | 이미 다른 사람이 가져간 호스트는 등록이 거부된다 | 다른 계정으로 같은 호스트 등록 | Backend 의 `docs/requirements/alerting.md` ALR-5 | 수동 |
| RES-18 | 조직 공용 webhook 섹션이 없다 | `/onboarding` 확인 | `docs/design-docs/failures/010-stale-onboarding-instructions.md` | 수동 |
