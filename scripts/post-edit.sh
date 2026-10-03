#!/usr/bin/env bash
# PostToolUse(Edit|Write) 훅: 수정된 파일을 포맷하고 린트한다.
# 린트가 실패하면 exit 2로 에러를 Claude에게 돌려줘 바로 고치게 한다.
file=$(jq -r '.tool_input.file_path // empty')
[ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.css)
    npx prettier --write "$file" >/dev/null
    npx oxlint "$file" >&2 || exit 2
    ;;
  *) ;;
esac
exit 0
