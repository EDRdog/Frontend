import { Navigate } from 'react-router-dom'
import Card from '@/components/ui/Card'
import LogoMark from '@/components/ui/LogoMark'
import PasswordChange from '@/components/PasswordChange'
import { ghostButton } from '@/components/ui/styles'
import { useLogout } from '@/hooks/useLogout'
import { useAuthStore } from '@/store/auth'

/**
 * 기본 비밀번호로 로그인한 계정이 바꾸기 전까지 머무는 화면. 셸(사이드바, 상단바) 없이 이 화면만 있다.
 * 서버가 변경·로그아웃·내 정보 말고는 403 을 주므로 다른 화면은 어차피 못 쓴다.
 */
function ForcePassword() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  // 바꿀 필요가 없거나, 방금 바꿔서 가드가 풀렸다.
  if (!user?.mustChangePassword) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex min-h-screen flex-col bg-bg font-sans text-ink">
      <header className="flex h-[64px] items-center gap-[12px] border-b border-line-2 bg-surface px-[16px] sm:px-[28px]">
        <span className="flex items-center gap-[10px]">
          <LogoMark size={28} />
          <span className="text-[17px] font-[750] tracking-[-0.02em] text-ink">EDRdog</span>
        </span>
        <span className="ml-auto min-w-0 truncate text-[12.5px] text-mid">
          <b className="font-semibold text-ink">{user.email}</b> 로 로그인함
        </span>
        <button
          type="button"
          onClick={logout}
          className={`${ghostButton} !h-[30px] !px-[10px] text-[12px]`}
        >
          로그아웃
        </button>
      </header>
      <div className="flex flex-1 justify-center px-[16px] pb-[40px] pt-[40px] sm:pt-[56px]">
        <Card className="h-fit w-full max-w-[620px] px-[20px] py-[28px] sm:px-[32px]">
          <span className="text-[12px] font-semibold text-high">기본 비밀번호 변경 필요</span>
          <h1 className="m-0 mt-[10px] text-[22px] font-bold tracking-[-0.02em] text-ink">
            비밀번호를 바꿔야 계속할 수 있습니다
          </h1>
          <p className="m-0 mt-[6px] max-w-[52ch] text-[13.5px] text-mid">
            처음 받은 기본 비밀번호로 로그인했습니다. 새 비밀번호를 정하기 전에는 다른 화면으로
            이동할 수 없습니다.
          </p>
          <div className="mt-[24px]">
            <PasswordChange email={user.email} variant="force" />
          </div>
        </Card>
      </div>
    </div>
  )
}

export default ForcePassword
