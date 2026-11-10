import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '@/api'
import Card from '@/components/ui/Card'
import CardHead from '@/components/ui/CardHead'
import Field, { Msg } from '@/components/ui/Field'
import PasswordRules from '@/components/ui/PasswordRules'
import { inputClass, primaryButton } from '@/components/ui/styles'
import { passwordRules } from '@/lib/password'
import { useAuthStore } from '@/store/auth'

type PasswordChangeProps = {
  email: string
  /** settings: 설정 탭(오른쪽에 규칙 패널). force: 기본 비밀번호 강제 변경 화면(카드 하나). */
  variant: 'settings' | 'force'
}

/**
 * 비밀번호 변경 폼. 규칙은 안내용이고 최종 판정은 서버가 한다(ADR 013).
 * 서버가 400 으로 돌려주는 이유(현재 비밀번호 불일치, 직전 비밀번호 재사용 등)는 그대로 보여준다.
 */
function PasswordChange({ email, variant }: PasswordChangeProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const passwordChanged = useAuthStore((s) => s.passwordChanged)

  const rules = passwordRules(next, email)
  const broken = rules.filter((r) => !r.ok).length
  const matched = confirm !== '' && confirm === next
  const canSubmit = current !== '' && next !== '' && broken === 0 && matched && !pending

  async function submit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setDone(false)
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
      // 강제 변경이었다면 여기서 가드가 풀리고 화면이 다음으로 넘어간다.
      passwordChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  const summary = error ? (
    <Msg tone="bad">{error}</Msg>
  ) : done ? (
    <Msg tone="ok">비밀번호를 바꿨습니다.</Msg>
  ) : next === '' ? (
    <Msg />
  ) : broken > 0 ? (
    <Msg tone="bad">{`규칙 ${rules.length}개 중 ${broken}개를 지키지 않았습니다.`}</Msg>
  ) : (
    <Msg tone="ok">규칙을 모두 지켰습니다.</Msg>
  )

  const form = (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-[18px] sm:grid-cols-2 sm:gap-x-[16px]">
        <Field
          label={variant === 'force' ? '기본 비밀번호' : '현재 비밀번호'}
          className={variant === 'force' ? 'sm:col-span-2' : ''}
        >
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>
        {variant === 'settings' && <div className="hidden sm:block" />}
        <Field label="새 비밀번호">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            aria-invalid={next !== '' && broken > 0}
            className={inputClass}
          />
        </Field>
        <Field
          label="새 비밀번호 확인"
          message={
            <Msg tone={confirm === '' ? 'mid' : matched ? 'ok' : 'bad'}>
              {confirm === ''
                ? ''
                : matched
                  ? '새 비밀번호와 같습니다.'
                  : '새 비밀번호와 다릅니다.'}
            </Msg>
          }
        >
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={confirm !== '' && !matched}
            className={inputClass}
          />
        </Field>
        {variant === 'force' && (
          <div className="rounded-md bg-panel px-[16px] py-[14px] sm:col-span-2">
            <PasswordRules rules={rules} started={next !== ''} showReuse twoColumns />
          </div>
        )}
      </div>
      <div className="mt-[22px] flex items-center gap-[12px] border-t border-line-2 pt-[16px]">
        {summary}
        <button type="submit" disabled={!canSubmit} className={`${primaryButton} ml-auto`}>
          {pending ? '처리 중' : '비밀번호 바꾸기'}
        </button>
      </div>
    </form>
  )

  if (variant === 'force') return form

  return (
    <div className="grid max-w-[1060px] items-start gap-[16px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHead title="비밀번호 변경" />
        <div className="px-[16px] py-[18px] sm:px-[20px]">{form}</div>
      </Card>
      <Card>
        <CardHead title="비밀번호 규칙" />
        <div className="px-[16px] py-[18px] sm:px-[20px]">
          <PasswordRules rules={rules} started={next !== ''} showReuse />
        </div>
      </Card>
    </div>
  )
}

export default PasswordChange
