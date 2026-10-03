# EDRdog Frontend

EDR 대시보드 프론트엔드. 백엔드(`EDRdog/Backend`)의 조회 API 를 읽어 알림·이벤트·호스트·인시던트를 보여주고, 확인을 거쳐 프로세스 종료를 지시한다.

## 명령어

- 개발 서버: `npm run dev` (http://localhost:5173)
- 검증(lint + 타입체크 + 빌드 + 문서): `scripts/check.sh` ← 작업을 끝내기 전에 반드시 실행
- 빌드: `npm run build` (`tsc -b && vite build`)
- 린트: `npm run lint` (oxlint)
- 포맷: `npm run format` (prettier)

**테스트 러너가 없다.** 이 레포의 검증은 `tsc` 타입체크와 빌드 성공이 전부다. 그래서 `check.sh` 가 빌드까지 돌린다. 수용 기준(`docs/requirements/`)의 상태 칸이 `수동` 인 항목이 많은 것도 같은 이유다.

## 금지사항

- **아이콘 라이브러리와 이모지를 쓰지 않는다.** 디자인 시안에 포함된 인라인 SVG 는 그대로 두고 필요하면 고친다.
- **`main` 으로 직접 PR 하지 않는다.** 작업은 `dev` 에서 시작하고, `main` 은 배포용이다. 진행 순서는 이슈 → 브랜치 → PR.
- **커밋과 푸시는 사용자가 요청할 때만 한다.**
- **필요해지기 전에 미리 만들지 않는다.** 과설계 금지.
- **번들을 키우는 의존성을 말없이 추가하지 않는다.** Vercel Hobby 플랜 한도 안에서 돌아가야 한다. 지금도 echarts 청크가 1.1MB(gzip 377KB)다.
- 위험 명령(`rm -rf`, `git push --force`, `git reset --hard`)은 직접 실행하지 말고 사용자에게 요청. `scripts/guard.sh` 가 막는다.

## 규칙

- 브랜치명은 `feat/#이슈번호-설명` (예: `feat/#12-dashboard-layout`). 이슈명·PR명·브랜치명을 비슷하게 맞춘다.
- 경로 별칭은 `@/` → `src/`.
- 코드는 간단하고 이해하기 쉽게 쓴다.

## 문서 지도

- 구조, 레이어, 의존 방향: `ARCHITECTURE.md`
- 무엇을, 왜 (PRD): `docs/product-specs/`
- 검증 가능한 수용 기준 (ERD, Engineering Requirements Document): `docs/requirements/`
- 왜 이렇게 정했나 (ADR): `docs/design-docs/decisions/`
- 무엇이 깨졌고 왜 (실패 기록): `docs/design-docs/failures/`
- 진행 중인 작업 계획: `docs/exec-plans/active/`
- 끝난 작업 기록: `docs/exec-plans/completed/`
- 기술부채: `docs/exec-plans/tech-debt.md`
- 백엔드 API 계약: `EDRdog/Backend` 의 `docs/product-specs/service.md` F7 과 `ARCHITECTURE.md`

## 작업 방식

- 여러 단계 작업은 `docs/exec-plans/active/`에 계획을 먼저 쓰고, 끝나면 `completed/`로 옮긴다.
- 같은 실수가 두 번 나오면 이 문서에 규칙을 적고, 가능하면 `scripts/check.sh`에 검사로 추가한다.
- 결정(설계, 라이브러리 선택, 버린 대안)은 묻지 않고 ADR 로 남긴다. 실패는 실패 기록으로 남긴다.
- 구현, 배포, 삭제로 상태가 바뀌면 같은 PR 에서 `docs/requirements/`(기준, 검증, 상태 칸)와 `docs/exec-plans/tech-debt.md` 를 고친다.
- 백엔드 응답 형태에 기대는 코드를 고칠 때는 백엔드의 수용 기준을 먼저 본다. 응답이 바뀌면 여기부터 깨진다.
