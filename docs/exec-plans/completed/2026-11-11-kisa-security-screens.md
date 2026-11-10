# KISA 보안 기능 관리 화면 (Frontend 이슈 #102)

백엔드가 dev 에 머지한 보안 기능(비밀번호 규칙, 보안정책, 관리 IP, viewer 계정, 감사기록, 자체점검, 강제 변경)을 다루는 화면을 만들었다. 시안은 `docs/design-docs/previews/kisa-security.html`, 사용자가 승인했다.

## 한 것
- 화면: `/settings/{password,policy,ip,accounts}`, `/audit`, `/selftest`, `/password-change`. 로그인 화면에 실패 문구와 가입 규칙.
- 인증 흐름: `auth` 스토어에 `role`, `mustChangePassword`, `sessionEnded`. 401 은 로그인 화면으로, 403 `password_change_required` 는 강제 변경 화면으로. `RequireAuth` 를 데모가 없는 화면에 배선.
- viewer: PLATFORM 메뉴와 대응·판단 버튼 숨김. 서버도 403 이라 숨기기만 했다.
- 문서: ADR 013(011 의 예외), `docs/requirements/security.md`, PRD F9, `ARCHITECTURE.md`, 기술부채.

## 시안과 다르게 한 것
- 색, 모서리, 그림자는 시안(소프트 카드, 미드나잇 토큰)이 아니라 지금 앱의 토큰(`src/index.css`)을 쓴다. 시안 토큰은 아직 앱에 반영되지 않았고, 이 화면들만 다른 모양이면 어긋난다. 토큰이 바뀌면 이 화면들도 같이 따라간다.
- 보안정책 잠금 시간 범위는 서버 값(5~1440분)을 따랐다. 시안은 "5분 이상".
- "마지막 변경" 표시는 API 에 값이 없어 뺐다(기술부채).
- 자체점검의 "점검 항목 상세" 에 들어 있던 해시 `<code>` 서식은 쓰지 않는다. 서버 detail 은 평문이라 쪼갤 수 없다.
- 자체점검의 변조 의심 안내는 무결성 항목이 FAIL 일 때만 띄운다. 자체시험 FAIL 은 기준값과 무관하다.
- 감사기록 "직접 지정" 은 시안에 입력칸이 없어 `datetime-local` 두 칸을 열었다.

## 확인
`docs/requirements/security.md` 의 확인 기록.
