import type { PasswordRule } from '@/lib/password'

type PasswordRulesProps = {
  rules: PasswordRule[]
  /** 입력이 시작되면 점이 지킴(초록)과 어김(빨강)으로 바뀐다. 비어 있으면 모두 빈 점이다. */
  started: boolean
  /** 직전 비밀번호와의 비교는 서버만 할 수 있어 마지막 줄로 알린다. 가입·계정 생성에는 없다. */
  showReuse?: boolean
  twoColumns?: boolean
}

/** 점 하나가 규칙 하나의 상태다. 색만으로 읽히지 않도록 어긴 규칙은 글자도 진하게 한다. */
function PasswordRules({
  rules,
  started,
  showReuse = false,
  twoColumns = false,
}: PasswordRulesProps) {
  return (
    <ul
      className={`m-0 grid list-none gap-[10px] p-0 ${twoColumns ? 'sm:grid-cols-2 sm:gap-x-[20px]' : ''}`}
    >
      {rules.map((rule) => {
        const state = !started ? 'idle' : rule.ok ? 'ok' : 'bad'
        return (
          <li
            key={rule.label}
            className={`grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-[10px] text-[12.5px] ${
              state === 'bad' ? 'text-ink' : 'text-ink-2'
            }`}
          >
            <i
              aria-hidden
              className={`h-[8px] w-[8px] rounded-full ${
                state === 'ok'
                  ? 'bg-good'
                  : state === 'bad'
                    ? 'bg-crit'
                    : 'border-[1.5px] border-line bg-transparent'
              }`}
            />
            <span>{rule.label}</span>
            <small
              className={`font-mono text-[11px] ${state === 'bad' ? 'text-crit' : 'text-faint'}`}
            >
              {rule.example}
            </small>
          </li>
        )
      })}
      {showReuse && (
        <li className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-[10px] text-[12.5px] text-mid">
          <i aria-hidden className="h-[8px] w-[8px] rounded-full border-[1.5px] border-line" />
          <span>직전 비밀번호와 다름</span>
          <small className="text-[11px] text-faint">저장할 때 확인</small>
        </li>
      )}
    </ul>
  )
}

export default PasswordRules
