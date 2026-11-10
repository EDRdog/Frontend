import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '@/api'
import Card from '@/components/ui/Card'
import CardHead from '@/components/ui/CardHead'
import Field, { Msg } from '@/components/ui/Field'
import { inputClass, primaryButton } from '@/components/ui/styles'
import { passwordRules } from '@/lib/password'

/** 형식의 최종 판정은 서버가 한다(ADR 013). */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function AccountsTab() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const rules = passwordRules(password, email.trim())
  const firstBroken = rules.find((r) => !r.ok)
  const canSubmit = password !== '' && !firstBroken && !pending

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL.test(trimmed)) {
      setEmailError('이메일 형식이 아닙니다.')
      return
    }
    setEmailError(null)
    setError(null)
    setCreated(null)
    setPending(true)
    try {
      const user = await api.createViewer(trimmed, password)
      // 응답에 비밀번호가 없으므로 성공 문구에도 싣지 않는다.
      setCreated(user.email)
      setEmail('')
      setPassword('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid max-w-[1060px] items-start gap-[16px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHead title="조회 계정 만들기" meta="같은 조직, 역할 viewer" />
        <form onSubmit={submit} noValidate className="px-[16px] py-[18px] sm:px-[20px]">
          <div className="grid gap-[18px] sm:grid-cols-2 sm:gap-x-[16px]">
            <Field label="이메일" message={<Msg tone="bad">{emailError}</Msg>}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                aria-invalid={emailError !== null}
                className={inputClass}
              />
            </Field>
            <Field
              label="초기 비밀번호"
              message={
                <Msg tone={password === '' ? 'mid' : firstBroken ? 'bad' : 'ok'}>
                  {password === ''
                    ? ''
                    : firstBroken
                      ? firstBroken.error
                      : '비밀번호 규칙을 모두 지켰습니다.'}
                </Msg>
              }
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={password !== '' && firstBroken !== undefined}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="m-0 mt-[6px] text-[12px] leading-[1.55] text-mid">
            초기 비밀번호도 비밀번호 규칙을 따릅니다. 만든 뒤에는 다시 보여주지 않으니 본인에게 따로
            전달하세요.
          </p>
          {created && (
            <div className="mt-[16px] rounded-sm border-l-2 border-good bg-panel px-[14px] py-[12px] text-[12.5px] leading-[1.6] text-mid">
              <strong className="mb-[2px] block text-[13px] font-semibold text-ink">
                계정을 만들었습니다
              </strong>
              {created} 는 viewer 로 로그인할 수 있습니다.
            </div>
          )}
          <div className="mt-[22px] flex items-center gap-[12px] border-t border-line-2 pt-[16px]">
            {error && <Msg tone="bad">{error}</Msg>}
            <button type="submit" disabled={!canSubmit} className={`${primaryButton} ml-auto`}>
              {pending ? '처리 중' : '계정 만들기'}
            </button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHead title="viewer 가 할 수 있는 것" />
        <div className="px-[16px] py-[18px] sm:px-[20px]">
          <div className="mb-[8px] text-[11.5px] font-semibold text-faint">볼 수 있음</div>
          <ul className="m-0 grid list-none gap-[12px] p-0">
            <Capability>대시보드, 위협, 사건, 엔드포인트, 수집 로그, 분석 화면</Capability>
          </ul>
          <div className="mb-[8px] mt-[18px] text-[11.5px] font-semibold text-faint">
            할 수 없음
          </div>
          <ul className="m-0 grid list-none gap-[12px] p-0">
            <Capability>프로세스 종료 같은 대응</Capability>
            <Capability>위협·사건 판단(확정, 오탐)</Capability>
            <Capability>연동·보안정책·관리 IP 설정, 계정 만들기</Capability>
            <Capability>감사기록과 자체점검 보기</Capability>
          </ul>
        </div>
      </Card>
    </div>
  )
}

function Capability({ children }: { children: string }) {
  return (
    <li className="border-l-2 border-line pl-[12px] text-[12.5px] leading-[1.55] text-mid">
      {children}
    </li>
  )
}

export default AccountsTab
