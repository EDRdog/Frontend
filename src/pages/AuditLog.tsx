import { useEffect, useRef, useState } from 'react'
import { api } from '@/api'
import type { AuditRecord } from '@/api/types'
import AsyncState from '@/components/ui/AsyncState'
import Card from '@/components/ui/Card'
import CardHead from '@/components/ui/CardHead'
import ScrollArea from '@/components/ui/ScrollArea'
import { ghostButton, inputClass, secondaryButton } from '@/components/ui/styles'
import { useApi } from '@/hooks/useApi'
import { shortTime } from '@/lib/format'
import { useRefreshStore } from '@/store/refresh'

const PAGE_SIZE = 20
/** 서버 offset 상한(10,000)을 넘는 쪽은 400 이다. 그 앞까지만 쪽 번호를 낸다. */
const MAX_PAGES = 500
const HOUR = 3_600_000

const RANGES = [
  { id: '1h', label: '1시간', hours: 1 },
  { id: '24h', label: '24시간', hours: 24 },
  { id: '7d', label: '7일', hours: 168 },
  { id: '30d', label: '30일', hours: 720 },
  { id: 'custom', label: '직접 지정', hours: null },
] as const

type RangeId = (typeof RANGES)[number]['id']

const RESULTS = [
  { id: '', label: '전체' },
  { id: 'success', label: '성공' },
  { id: 'failure', label: '실패' },
] as const

/** 사건 유형 한글 이름. 에이전트가 새 유형을 보낼 수 있어 없는 유형은 코드 그대로 쓴다. */
const TYPE_LABELS: Record<string, string> = {
  login_success: '로그인',
  login_failure: '로그인 실패',
  logout: '로그아웃',
  signup: '회원가입',
  auth_lockout: '계정 잠금',
  password_change: '비밀번호 변경',
  session_lock: '세션 잠금',
  session_terminate: '세션 종료',
  admin_ip_block: '관리 IP 차단',
  admin_ip_change: '관리 IP 변경',
  access_denied: '권한 거부',
  account_create: '계정 생성',
  security_policy_change: '보안정책 변경',
  kill_request: '대응 요청',
  command_result: '명령 결과',
  self_test_result: '서버 자체시험',
  integrity_check_result: '서버 무결성 검증',
  security_check: '에이전트 자체시험',
  integrity_check: '에이전트 무결성 검증',
  agent_enroll: '에이전트 등록',
  agent_start: '에이전트 시작',
  agent_stop: '에이전트 중지',
}

const TYPE_GROUPS: { label: string; types: string[] }[] = [
  {
    label: '인증',
    types: [
      'login_success',
      'login_failure',
      'logout',
      'signup',
      'auth_lockout',
      'password_change',
      'session_lock',
      'session_terminate',
    ],
  },
  {
    label: '접근통제',
    types: [
      'admin_ip_block',
      'admin_ip_change',
      'access_denied',
      'account_create',
      'security_policy_change',
    ],
  },
  { label: '대응', types: ['kill_request', 'command_result'] },
  {
    label: '점검',
    types: ['self_test_result', 'integrity_check_result', 'security_check', 'integrity_check'],
  },
  { label: '에이전트', types: ['agent_enroll', 'agent_start', 'agent_stop'] },
]

/** 쪽 번호. 처음, 끝, 지금 쪽과 앞뒤만 내고 빈 곳은 줄임표(null)로 잇는다. */
function pageNumbers(current: number, last: number): (number | null)[] {
  const wanted = [1, current - 1, current, current + 1, last]
    .filter((n) => n >= 1 && n <= last)
    .sort((a, b) => a - b)
  const out: (number | null)[] = []
  for (const n of new Set(wanted)) {
    const prev = out.at(-1)
    if (prev !== undefined && prev !== null && n - prev > 1) out.push(null)
    out.push(n)
  }
  return out
}

const th =
  'px-[12px] py-[9px] text-left font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-faint whitespace-nowrap'

function AuditLog() {
  const [range, setRange] = useState<RangeId>('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [type, setType] = useState('')
  const [actorInput, setActorInput] = useState('')
  const [actor, setActor] = useState('')
  const [result, setResult] = useState<(typeof RESULTS)[number]['id']>('')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const refreshVersion = useRefreshStore((s) => s.version)

  // 글자마다 서버를 두드리지 않는다. 손이 멈춘 뒤 한 번만 보낸다.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setActor(actorInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(id)
  }, [actorInput])

  /** 조건이 바뀌면 첫 쪽으로 돌아간다. */
  function changeFilter(apply: () => void) {
    apply()
    setPage(1)
  }

  const filterKey = JSON.stringify([range, customFrom, customTo, type, actor, result, order])
  // 조회 구간. 첫 쪽에서 서버가 실제로 적용한 값을 쥐고 있다가 다음 쪽에 그대로 되돌려준다.
  // 안 그러면 그사이 쌓인 새 기록 때문에 offset 이 밀려 행이 겹친다.
  const pin = useRef<{ key: string; version: number; from?: number; to?: number } | null>(null)

  const { data, loading, error, refetch } = useApi(async () => {
    // 조건이 바뀌었거나 전역 새로고침이 돌았으면 구간을 새로 잡는다(안 그러면 새로고침해도 새 기록이 안 보인다).
    if (pin.current?.key !== filterKey || pin.current.version !== refreshVersion) {
      const hours = RANGES.find((r) => r.id === range)?.hours ?? null
      pin.current = {
        key: filterKey,
        version: refreshVersion,
        from:
          hours !== null
            ? Date.now() - hours * HOUR
            : customFrom
              ? new Date(customFrom).getTime()
              : undefined,
        to: hours === null && customTo ? new Date(customTo).getTime() : undefined,
      }
    }
    const applied = pin.current
    const res = await api.auditPage({
      from: applied.from,
      to: applied.to,
      type: type || undefined,
      actor: actor || undefined,
      result: result || undefined,
      order,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      withTotal: true,
    })
    applied.to ??= res.to ?? undefined
    return res
  }, [filterKey, page])

  const rows = data?.rows ?? []
  const total = data?.total ?? null
  const lastPage = Math.min(Math.max(Math.ceil((total ?? 0) / PAGE_SIZE), 1), MAX_PAGES)
  const first = (page - 1) * PAGE_SIZE + 1
  const reset = () => {
    setRange('7d')
    setCustomFrom('')
    setCustomTo('')
    setType('')
    setActorInput('')
    setActor('')
    setResult('')
    setOrder('desc')
    setPage(1)
  }

  const pageButton = (n: number) => (
    <button
      key={n}
      type="button"
      aria-current={n === page ? 'page' : undefined}
      onClick={() => setPage(n)}
      className={`h-[32px] min-w-[32px] cursor-pointer rounded-sm px-[8px] font-mono text-[12px] transition-colors ${
        n === page ? 'bg-accent text-white' : 'text-mid hover:bg-panel hover:text-ink-2'
      }`}
    >
      {n}
    </button>
  )

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <div className="text-[18px] sm:text-[20px] font-bold text-ink tracking-[-0.01em]">
          감사기록
        </div>
        <div className="mt-[6px] text-[13px] text-faint">
          관리 서버와 에이전트가 남긴 기록입니다. 기록은 고치거나 지울 수 없습니다.
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-[16px] px-[16px] py-[16px] sm:px-[20px]">
        <div className="flex flex-col gap-[6px]">
          <span className="text-[11.5px] font-semibold text-mid">기간</span>
          <div
            role="group"
            aria-label="기간"
            className="inline-flex flex-wrap rounded-sm border border-line-2 bg-panel-2 p-[2px]"
          >
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === range}
                onClick={() => changeFilter(() => setRange(r.id))}
                className={`h-[28px] cursor-pointer whitespace-nowrap rounded-xs px-[12px] text-[12px] font-semibold transition-colors ${
                  r.id === range
                    ? 'bg-panel text-ink shadow-[inset_0_0_0_1px_var(--line)]'
                    : 'text-mid hover:text-ink-2'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {range === 'custom' && (
          <>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[11.5px] font-semibold text-mid">시작</span>
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(e) => changeFilter(() => setCustomFrom(e.target.value))}
                className={`${inputClass} !h-[34px] w-[200px] font-mono`}
              />
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[11.5px] font-semibold text-mid">끝</span>
              <input
                type="datetime-local"
                value={customTo}
                onChange={(e) => changeFilter(() => setCustomTo(e.target.value))}
                className={`${inputClass} !h-[34px] w-[200px] font-mono`}
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-[6px]">
          <span className="text-[11.5px] font-semibold text-mid">사건 유형</span>
          <select
            value={type}
            onChange={(e) => changeFilter(() => setType(e.target.value))}
            className={`${inputClass} !h-[34px] w-[200px] cursor-pointer`}
          >
            <option value="">전체 유형</option>
            {TYPE_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className="text-[11.5px] font-semibold text-mid">행위자</span>
          <input
            type="search"
            value={actorInput}
            onChange={(e) => setActorInput(e.target.value)}
            placeholder="이메일 또는 호스트"
            className={`${inputClass} !h-[34px] w-[220px]`}
          />
        </label>
        <div className="flex flex-col gap-[6px]">
          <span className="text-[11.5px] font-semibold text-mid">결과</span>
          <div
            role="group"
            aria-label="결과"
            className="inline-flex rounded-sm border border-line-2 bg-panel-2 p-[2px]"
          >
            {RESULTS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === result}
                onClick={() => changeFilter(() => setResult(r.id))}
                className={`h-[28px] cursor-pointer whitespace-nowrap rounded-xs px-[12px] text-[12px] font-semibold transition-colors ${
                  r.id === result
                    ? 'bg-panel text-ink shadow-[inset_0_0_0_1px_var(--line)]'
                    : 'text-mid hover:text-ink-2'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={reset} className={`${ghostButton} !h-[34px] ml-auto`}>
          필터 초기화
        </button>
      </Card>

      <Card>
        <CardHead
          title="기록"
          meta={
            <span className="font-mono">
              {total === null
                ? ''
                : `${total.toLocaleString()}건${data?.from ? ` · ${shortTime(data.from)} ~ ${shortTime(data.to ?? Date.now())}` : ''}`}
            </span>
          }
        >
          {rows.length > 0 && (
            <span className="font-mono text-[12px] text-faint">
              {first}-{first + rows.length - 1}
            </span>
          )}
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className={`${secondaryButton} !h-[32px] !px-[12px] text-[12px]`}
          >
            이전
          </button>
          <button
            type="button"
            disabled={!data?.hasMore || page >= MAX_PAGES}
            onClick={() => setPage(page + 1)}
            className={`${secondaryButton} !h-[32px] !px-[12px] text-[12px]`}
          >
            다음
          </button>
        </CardHead>
        <AsyncState
          loading={loading}
          error={error}
          empty={rows.length === 0}
          emptyText="조건에 맞는 기록이 없습니다"
          onRetry={refetch}
        >
          <ScrollArea label="감사기록">
            <table className="w-full min-w-[1140px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[144px]" />
                <col className="w-[84px]" />
                <col className="w-[196px]" />
                <col className="w-[178px]" />
                <col className="w-[164px]" />
                <col className="w-[72px]" />
                <col className="w-[124px]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-line-2">
                  <th
                    className={`${th} !pl-[20px]`}
                    aria-sort={order === 'desc' ? 'descending' : 'ascending'}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        changeFilter(() => setOrder(order === 'desc' ? 'asc' : 'desc'))
                      }
                      aria-label={`시각 정렬, 지금 ${order === 'desc' ? '최신순' : '오래된 순'}`}
                      className="inline-flex cursor-pointer items-center gap-[6px] border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] text-ink-2"
                    >
                      시각
                      <span
                        aria-hidden
                        className={`border-x-[4px] border-x-transparent ${
                          order === 'desc'
                            ? 'border-t-[5px] border-t-current'
                            : 'border-b-[5px] border-b-current'
                        }`}
                      />
                    </button>
                  </th>
                  <th className={th}>종류</th>
                  <th className={th}>행위자</th>
                  <th className={th}>사건 유형</th>
                  <th className={th}>대상</th>
                  <th className={th}>결과</th>
                  <th className={th}>IP</th>
                  <th className={`${th} !pr-[20px]`}>상세</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <AuditRow key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <div className="flex flex-wrap items-center gap-[8px] border-t border-line-2 px-[16px] py-[14px] sm:px-[20px]">
            <span className="font-mono text-[11px] text-faint">
              {PAGE_SIZE}개씩 · {page} / {lastPage}쪽
              {total !== null &&
                total > MAX_PAGES * PAGE_SIZE &&
                ' · 앞 10,000건까지 볼 수 있습니다. 기간을 좁히세요'}
            </span>
            <nav aria-label="페이지" className="ml-auto flex items-center gap-[4px]">
              {pageNumbers(page, lastPage).map((n, i) =>
                n === null ? (
                  <span key={`gap-${i}`} className="px-[4px] font-mono text-faint">
                    ...
                  </span>
                ) : (
                  pageButton(n)
                ),
              )}
            </nav>
          </div>
        </AsyncState>
      </Card>
    </div>
  )
}

function AuditRow({ row }: { row: AuditRecord }) {
  const isUser = row.actorType === 'user'
  const failed = row.result === 'failure'
  const detail = row.detail ?? ''
  return (
    <tr className="border-b border-line-2 last:border-b-0 hover:bg-panel">
      <td className="whitespace-nowrap py-[9px] pl-[20px] pr-[12px] font-mono text-[12px] text-mid">
        {shortTime(row.ts, true)}
      </td>
      <td className="px-[12px] py-[9px]">
        <span className="rounded-xs border border-line px-[7px] py-[2px] font-mono text-[11px] text-ink-2">
          {row.actorType}
        </span>
      </td>
      <td
        title={row.actor}
        className={`truncate px-[12px] py-[9px] text-ink ${isUser ? 'text-[12.5px]' : 'font-mono text-[12px] font-semibold'}`}
      >
        {row.actor}
      </td>
      <td className="px-[12px] py-[9px]">
        <b className="block truncate text-[13px] font-semibold text-ink">
          {TYPE_LABELS[row.type] ?? row.type}
        </b>
        <code className="block truncate font-mono text-[11px] text-faint">{row.type}</code>
      </td>
      <td
        title={row.target ?? ''}
        className="truncate px-[12px] py-[9px] font-mono text-[12px] text-ink-2"
      >
        {row.target ?? '-'}
      </td>
      <td className="px-[12px] py-[9px]">
        <span
          className={`inline-flex items-center gap-[6px] whitespace-nowrap text-[12.5px] ${
            failed ? 'font-semibold text-crit' : 'text-mid'
          }`}
        >
          {failed && <i aria-hidden className="h-[6px] w-[6px] rounded-full bg-crit" />}
          {failed ? '실패' : '성공'}
        </span>
      </td>
      <td className="whitespace-nowrap px-[12px] py-[9px] font-mono text-[12px] text-mid">
        {row.ip ?? '-'}
      </td>
      <td title={detail} className="truncate py-[9px] pl-[12px] pr-[20px] text-[12.5px] text-mid">
        {detail || <span className="text-faint">-</span>}
      </td>
    </tr>
  )
}

export default AuditLog
