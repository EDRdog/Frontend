import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import type { Alert, HostSummary } from '@/api/types'
import Card, { panelHead } from '@/components/ui/Card'
import AttackFlow from '@/components/ui/AttackFlow'
import Badge from '@/components/ui/Badge'
import FocusList from '@/components/ui/FocusList'
import Tag from '@/components/ui/Tag'
import AsyncState from '@/components/ui/AsyncState'
import TopThreats from '@/components/ui/TopThreats'
import TriageActions from '@/components/ui/TriageActions'
import { useApi } from '@/hooks/useApi'
import { absoluteTime, daysAgo, severityColors, severityLabel, severityTone } from '@/lib/format'
import { toAttackSteps } from '@/lib/lineagePath'
import { useAlertsStore } from '@/store/alerts'
import { useAuthStore } from '@/store/auth'

// echarts 를 쓰는 차트는 지연 경계로 두어 별도 청크에서 온디맨드로 로드한다.
const ThreatTrendChart = lazy(() => import('@/components/ui/ThreatTrendChart'))

const chartFallback = (
  <Card className="px-[16px] py-[18px] sm:px-[24px] sm:py-[22px]">
    <div className="flex items-center justify-center h-[292px] text-[13px] text-faint">
      불러오는 중
    </div>
  </Card>
)

// 대기열 순서: 심각도가 높은 것 먼저, 같으면 최신이 먼저. 미등록 심각도는 맨 뒤.
const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 }
function byUrgency(a: Alert, b: Alert) {
  return (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3) || b.ts - a.ts
}

/** 수치를 못 받았으면 0 으로 그리지 않는다(decision 010). */
function statText(value: number | undefined, loading: boolean) {
  if (value !== undefined) return value.toLocaleString()
  return loading ? '…' : '확인 불가'
}

function Dashboard() {
  // 트리아지가 일어나면 알림 관련 조회를 다시 돈다.
  const alertsVersion = useAlertsStore((s) => s.version)
  // 로그인 전이면 api 가 데모 데이터를 돌려준다(src/api/demo.ts). 배너로 그 사실을 알린다.
  const demo = useAuthStore((s) => s.token === null)
  const open = useApi(() => api.alerts({ status: 'open', limit: 1000 }), [alertsVersion])
  const week = useApi(() => api.alertSummary({ from: daysAgo(7) }))
  const prevWeek = useApi(() => api.alertSummary({ from: daysAgo(14), to: daysAgo(7) }))
  const hosts = useApi(() => api.hostSummary())
  const events = useApi(() => api.eventSummary({ from: daysAgo(1) }))
  // 대기열에서 고른 위협. 고른 게 없거나 판정돼 빠지면 맨 위 위협으로 돌아간다.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 한눈에 보기는 열 때만 그린다. 닫혀 있는 동안 echarts 청크를 받지 않는다.
  const [glanceOpen, setGlanceOpen] = useState(false)

  const queue = [...(open.data ?? [])].sort(byUrgency)
  const focus = queue.find((a) => a.id === selectedId) ?? queue[0] ?? null
  const openCritical = queue.filter((a) => a.severity === 'CRITICAL').length
  const allClear = !open.loading && !open.error && focus === null

  /*
    서버는 정상인데 등록된 호스트가 하나도 없으면 아직 에이전트가 아무것도 보내지 않은 상태다.
    요청 실패와 달리 사용자가 할 일이 "에이전트 설치"로 분명하므로 안내 화면으로 대체한다.
  */
  if (!demo && !hosts.loading && !hosts.error && hosts.data?.total === 0) {
    return (
      <NotCollected
        onRetry={() => {
          hosts.refetch()
          open.refetch()
          week.refetch()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-[16px]">
      {demo && <DemoBanner />}

      {/*
        포커스: 왼쪽 위협 하나 크게, 오른쪽 대기열과 엔드포인트.
        2열은 xl(1280) 부터. 1100 에서는 사이드바 224px 까지 빠져 왼쪽 카드가 460px 남짓이라
        판정 버튼 줄이 카드 밖으로 밀려난다(2단계 화면 확인).
      */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-[16px] items-start">
        <div className="flex flex-col gap-[12px] min-w-0">
          {focus ? (
            // 위협이 바뀌면 판정 버튼의 확인 단계 같은 로컬 상태를 버려야 한다.
            <FocusThreat key={focus.id} alert={focus} />
          ) : allClear ? (
            <>
              <AllClear />
              <Suspense fallback={chartFallback}>
                <ThreatTrendChart />
              </Suspense>
              <EndpointCard state={hosts} large />
            </>
          ) : (
            <Card className="px-[18px] py-[20px] sm:px-[28px] sm:py-[26px]">
              <AsyncState loading={open.loading} error={open.error} onRetry={open.refetch}>
                {null}
              </AsyncState>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-[12px] min-w-0">
          <Card className="overflow-hidden">
            <div className={panelHead}>
              <h2 className="text-[14px] font-bold text-ink">대기열</h2>
              <span className="font-mono text-[11px] text-faint">미판단 {queue.length}</span>
              {openCritical > 0 && (
                <Badge severity="crit" className="ml-auto">
                  심각 {openCritical}
                </Badge>
              )}
            </div>
            <AsyncState
              loading={open.loading}
              error={open.error}
              empty={queue.length === 0}
              emptyText="대기열이 비어 있습니다"
              onRetry={open.refetch}
            >
              {/* 미판단 위협 목록. 누르면 왼쪽이 그 위협으로 바뀐다. */}
              <FocusList
                items={queue.map((a) => ({
                  key: a.id,
                  color: severityColors[severityTone(a.severity)],
                  title: a.threatName,
                  sub: `${a.host} · ${absoluteTime(a.ts)}`,
                  srLabel: severityLabel(a.severity),
                }))}
                currentKey={focus?.id ?? null}
                onSelect={setSelectedId}
              />
            </AsyncState>
          </Card>
          {/* 위협이 없을 때는 왼쪽에 크게 보여주므로 여기서는 뺀다. */}
          {!allClear && <EndpointCard state={hosts} />}
        </aside>
      </section>

      {/* 한눈에 보기: 기본은 닫힘 */}
      <details className="group" onToggle={(e) => setGlanceOpen(e.currentTarget.open)}>
        <summary className="flex items-baseline gap-[10px] px-[4px] py-[6px] list-none cursor-pointer rounded-sm text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
          <span
            aria-hidden
            className="self-center w-[7px] h-[7px] border-r-[1.5px] border-b-[1.5px] border-mid -rotate-45 transition-transform duration-[160ms] group-open:rotate-45"
          />
          한눈에 보기
          <span className="text-[12px] font-normal text-faint">최근 7일 추이와 많이 나온 위협</span>
        </summary>
        {glanceOpen && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-[12px] mt-[10px] items-start">
            <Suspense fallback={chartFallback}>
              <ThreatTrendChart />
            </Suspense>
            <Card className="px-[16px] py-[18px] sm:px-[24px] sm:py-[22px]">
              <div className="flex justify-between items-center mb-[18px]">
                <span className="text-[14px] font-bold text-ink">위협 유형 TOP 5</span>
                <span className="text-[11.5px] text-faint">최근 7일</span>
              </div>
              <AsyncState
                loading={week.loading}
                error={week.error}
                empty={(week.data?.topThreats ?? []).length === 0}
                emptyText="집계할 위협이 없습니다"
                onRetry={week.refetch}
              >
                {week.data && <TopThreats threats={week.data.topThreats} total={week.data.total} />}
              </AsyncState>
            </Card>
          </div>
        )}
      </details>

      {/* 수집 수치 한 줄 */}
      <section className="flex flex-wrap gap-x-[32px] gap-y-[8px] px-[4px] py-[6px] text-[12px] text-mid">
        <div className="flex items-center gap-[8px]">
          <b className="font-mono text-[14px] font-semibold text-ink tabular-nums">
            {statText(events.data?.total, events.loading)}
          </b>
          <span>24시간 이벤트</span>
        </div>
        <div className="flex items-center gap-[8px]">
          <b className="font-mono text-[14px] font-semibold text-ink tabular-nums">
            {statText(week.data?.total, week.loading)}
          </b>
          <span>이번 주 탐지</span>
          <WeekDelta current={week.data?.total} previous={prevWeek.data?.total} />
        </div>
      </section>
    </div>
  )
}

/** 로그인 전에 보이는 화면이 실제 데이터가 아님을 알린다. */
function DemoBanner() {
  return (
    <div className="flex flex-col gap-[10px] sm:flex-row sm:items-center sm:gap-[16px] px-[16px] py-[14px] bg-panel-2 border border-line-2 rounded-md">
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold text-ink">데모 데이터를 보고 있습니다</div>
        <div className="text-[12.5px] text-mid mt-[3px] leading-[1.5]">
          로그인하면 내 조직의 실제 탐지 결과로 바뀝니다.
        </div>
      </div>
      <Link
        to="/login"
        className="text-center whitespace-nowrap text-[13px] font-semibold !text-white bg-accent px-[18px] py-[10px] rounded-sm"
      >
        로그인
      </Link>
    </div>
  )
}

/** 로그인은 됐지만 에이전트가 아직 아무 데이터도 보내지 않은 상태. */
function NotCollected({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="px-[20px] py-[40px] sm:px-[32px] sm:py-[56px]">
      <div className="flex flex-col items-center text-center gap-[10px] max-w-[440px] mx-auto">
        <span className="text-[15px] font-bold text-ink">아직 수집 전입니다</span>
        <p className="text-[13.5px] text-mid leading-[1.6]">
          연결된 엔드포인트가 없습니다. 감시할 장비에 EDRdog 에이전트를 설치하고 실행하면 수집이
          시작됩니다. 첫 이벤트가 들어오면 이 화면이 채워집니다.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-[8px] text-[13px] font-semibold text-ink-2 border border-line bg-surface px-[18px] py-[10px] rounded-sm cursor-pointer font-sans"
        >
          다시 확인
        </button>
      </div>
    </Card>
  )
}

/** 지난주 대비 증감률. 지난주가 0이면 비교할 기준이 없어 표시하지 않는다. */
function WeekDelta({ current, previous }: { current?: number; previous?: number }) {
  if (current === undefined || !previous) return null
  const delta = Math.round(((current - previous) / previous) * 100)
  return (
    <span className={`font-mono text-[11px] ${delta >= 0 ? 'text-crit' : 'text-good'}`}>
      {delta >= 0 ? '+' : ''}
      {delta}%
    </span>
  )
}

/** 가장 먼저 볼 위협 하나: 머리 정보, 세로 공격 흐름, 권고와 판정 버튼. */
function FocusThreat({ alert }: { alert: Alert }) {
  const { data, loading, error, refetch } = useApi(() => api.lineage(alert.id), [alert.id])
  const steps = data ? toAttackSteps(data) : []

  return (
    <Card className="px-[18px] py-[20px] sm:px-[28px] sm:py-[26px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <Badge severity={severityTone(alert.severity)}>{severityLabel(alert.severity)}</Badge>
        {alert.mitre && <Tag>{alert.mitre}</Tag>}
        <span className="ml-auto font-mono text-[12px] text-mid tabular-nums">
          {absoluteTime(alert.ts)}
        </span>
      </div>
      <h2 className="mt-[16px] text-[24px] sm:text-[30px] font-bold leading-[1.25] tracking-[-0.03em] text-ink">
        {alert.threatName}
      </h2>
      <p className="mt-[4px] text-[13px] text-mid wrap-anywhere">
        <span className="font-mono font-semibold text-ink">{alert.host}</span> ·{' '}
        <span className="font-mono">{alert.ruleId}</span>
      </p>

      <div className="mt-[24px]">
        <AsyncState
          loading={loading}
          error={error}
          empty={steps.length === 0}
          emptyText="이 알림 시각 주변에 재구성할 이벤트가 없습니다"
          onRetry={refetch}
        >
          <AttackFlow steps={steps} />
        </AsyncState>
      </div>

      <TriageActions alert={alert} detailTo="/threats" />
    </Card>
  )
}

/** 처리할 위협이 없을 때의 머리. 없는 수치를 지어내지 않는다. */
function AllClear() {
  return (
    <Card className="px-[20px] py-[24px] sm:px-[34px] sm:py-[30px]">
      <Badge severity="good">처리할 위협 없음</Badge>
      <h2 className="mt-[18px] text-[26px] sm:text-[34px] font-bold leading-[1.2] tracking-[-0.035em] text-ink">
        지금 처리할 위협이 없습니다
      </h2>
      <p className="mt-[6px] text-[14px] text-mid">새 위협이 탐지되면 여기에 바로 띄웁니다.</p>
    </Card>
  )
}

type EndpointCardProps = {
  state: ReturnType<typeof useApi<HostSummary>>
  /** 위협이 없을 때 왼쪽에 크게 보여준다. */
  large?: boolean
}

/** 엔드포인트 상태: 총 대수, 상태별 가로 분할 막대, 범례. */
function EndpointCard({ state, large = false }: EndpointCardProps) {
  const summary = state.data
  const parts = summary
    ? [
        { label: '정상', value: summary.healthy, color: 'var(--good)' },
        { label: '주의', value: summary.warning, color: 'var(--med)' },
        { label: '위험', value: summary.critical, color: 'var(--crit)' },
        // 등록만 되고 이벤트가 없는 기기다. "정상" 색(초록)을 쓰면 검증 안 된 상태를 좋다고
        // 말하는 셈이라 중립색으로 따로 둔다.
        { label: '수집 없음', value: summary.noEvents, color: 'var(--faint)' },
      ]
    : []

  return (
    <Card className="overflow-hidden">
      <div className={panelHead}>
        <h2 className="text-[14px] font-bold text-ink">엔드포인트 상태</h2>
      </div>
      <div
        className={large ? 'px-[18px] py-[20px] sm:px-[28px] sm:py-[24px]' : 'px-[18px] py-[16px]'}
      >
        <AsyncState loading={state.loading} error={state.error} onRetry={state.refetch}>
          {summary && (
            <>
              <div className="flex items-baseline gap-[8px]">
                <span
                  className={`font-mono font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums ${
                    large ? 'text-[40px]' : 'text-[30px]'
                  }`}
                >
                  {summary.total}
                </span>
                <span className="text-[13px] text-mid">대 관리 중</span>
              </div>
              <div
                aria-hidden
                className={`flex gap-[2px] mt-[14px] mb-[16px] rounded-xs overflow-hidden bg-panel ${
                  large ? 'h-[14px]' : 'h-[10px]'
                }`}
              >
                {parts.map(
                  (p) =>
                    p.value > 0 && (
                      <span key={p.label} style={{ flex: p.value, background: p.color }} />
                    ),
                )}
              </div>
              <div
                className={`grid gap-[9px] ${large ? 'grid-cols-2 gap-x-[24px] sm:grid-cols-4' : ''}`}
              >
                {parts.map((p) => (
                  <div key={p.label} className="flex items-center gap-[8px] text-[13px] text-ink-2">
                    <span
                      className="w-[8px] h-[8px] flex-none rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="whitespace-nowrap">{p.label}</span>
                    <span className="ml-auto font-mono font-semibold text-ink tabular-nums">
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </AsyncState>
      </div>
    </Card>
  )
}

export default Dashboard
