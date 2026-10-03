# 010. 온보딩 안내가 실제와 어긋난 채로 계속 남아 있었다

## 증상
온보딩이 osquery 설치, flags 전문, 인증서 배치, Zeek 안내, Fleet 등록을 설명하고 있었다. 백엔드에는 Fleet 이 없어 `fleetctl` 안내는 따라 할 수 없었다.

enroll secret 발급 버튼도 있었는데 그 값은 쓰이지 않았다.

## 원인
백엔드가 자체 에이전트로 전환했는데 화면 안내가 따라가지 않았다. 안내는 코드가 아니라 글이라 빌드가 깨지지 않는다. **아무도 틀렸다고 알려주지 않는다.**

enroll secret 쪽은 더 나빴다. 설치 링크를 만든 이유가 키를 사람 손에 쥐여 주지 않으려는 것인데, 화면이 그 위험을 다시 만들고 있었다.

## 해결
온보딩을 자체 에이전트 설치 링크 방식으로 전면 교체했다. osquery·Zeek·Fleet 안내와 enroll secret 섹션을 지웠다.

## 재발 방지
**안내 문구는 백엔드 변경의 영향 범위에 포함시킨다.** 백엔드 수집 방식이나 설치 절차가 바뀌면 온보딩을 같이 본다.

쓰지 않게 된 섹션은 딸린 API·타입·데모·헬퍼까지 같이 지운다. 남겨 두면 다음 사람이 살아 있는 기능으로 읽는다.

## 관련
- `docs/design-docs/decisions/011-no-server-rules-in-ui-text.md`, Backend 의 `docs/design-docs/decisions/008-own-go-agent.md`
