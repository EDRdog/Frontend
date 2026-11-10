import { create } from 'zustand'
import type { AuthResponse } from '@/api/types'

const STORAGE_KEY = 'edrdog.auth'

export type AuthUser = Omit<AuthResponse, 'token'>

type AuthState = {
  token: string | null
  user: AuthUser | null
  /** 서버가 세션을 끝낸 직후 true(401). 로그인 화면이 안내를 띄우고 내린다. 직접 로그아웃은 해당 없다. */
  sessionEnded: boolean
  signIn: (res: AuthResponse) => void
  clear: () => void
  /** 서버가 세션을 끝냈다(유휴 종료, 다른 곳 로그인, 만료). 로그인한 상태였을 때만 의미가 있다. */
  endSession: () => void
  /** 서버가 password_change_required 를 줬다. 로그인 응답을 놓친 경로(새로고침 전 세션)도 여기서 잡힌다. */
  requirePasswordChange: () => void
  passwordChanged: () => void
}

/** 새로고침해도 로그인이 유지되도록 localStorage 에서 복원한다. 값이 깨져 있으면 로그아웃 상태로 시작. */
function restore(): { token: string | null; user: AuthUser | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    const parsed = JSON.parse(raw) as { token: string; user: AuthUser }
    return { token: parsed.token, user: parsed.user }
  } catch {
    return { token: null, user: null }
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  /** 비밀번호 변경 필요 여부만 바꿔 저장한다. */
  function setMustChange(mustChangePassword: boolean) {
    const { token, user } = get()
    if (!token || !user || user.mustChangePassword === mustChangePassword) return
    const next = { ...user, mustChangePassword }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: next }))
    set({ user: next })
  }

  return {
    ...restore(),
    sessionEnded: false,
    signIn: ({ token, ...user }) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
      set({ token, user, sessionEnded: false })
    },
    clear: () => {
      localStorage.removeItem(STORAGE_KEY)
      set({ token: null, user: null })
    },
    endSession: () => {
      if (!get().token) return
      localStorage.removeItem(STORAGE_KEY)
      set({ token: null, user: null, sessionEnded: true })
    },
    requirePasswordChange: () => setMustChange(true),
    passwordChanged: () => setMustChange(false),
  }
})
