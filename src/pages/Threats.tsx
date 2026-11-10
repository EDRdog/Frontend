import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import { usePagedList } from '@/hooks/usePagedList'
import type { Alert, AlertStatus } from '@/api/types'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Tag from '@/components/ui/Tag'
import FilterChips from '@/components/ui/FilterChips'
import AsyncState from '@/components/ui/AsyncState'
import ActiveFilters, { type ActiveFilter } from '@/components/ui/ActiveFilters'
import { absoluteTime, severityColors, severityLabel, severityTone } from '@/lib/format'
import { useAlertsStore } from '@/store/alerts'

/** 열마다 한 쪽 크기. 더 볼 것은 열 아래 더 보기로 이어 붙인다. */
const LIMIT = 50

type Severity = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM'

/*
  칩은 서버에 넘겨서 거른다. 화면에서 거르면 받아 둔 쪽 안에서만 걸러져 실제와 다른 목록이 된다.
  같은 이유로 칩에 건수도 붙이지 않는다. 받은 만큼만 셀 수 있어 사실과 달라진다.
  상태는 칩이 아니라 보드의 열이다. 예전 확정·오탐 칩은 그 열이 대신하고, 이제 심각도와 함께 걸린다.
*/
const CHIPS: [Severity, string][] = [
  ['all', '전체'],
  ['CRITICAL', '심각'],
  ['HIGH', '높음'],
  ['MEDIUM', '보통'],
]

type Column = { status: AlertStatus; label: string; note?: string; empty: string }

/*
  보드 열. 서버 status 는 값 하나만 받으므로 열마다 따로 조회하고 따로 넘긴다.
  한 목록을 받아 화면에서 나누면 열 건수가 받은 만큼으로 줄고, 더 보기가 엉뚱한 열을 채운다.
*/
const COLUMNS: Column[] = [
  {
    status: 'open',
    label: '미판단',
    note: '판단을 기다리는 위협',
    empty: '판단을 기다리는 위협이 없습니다',
  },
  { status: 'confirmed', label: '확정', empty: '확정한 위협이 없습니다' },
  { status: 'false_positive', label: '오탐', empty: '오탐으로 판단한 위협이 없습니다' },
]

type Query = {
  host?: string
  domain?: string
  destIp?: string
  severity?: string
}

function Threats() {
  const [severity, setSeverity] = useState<Severity>('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  // 다른 화면(관계 분석, IP·도메인 조회)에서 좁혀 들어오는 경로가 있어 되돌아갈 길을 준다.
  const canGoBack = window.history.length > 1
  const host = searchParams.get('host')
  const domain = searchParams.get('domain')
  const destIp = searchParams.get('destIp')

  // 해제는 그 조건만 지운다. 나머지 조건은 남아야 한다.
  function clearParam(key: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete(key)
      return next
    })
  }

  const query: Query = {
    host: host ?? undefined,
    domain: domain ?? undefined,
    destIp: destIp ?? undefined,
    severity: severity === 'all' ? undefined : severity,
  }
  const hasDestFilter = Boolean(host || domain || destIp)
  // 조건 때문에 빈 열인지 원래 빈 열인지 문구로 가른다.
  const filtered = hasDestFilter || severity !== 'all'

  const activeFilters: ActiveFilter[] = [
    ...(host ? [{ label: '호스트', value: host, onClear: () => clearParam('host') }] : []),
    ...(domain ? [{ label: '도메인', value: domain, onClear: () => clearParam('domain') }] : []),
    ...(destIp ? [{ label: '목적지 IP', value: destIp, onClear: () => clearParam('destIp') }] : []),
  ]

  const chips = CHIPS.map(([value, label]) => ({
    label,
    active: severity === value,
    onClick: () => setSeverity(value),
  }))

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-col items-start gap-[16px] sm:flex-row sm:justify-between sm:items-end">
        <div>
          <div className="text-[18px] sm:text-[20px] font-bold text-ink tracking-[-0.01em]">
            위협
          </div>
          <div className="mt-[6px] text-[13px] text-faint">
            탐지된 위협을 심각도와 상태로 관리합니다.
          </div>
        </div>
        <FilterChips chips={chips} />
      </div>

      <ActiveFilters filters={activeFilters} onBack={canGoBack ? () => navigate(-1) : undefined} />

      {/* 상태별 보드: 미판단이 할 일이라 가장 넓다. 1280 미만에서는 위아래로 쌓는다. */}
      <section className="grid grid-cols-1 gap-[24px] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] xl:gap-[22px] items-start">
        {COLUMNS.map((column) => (
          <BoardColumn key={column.status} column={column} query={query} filtered={filtered} />
        ))}
      </section>
    </div>
  )
}

type BoardColumnProps = {
  column: Column
  query: Query
  /** 심각도·호스트·목적지로 좁혔는지. 빈 열 문구가 달라진다. */
  filtered: boolean
}

/** 상태 하나의 열. 자기 쪽을 따로 받아 이어 붙이고, 길어지면 열 안에서 스크롤한다. */
function BoardColumn({ column, query, filtered }: BoardColumnProps) {
  // 트리아지가 일어나면 열을 다시 받는다. 판정된 위협은 미판단 열에서 다른 열로 옮겨 간다.
  const alertsVersion = useAlertsStore((s) => s.version)
  const { rows, total, hasMore, loading, loadingMore, error, moreError, loadMore, reload } =
    usePagedList<Alert>(
      (page) =>
        api.alertPage({
          ...query,
          status: column.status,
          // 다음 쪽부터는 서버가 잡은 구간을 그대로 되돌려준다.
          from: page.from,
          to: page.to,
          limit: page.limit,
          offset: page.offset,
          withTotal: page.withTotal,
        }),
      [alertsVersion, query.host, query.domain, query.destIp, query.severity, column.status],
      LIMIT,
    )

  return (
    <section aria-label={`${column.label} 위협`} className="flex min-w-0 flex-col gap-[10px]">
      {/* 열 머리: 상태 이름 + 서버가 센 건수 */}
      <div className="flex items-baseline gap-[8px] border-b border-line px-[4px] pb-[8px]">
        <h2 className="text-[15px] font-bold text-ink">{column.label}</h2>
        {!loading && !error && (
          <span className="font-mono text-[12px] text-faint tabular-nums">
            {(total ?? rows.length).toLocaleString()}
          </span>
        )}
        {column.note && <span className="ml-auto text-[12px] text-faint">{column.note}</span>}
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyText={filtered ? '이 조건에서 탐지된 위협이 없습니다' : column.empty}
        onRetry={reload}
      >
        {/* 수백 건이 쌓여도 페이지가 끝없이 늘지 않게 열 안에서 스크롤한다. 그림자가 잘리지 않게 안쪽 여백을 둔다. */}
        <div className="-mx-[6px] flex max-h-[640px] flex-col gap-[10px] overflow-y-auto px-[6px] pt-[2px] pb-[12px]">
          {rows.map((row) => (
            <ThreatCard key={row.id} alert={row} />
          ))}
        </div>
        {moreError && <div className="text-center text-[12.5px] text-crit">{moreError}</div>}
        <div className="flex items-center justify-between gap-[12px] px-[4px]">
          <span className="font-mono text-[12px] text-faint">
            {total === null ? `${rows.length}건` : `${rows.length} / ${total}건`}
          </span>
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="cursor-pointer rounded-sm border border-line bg-surface px-[14px] py-[8px] text-[12.5px] font-semibold text-ink-2 disabled:cursor-default disabled:text-faint"
            >
              {loadingMore ? '불러오는 중' : '더 보기'}
            </button>
          )}
        </div>
      </AsyncState>
    </section>
  )
}

/** 보드 카드 한 장. 상태는 열이 말하므로 심각도, MITRE, 위협명, 호스트·룰, 목적지, 근거 수, 탐지 시각을 싣는다. */
function ThreatCard({ alert }: { alert: Alert }) {
  const tone = severityTone(alert.severity)
  const destination = [alert.domain, alert.destIp].filter(Boolean).join(' · ')

  return (
    <Card className="relative flex flex-col gap-[6px] py-[14px] pl-[18px] pr-[16px]">
      {/* 심각도 띠(2px). 배경 전체를 칠하지 않는다. */}
      <span
        aria-hidden
        className="absolute left-0 top-[14px] bottom-[14px] w-[2px] rounded-full"
        style={{ background: severityColors[tone] }}
      />
      <div className="flex flex-wrap items-center gap-[6px]">
        <Badge severity={tone}>{severityLabel(alert.severity)}</Badge>
        {alert.mitre && <Tag>{alert.mitre}</Tag>}
        <span className="ml-auto font-mono text-[11px] text-faint">
          근거 {alert.matched.length}
        </span>
      </div>
      <span className="text-[14px] font-semibold leading-[1.4] text-ink wrap-anywhere">
        {alert.threatName}
      </span>
      {/* 한글 위협명 아래에 detector 룰 원문을 깐다. 조사할 때 실제로 대조하는 값은 ruleId 다. */}
      <span className="font-mono text-[11.5px] text-mid wrap-anywhere">
        {alert.host} · {alert.ruleId}
      </span>
      {/* 판정 근거에 실제로 관측된 목적지만 싣는다. 없으면 줄을 두지 않는다(지어내지 않는다). */}
      {destination && (
        <span className="font-mono text-[11.5px] text-ink-2 wrap-anywhere">
          <span className="font-sans text-faint">목적지 </span>
          {destination}
        </span>
      )}
      <span className="font-mono text-[11px] text-faint tabular-nums">
        {absoluteTime(alert.ts)}
      </span>
    </Card>
  )
}

export default Threats
