import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { ApiError } from '@/api/client'
import LogoMark from '@/components/ui/LogoMark'
import PasswordRules from '@/components/ui/PasswordRules'
import { passwordRules } from '@/lib/password'
import { useAuthStore } from '@/store/auth'

type Mode = 'login' | 'signup'

const inputClass =
  'h-[40px] px-[13px] rounded-sm border border-line bg-panel-2 text-ink text-[13.5px] font-sans outline-none focus:border-accent'

/** 서버는 로그인 실패를 사유와 무관하게 401 하나로 준다. 계정 존재 여부가 새지 않도록 화면도 한 문장만 쓴다. */
const LOGIN_FAILED = '로그인하지 못했습니다. 이메일과 비밀번호를 확인하세요.'
const SESSION_ENDED = '세션이 종료되었습니다. 다시 로그인하세요.'

function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  // 세션이 끝나 이 화면으로 왔으면 안내를 띄우고 신호를 내린다. 안 내리면 데모 화면으로 나갈 때마다 여기로 돌아온다.
  const [error, setError] = useState<string | null>(() =>
    useAuthStore.getState().sessionEnded ? SESSION_ENDED : null,
  )
  const [pending, setPending] = useState(false)

  useEffect(() => {
    useAuthStore.setState({ sessionEnded: false })
  }, [])

  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res =
        mode === 'login'
          ? await api.login(email, password)
          : await api.signup(email, password, orgName.trim() || undefined)
      signIn(res)
      navigate(res.mustChangePassword ? '/password-change' : from, { replace: true })
    } catch (err) {
      setError(
        mode === 'login' && err instanceof ApiError && err.status === 401
          ? LOGIN_FAILED
          : (err as Error).message,
      )
    } finally {
      setPending(false)
    }
  }

  // 가입할 때만 규칙을 보여준다. 로그인에서는 어떤 비밀번호가 맞는지 알려줄 이유가 없다.
  const rules = passwordRules(password, email)
  const weak = mode === 'signup' && rules.some((r) => !r.ok)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-bg font-sans text-ink flex items-center justify-center px-[20px]">
      <div className="relative w-full max-w-[380px] bg-surface border border-line rounded-md px-[28px] py-[30px]">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="닫기"
          className="absolute top-[16px] right-[16px] w-[30px] h-[30px] flex items-center justify-center rounded-sm text-faint hover:text-ink-2 hover:bg-panel cursor-pointer transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
        <Link to="/" className="flex items-center gap-[10px] mb-[22px]">
          <LogoMark size={28} />
          <span className="text-[17px] font-[750] tracking-[-0.02em] text-ink">EDRdog</span>
        </Link>

        <div className="flex gap-[6px] mb-[20px]">
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 h-[34px] rounded-sm text-[12.5px] font-semibold cursor-pointer border transition-colors ${
                mode === m
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface text-mid border-line hover:text-ink-2'
              }`}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-[12px]">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] text-faint">이메일</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] text-faint">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={inputClass}
            />
          </label>

          {mode === 'signup' && (
            <div className="rounded-sm bg-panel px-[14px] py-[12px]">
              <PasswordRules rules={rules} started={password !== ''} />
            </div>
          )}

          {mode === 'signup' && (
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] text-faint">조직명 (선택)</span>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className={inputClass}
              />
            </label>
          )}

          {mode === 'login' && !error && (
            <p className="m-0 text-[12px] text-mid">연속으로 틀리면 계정이 일시 잠깁니다.</p>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-sm bg-[var(--crit-wash)] px-[12px] py-[10px] text-[12.5px] text-ink"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending || weak}
            className="mt-[6px] h-[40px] rounded-sm bg-accent text-white text-[13.5px] font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-default"
          >
            {pending ? '처리 중' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
