export type PasswordRule = {
  label: string
  ok: boolean
  /** 규칙이 막는 예. 없으면 빈 문자열. */
  example: string
  /** 어겼을 때 입력칸 아래에 한 줄로 보여주는 말. */
  error: string
}

// 키보드 줄(숫자줄, 윗줄, 가운뎃줄, 아랫줄, 시프트 숫자줄)과 그 역방향.
const KEY_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '!@#$%^&*()'].flatMap((r) => [
  r,
  [...r].reverse().join(''),
])

/**
 * 비밀번호 규칙. 백엔드 AuthValidation.passwordError 와 같은 판정이다(ADR 013).
 * 안내용이다. 최종 판정은 서버가 하고, 직전 비밀번호와의 비교는 서버만 할 수 있다.
 */
export function passwordRules(password: string, email: string): PasswordRule[] {
  const lower = password.toLowerCase()
  const id = email.toLowerCase()
  const windows = Array.from({ length: Math.max(password.length - 2, 0) }, (_, i) =>
    lower.slice(i, i + 3),
  )
  return [
    { label: '9자 이상', ok: password.length >= 9, example: '', error: '9자 이상이어야 합니다.' },
    {
      label: '영문 대문자 1개 이상',
      ok: /[A-Z]/.test(password),
      example: '',
      error: '영문 대문자가 들어가야 합니다.',
    },
    {
      label: '영문 소문자 1개 이상',
      ok: /[a-z]/.test(password),
      example: '',
      error: '영문 소문자가 들어가야 합니다.',
    },
    {
      label: '숫자 1개 이상',
      ok: /[0-9]/.test(password),
      example: '',
      error: '숫자가 들어가야 합니다.',
    },
    {
      label: '특수문자 1개 이상',
      ok: /[^A-Za-z0-9]/.test(password),
      example: '',
      error: '특수문자가 들어가야 합니다.',
    },
    {
      label: '아이디(이메일)와 다름',
      ok: !id || (lower !== id && lower !== id.split('@')[0]),
      example: '',
      error: '아이디(이메일)와 같을 수 없습니다.',
    },
    {
      label: '같은 문자 3번 연속 없음',
      ok: !/(.)\1\1/.test(password),
      example: 'aaa, 111',
      error: '같은 문자를 3번 연속 쓸 수 없습니다.',
    },
    {
      label: '키보드 순서 3자 이상 없음',
      ok: !windows.some((w) => KEY_ROWS.some((row) => row.includes(w))),
      example: 'qwe, 123',
      error: '키보드 순서대로 이어진 3자(qwe, 123 등)는 쓸 수 없습니다.',
    },
  ]
}
