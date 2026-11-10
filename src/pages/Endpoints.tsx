import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import type { Host, HostStatus } from '@/api/types'
import AsyncState from '@/components/ui/AsyncState'
import AttackFlow from '@/components/ui/AttackFlow'
import Badge from '@/components/ui/Badge'
import Card, { panelHead } from '@/components/ui/Card'
import FilterChips from '@/components/ui/FilterChips'
import FocusList from '@/components/ui/FocusList'
import Tag from '@/components/ui/Tag'
import { useApi } from '@/hooks/useApi'
import {
  absoluteTime,
  hostStatusColor,
  hostStatusLabel,
  platformLabel,
  relativeTime,
  severityColors,
  severityLabel,
  severityTone,
  statusLabel,
  statusTone,
} from '@/lib/format'
import { toAttackSteps } from '@/lib/lineagePath'

/** 포커스 카드에 싣는 이 호스트의 위협 수. 상세 화면과 같다. 더 보려면 상세나 위협 보드로 간다. */
const ALERT_LIMIT = 50

// HostStatus 와 별개 축이다. 등록은 됐지만 이벤트가 아직 없는 기기는 열린 알림이 없어
// status 는 항상 healthy 로 오는데, 그걸 그대로 "정상"에 합치면 검증 안 된 상태를 좋다고
// 말하는 셈이라 필터·카운트에서 따로 뗀다.
type Filter = 'all' | HostStatus | 'noEvents'

function isNoEvents(h: Host): boolean {
  return h.enrolled && h.lastSeen === 0
}

// 배지 색. 주의는 보통(노랑)과 같은 색이다.
const statusBadge = { healthy: 'good', warning: 'med', critical: 'crit' } as const

// 위험도 높은 순. 같으면 열린 위협이 많은 순, 그다음 이름순으로 자리를 고정한다.
function byRisk(a: Host, b: Host) {
  return b.riskScore - a.riskScore || b.threats - a.threats || a.host.localeCompare(b.host)
}

function Endpoints() {
  const [filter, setFilter] = useState<Filter>('all')
  // 오른쪽 목록에서 고른 호스트. 고른 게 없거나 필터로 빠지면 맨 위(가장 위험한) 호스트로 돌아간다.
  const [selected, setSelected] = useState<string | null>(null)
  const focusRef = useRef<HTMLDivElement>(null)
  const { data, loading, error, refetch } = useApi(() => api.hosts())

  const hosts = useMemo(() => data ?? [], [data])
  const counts = useMemo(
    () => ({
      healthy: hosts.filter((h) => h.status === 'healthy' && !isNoEvents(h)).length,
      warning: hosts.filter((h) => h.status === 'warning').length,
      critical: hosts.filter((h) => h.status === 'critical').length,
      noEvents: hosts.filter(isNoEvents).length,
    }),
    [hosts],
  )

  const rows = [
    ...(filter === 'all'
      ? hosts
      : filter === 'noEvents'
        ? hosts.filter(isNoEvents)
        : hosts.filter((h) => h.status === filter && !isNoEvents(h))),
  ].sort(byRisk)
  const focus = rows.find((h) => h.host === selected) ?? rows[0] ?? null

  const chips = [
    { label: `전체 ${hosts.length}`, active: filter === 'all', onClick: () => setFilter('all') },
    {
      label: `정상 ${counts.healthy}`,
      active: filter === 'healthy',
      onClick: () => setFilter('healthy'),
    },
    {
      label: `주의 ${counts.warning}`,
      active: filter === 'warning',
      onClick: () => setFilter('warning'),
    },
    {
      label: `위험 ${counts.critical}`,
      active: filter === 'critical',
      onClick: () => setFilter('critical'),
    },
    {
      label: `수집 없음 ${counts.noEvents}`,
      active: filter === 'noEvents',
      onClick: () => setFilter('noEvents'),
    },
  ]

  function select(host: string) {
    setSelected(host)
    // 1280 미만에서는 상세가 목록 위에 쌓여 있어 눌러도 바뀐 게 안 보인다. 상세 머리로 올려 준다.
    if (!window.matchMedia('(min-width: 1280px)').matches) {
      focusRef.current?.scrollIntoView({ block: 'start' })
    }
  }

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-col items-start gap-[16px] sm:flex-row sm:justify-between sm:items-end">
        <div>
          <div className="text-[18px] sm:text-[20px] font-bold text-ink tracking-[-0.01em]">
            엔드포인트
          </div>
          <div className="mt-[6px] text-[13px] text-faint">
            등록됐거나 에이전트가 관측 중인 호스트의 상태입니다.
          </div>
        </div>
        <FilterChips chips={chips} />
      </div>

      {focus === null ? (
        <Card className="px-[18px] py-[20px]">
          <AsyncState
            loading={loading}
            error={error}
            empty
            emptyText="등록되거나 관측된 호스트가 없습니다"
            onRetry={refetch}
          >
            {null}
          </AsyncState>
        </Card>
      ) : (
        /* 포커스: 왼쪽 호스트 하나 크게, 오른쪽 위험도 순 목록. 2열은 대시보드와 같이 xl(1280) 부터. */
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-[16px] items-start">
          <div ref={focusRef} className="min-w-0 scroll-mt-[74px]">
            {/* 호스트가 바뀌면 프로세스 트리·위협 조회를 새로 돌린다. */}
            <HostFocus key={focus.host} info={focus} />
          </div>
          <aside className="min-w-0">
            <Card className="overflow-hidden">
              <div className={panelHead}>
                <h2 className="text-[14px] font-bold text-ink">호스트</h2>
                <span className="font-mono text-[11px] text-faint">
                  위험도 순 · {rows.length}대
                </span>
              </div>
              <FocusList
                mono
                className="max-h-[640px]"
                items={rows.map((h) => {
                  const noEvents = isNoEvents(h)
                  return {
                    key: h.host,
                    color: noEvents ? 'var(--faint)' : hostStatusColor(h.status),
                    title: h.host,
                    sub: noEvents
                      ? `수집 없음 · 에이전트 ${h.enrolled ? relativeTime(h.agentSeen) : '-'}`
                      : [
                          `위험도 ${h.riskScore}`,
                          h.threats > 0 && `위협 ${h.threats}`,
                          relativeTime(h.lastSeen),
                        ]
                          .filter(Boolean)
                          .join(' · '),
                    srLabel: noEvents ? '수집 없음' : hostStatusLabel(h.status),
                  }
                })}
                currentKey={focus.host}
                onSelect={select}
              />
            </Card>
          </aside>
        </section>
      )}
    </div>
  )
}

/** 고른 호스트 하나: 상태, 위험도, 활동 시각, 프로세스 트리, 이 호스트의 위협. */
function HostFocus({ info }: { info: Host }) {
  const tree = useApi(() => api.processTree(info.host), [info.host])
  const alerts = useApi(() => api.alerts({ host: info.host, limit: ALERT_LIMIT }), [info.host])
  const noEvents = isNoEvents(info)
  // 위험 여부는 서버가 준 status 를 따른다. 점수로 색을 또 나누지 않는다.
  const color = noEvents ? 'var(--faint)' : hostStatusColor(info.status)
  const hostPath = encodeURIComponent(info.host)
  const alertRows = alerts.data ?? []

  return (
    <Card className="px-[18px] py-[20px] sm:px-[28px] sm:py-[26px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <Badge severity={noEvents ? 'mid' : (statusBadge[info.status] ?? 'mid')}>
          {noEvents ? '수집 없음' : hostStatusLabel(info.status)}
        </Badge>
        <Tag>{platformLabel(info.platform)}</Tag>
        {!info.enrolled && <Badge severity="mid">미등록</Badge>}
        <span className="ml-auto font-mono text-[12px] text-mid">
          {/* lastSeen 0 은 등록만 되고 수집이 없는 기기다. 1970년으로 그리면 안 된다. */}
          {noEvents ? '수집 없음' : `마지막 활동 ${relativeTime(info.lastSeen)}`}
        </span>
      </div>
      <h2 className="mt-[16px] font-mono text-[22px] sm:text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] text-ink wrap-anywhere">
        {info.host}
      </h2>

      {/* 위험도: 큰 숫자와 막대 */}
      <div className="mt-[18px] flex max-w-[420px] items-center gap-[12px]">
        <span
          className="font-mono text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
          style={{ color }}
        >
          {info.riskScore}
        </span>
        <span className="h-[6px] flex-1 overflow-hidden rounded-xs bg-panel">
          <span
            className="block h-full rounded-xs"
            style={{ width: `${info.riskScore}%`, background: color }}
          />
        </span>
      </div>
      {/*
        위험도가 무엇을 센 값인지만 밝힌다. 상태를 어떻게 정하는지는 서버 규칙이라 여기 적지 않는다.
        적어 두면 서버가 규칙을 바꿀 때 화면만 옛 설명을 계속 사실처럼 보여준다.
      */}
      <p className="mt-[6px] text-[12px] leading-[1.5] text-faint">
        위험도는 열린 알림을 심각도로 가중해 더한 0~100 값입니다. 0 은 열린 알림이 없다는 뜻입니다.
      </p>

      <dl className="mt-[18px] grid grid-cols-[104px_minmax(0,1fr)] gap-x-[16px] gap-y-[9px]">
        <Field label="열린 위협">
          <span className={info.threats > 0 ? 'text-crit' : ''}>{info.threats}건</span>
        </Field>
        <Field label="마지막 활동">
          {noEvents ? (
            <span className="text-faint">수집 없음</span>
          ) : (
            <>
              {absoluteTime(info.lastSeen)}
              <span className="ml-[6px] text-faint">{relativeTime(info.lastSeen)}</span>
            </>
          )}
        </Field>
        <Field label="에이전트 연결">
          {info.enrolled ? (
            <>
              {absoluteTime(info.agentSeen)}
              <span className="ml-[6px] text-faint">{relativeTime(info.agentSeen)}</span>
            </>
          ) : (
            <span className="font-sans text-faint">등록되지 않은 기기입니다</span>
          )}
        </Field>
      </dl>

      <SubHead
        title="프로세스 트리"
        note="이 호스트에서 관측된 프로세스와 그 뒤로 이어진 활동입니다."
      />
      <AsyncState loading={tree.loading} error={tree.error} onRetry={tree.refetch}>
        {/*
          받지 못한 것과 이을 관측이 없는 것은 뜻이 다르다. 같은 문구로 뭉치면
          수집이 없는 기기가 조회 실패로 읽힌다.
        */}
        {tree.data === null ? (
          <p className="text-[13px] text-faint">프로세스 트리를 받지 못했습니다</p>
        ) : tree.data.nodes.length === 0 ? (
          <p className="text-[13px] text-faint">
            이을 관측이 없어 프로세스 트리를 그리지 못했습니다
          </p>
        ) : (
          <AttackFlow label="프로세스 트리" steps={toAttackSteps(tree.data)} />
        )}
      </AsyncState>

      <SubHead
        title="이 호스트의 위협"
        note={alertRows.length > 0 ? `최근 ${alertRows.length}건` : undefined}
      />
      <AsyncState
        loading={alerts.loading}
        error={alerts.error}
        empty={alertRows.length === 0}
        emptyText="이 호스트에서 탐지된 위협이 없습니다"
        onRetry={alerts.refetch}
      >
        {/* 길어지면 카드 안에서 스크롤한다. 50건이 다 펼쳐지면 목록 옆 카드가 끝없이 늘어난다. */}
        <ul className="max-h-[360px] overflow-y-auto border-t border-line-2">
          {alertRows.map((a) => (
            <li
              key={a.id}
              className="relative flex flex-wrap items-center gap-x-[12px] gap-y-[4px] border-b border-line-2 py-[10px] pl-[12px] last:border-b-0"
            >
              <span
                aria-hidden
                className="absolute left-0 top-[12px] bottom-[12px] w-[2px] rounded-full"
                style={{ background: severityColors[severityTone(a.severity)] }}
              />
              <span className="min-w-[180px] flex-1">
                <span className="block text-[13px] font-semibold text-ink wrap-anywhere">
                  {a.threatName}
                </span>
                <span className="block font-mono text-[11px] text-faint wrap-anywhere">
                  {a.ruleId}
                </span>
              </span>
              <span className="flex items-center gap-[6px]">
                <Badge severity={severityTone(a.severity)}>{severityLabel(a.severity)}</Badge>
                <Badge severity={statusTone(a.status)}>{statusLabel(a.status)}</Badge>
              </span>
              <span className="font-mono text-[11px] text-faint tabular-nums">
                {absoluteTime(a.ts)}
              </span>
            </li>
          ))}
        </ul>
      </AsyncState>

      {/* 상세 화면에는 이 호스트의 사건과 최근 로그까지 있다. */}
      <div className="mt-[22px] flex flex-wrap gap-[10px]">
        <Link
          to={`/endpoints/${hostPath}`}
          className="whitespace-nowrap rounded-sm border border-line px-[16px] py-[10px] text-[13px] font-semibold !text-ink-2 hover:bg-panel-2"
        >
          상세 보기
        </Link>
        <Link
          to={`/threats?host=${hostPath}`}
          className="whitespace-nowrap rounded-sm px-[12px] py-[10px] text-[13px] font-semibold"
        >
          위협 보드에서 보기
        </Link>
      </div>
    </Card>
  )
}

function SubHead({ title, note }: { title: string; note?: string }) {
  return (
    <h3 className="mt-[24px] mb-[12px] text-[13px] font-bold text-ink">
      {title}
      {note && <small className="ml-[8px] text-[12px] font-normal text-faint">{note}</small>}
    </h3>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Fragment>
      <dt className="text-[12px] text-faint">{label}</dt>
      <dd className="min-w-0 font-mono text-[12px] text-ink-2 wrap-anywhere">{children}</dd>
    </Fragment>
  )
}

export default Endpoints
