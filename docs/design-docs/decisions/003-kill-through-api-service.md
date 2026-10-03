# 003. kill 을 responder 직접 호출에서 api-service 경유로 바꾼다

- 날짜: 2026-07-25
- 상태: 채택

## 배경
프론트가 `/api/responder/kill` 을 직접 불렀다. responder-service 에는 앱 레벨 인증이 없다.

## 결정
`POST /api/alerts/:id/respond` 로 바꾼다. api-service 가 Bearer 인증과 tenant 소유 확인을 한 뒤 responder 로 프록시한다.

responder 직접 호출용 배관(`responderRequest`, vite 의 `/responder-api` 프록시, `.env` 의 responder 변수)은 전부 지웠다.

## 근거
> api-service 가 Bearer 인증 + tenant 소유 확인 후 responder 로 프록시하므로, 아무나 아무 호스트를 kill 하는 문제를 막는다.

인증이 없는 서비스를 브라우저가 직접 부르면, 그 엔드포인트를 아는 사람 누구나 남의 호스트 프로세스를 죽일 수 있다.

## 결과/영향
- 대응 경로가 하나로 모였다. 권한 검사를 한 군데서만 한다.
- 쓰지 않게 된 배관을 남기지 않고 같이 지웠다. 남겨 두면 다음 사람이 살아 있는 경로로 읽는다.

## 관련
- [004](004-poll-kill-result.md)
