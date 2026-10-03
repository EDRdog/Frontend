#!/usr/bin/env bash
# lint + 타입체크 + 빌드 + 문서를 한 번에 돌린다. 에이전트와 사람이 같은 명령을 쓴다.
set -euo pipefail
cd "$(dirname "$0")/.."

# 아이콘 라이브러리를 들이지 않는다는 규칙을 실제로 지키는지 본다(ADR 012).
# 글로 적어 두기만 하면 다음 설치 때 조용히 깨진다.
no_icon_library() {
  local found
  found=$(node -e '
    const p = require("./package.json");
    const deps = {...p.dependencies, ...p.devDependencies};
    const banned = ["lucide", "react-icons", "heroicons", "@fortawesome", "feather-icons", "phosphor"];
    const hit = Object.keys(deps).filter(d => banned.some(b => d.includes(b)));
    process.stdout.write(hit.join(" "));
  ')
  if [ -n "$found" ]; then
    echo "아이콘 라이브러리가 들어왔다: $found (docs/design-docs/decisions/012-no-icon-library.md)" >&2
    return 1
  fi
}

# echarts 를 쓰는 화면이 별도 청크로 떨어지는지 본다(ADR 001).
# lazy 를 걷어내도 빌드는 성공해서, 확인하지 않으면 첫 화면이 조용히 무거워진다.
echarts_pages_are_lazy() {
  local missing=""
  for chunk in ThreatMap Intelligence Lookup; do
    ls dist/assets/"$chunk"-*.js >/dev/null 2>&1 || missing="$missing $chunk"
  done
  if [ -n "$missing" ]; then
    echo "별도 청크로 안 떨어진 화면:$missing (docs/design-docs/decisions/001-lazy-load-echarts-pages.md)" >&2
    return 1
  fi
}

# lint
npm run lint

# 타입체크 + 빌드. 이 레포에는 테스트 러너가 없어서 tsc 가 사실상의 검증이다.
npm run build

# 빌드 결과와 의존성에 거는 검사
no_icon_library
echarts_pages_are_lazy

# 문서 (ERD 상태 칸, 테스트 참조)
scripts/check-docs.sh
