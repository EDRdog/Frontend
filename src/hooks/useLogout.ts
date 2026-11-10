import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { useAuthStore } from '@/store/auth'

/** 서버 세션을 지우고 로컬 토큰을 비운 뒤 로그인 화면으로 간다. */
export function useLogout() {
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()

  return async function logout() {
    try {
      await api.logout()
    } catch {
      // 서버 세션 삭제가 실패해도 로컬 토큰은 비워 로그아웃 상태로 만든다
    }
    clear()
    navigate('/login', { replace: true })
  }
}
