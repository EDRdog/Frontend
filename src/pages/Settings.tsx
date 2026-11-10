import { Navigate, NavLink, useParams } from 'react-router-dom'
import PasswordChange from '@/components/PasswordChange'
import { useAuthStore } from '@/store/auth'
import AccountsTab from './settings/AccountsTab'
import IpTab from './settings/IpTab'
import PolicyTab from './settings/PolicyTab'

const TABS = [
  { id: 'password', label: '비밀번호 변경' },
  { id: 'policy', label: '보안정책' },
  { id: 'ip', label: '관리 IP' },
  { id: 'accounts', label: '계정' },
] as const

function Settings() {
  const { tab } = useParams()
  const email = useAuthStore((s) => s.user?.email ?? '')

  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/settings/password" replace />

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <div className="text-[18px] sm:text-[20px] font-bold text-ink tracking-[-0.01em]">설정</div>
        <div className="mt-[6px] text-[13px] text-faint">
          내 비밀번호와 조직의 접속 보안을 관리합니다.
        </div>
      </div>

      <div
        role="tablist"
        aria-label="설정 항목"
        className="inline-flex max-w-full self-start overflow-x-auto rounded-sm border border-line-2 bg-surface p-[3px]"
      >
        {TABS.map((t) => (
          <NavLink
            key={t.id}
            to={`/settings/${t.id}`}
            role="tab"
            aria-selected={t.id === tab}
            className={`h-[32px] whitespace-nowrap rounded-xs px-[16px] text-[13px] font-semibold leading-[32px] transition-colors ${
              t.id === tab
                ? '!bg-panel !text-ink shadow-[inset_0_0_0_1px_var(--line)]'
                : '!text-mid hover:!text-ink-2'
            }`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === 'password' && <PasswordChange email={email} variant="settings" />}
        {tab === 'policy' && <PolicyTab />}
        {tab === 'ip' && <IpTab />}
        {tab === 'accounts' && <AccountsTab />}
      </div>
    </div>
  )
}

export default Settings
