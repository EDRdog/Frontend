import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const sessionEnded = useAuthStore((s) => s.sessionEnded)
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword === true)

  // 라우트가 바뀌면 드로어를 닫는다
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // ESC 키로 드로어 닫기 (열려 있을 때만 리스너 등록)
  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  // 드로어가 열려 있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (!menuOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  // 서버가 세션을 끝냈다(유휴 종료, 다른 곳 로그인, 만료). 데모로 조용히 떨어지지 않고 로그인 화면으로 보낸다.
  if (sessionEnded) return <Navigate to="/login" state={{ from: pathname }} replace />
  // 기본 비밀번호를 바꾸기 전에는 서버가 다른 API 를 403 으로 막는다. 이 셸 안의 어느 화면도 쓸 수 없다.
  if (mustChangePassword) return <Navigate to="/password-change" replace />

  return (
    <div className="flex min-h-screen bg-bg font-sans text-ink transition-colors">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenuOpen={() => setMenuOpen(true)} />
        {/* 초광폭에서 표 열 사이가 과하게 벌어지지 않도록 본문 폭을 제한한다. 상단바도 같은 폭으로 맞춘다. */}
        <div className="w-full max-w-[1600px] mx-auto px-[16px] pt-[18px] pb-[32px] lg:px-[28px] lg:pt-[26px] lg:pb-[40px]">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AppLayout
