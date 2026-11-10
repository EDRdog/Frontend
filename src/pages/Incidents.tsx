import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { usePagedList } from '@/hooks/usePagedList'
import type { AlertStatus, Incident } from '@/api/types'
import ActiveFilters, { type ActiveFilter } from '@/components/ui/ActiveFilters'
import AsyncState from '@/components/ui/AsyncState'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import Tag from '@/components/ui/Tag'
import {
  absoluteTime,
  clockTime,
  relativeTime,
  severityColors,
  severityLabel,
  severityTone,
  statusLabel,
  statusTone,
} from '@/lib/format'
import { useAlertsStore } from '@/store/alerts'

/** 한 쪽 크기. 더 볼 것은 아래 더 보기로 이어 붙인다. */
const LIMIT = 50

const HOUR = 3_600_000

const PERIODS = [
  { value: '24', label: '최근 24시간', hours: 24 },
  { value: '168', label: '최근 7일', hours: 168 },
  { value: '720', label: '최근 30일', hours: 720 },
  { value: 'all', label: '전체 기간', hours: null },
] as const

/** 서버 기본 조회 구간과 같다. */
const DEFAULT_PERIOD = '168'

const ALL_STATUS = 'all'

const STATUS_OPTIONS = [
  { value: ALL_STATUS, label: '전체 상태' },
  { value: 'open', label: '미판단' },
  { value: 'confirmed', label: '확정' },
  { value: 'false_positive', label: '오탐' },
]

/** 체인에 세울 탐지 수. 더 많으면 외 N건으로 줄인다. 카드 하나가 화면을 다 덮지 않게 한다. */
const CHAIN_DETECTIONS = 3

function Incidents() {
  const [period, setPeriod] = useState<string>(DEFAULT_PERIOD)
  const [status, setStatus] = useState<string>(ALL_STATUS)
  // 상세에서 트리아지하면 목록도 새 status 로 다시 받아야 한다.
  const alertsVersion = useAlertsStore((s) => s.version)

  const { rows, total, hasMore, loading, loadingMore, error, moreError, loadMore, reload } =
    usePagedList<Incident>(
      (page) => {
        const hours = PERIODS.find((p) => p.value === period)?.hours ?? null
        return api.incidentPage({
          status: status === ALL_STATUS ? undefined : (status as AlertStatus),
          // 첫 쪽이면 고른 기간으로 열고, 다음 쪽부터는 서버가 잡은 구간을 그대로 되돌려준다.
          from: page.from ?? (hours === null ? undefined : Date.now() - hours * HOUR),
          to: page.to,
          limit: page.limit,
          offset: page.offset,
          withTotal: page.withTotal,
        })
      },
      [period, status, alertsVersion],
      LIMIT,
    )

  const activeFilters: ActiveFilter[] = [
    ...(period === DEFAULT_PERIOD
      ? []
      : [
          {
            label: '기간',
            value: PERIODS.find((p) => p.value === period)?.label ?? period,
            onClear: () => setPeriod(DEFAULT_PERIOD),
          },
        ]),
    ...(status === ALL_STATUS
      ? []
      : [
          {
            label: '상태',
            value: statusLabel(status),
            onClear: () => setStatus(ALL_STATUS),
          },
        ]),
  ]

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <div className="text-[18px] sm:text-[20px] font-bold text-ink tracking-[-0.01em]">사건</div>
        <div className="mt-[6px] text-[13px] text-faint">
          같은 공격 체인으로 이어진 알림을 하나의 사건으로 묶어 봅니다.
        </div>
      </div>

      <Card className="px-[16px] py-[16px] sm:px-[20px]">
        <div className="grid gap-[14px] sm:grid-cols-2">
          <Select
            label="기간"
            value={period}
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
            onChange={setPeriod}
          />
          <Select label="상태" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        </div>
      </Card>

      <ActiveFilters filters={activeFilters} />

      {/* 사건마다 카드 한 장. 누르면 상세(계보, 구성 알림, 증거 사슬, 타임라인)로 간다. */}
      <section aria-label="사건 목록" className="flex flex-col gap-[12px]">
        <div className="flex items-baseline justify-between gap-[12px] px-[4px]">
          <h2 className="text-[14px] font-bold text-ink">사건 목록</h2>
          <span className="font-mono text-[12px] text-faint">
            {total === null ? `${rows.length}건` : `${rows.length} / ${total}건`}
          </span>
        </div>
        <AsyncState
          loading={loading}
          error={error}
          empty={rows.length === 0}
          emptyText="조건에 맞는 사건이 없습니다"
          onRetry={reload}
        >
          {rows.map((row) => (
            <IncidentCard key={row.id} incident={row} />
          ))}
          {moreError && <div className="text-center text-[12.5px] text-crit">{moreError}</div>}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full cursor-pointer rounded-sm border border-line bg-surface px-[14px] py-[9px] text-[12.5px] font-semibold text-ink-2 disabled:cursor-default disabled:text-faint"
            >
              {loadingMore ? '불러오는 중' : '더 보기'}
            </button>
          )}
        </AsyncState>
      </section>
    </div>
  )
}

/** 사건 카드: 심각도·상태·MITRE, 대표 위협, 호스트·룰, 기간, 그리고 체인. */
function IncidentCard({ incident }: { incident: Incident }) {
  const tone = severityTone(incident.severity)
  const [first, ...rest] = incident.threatNames

  return (
    <Link
      to={`/incidents/${encodeURIComponent(incident.id)}`}
      className="group block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
    >
      <Card className="relative grid gap-x-[24px] gap-y-[14px] py-[18px] pl-[24px] pr-[18px] sm:pr-[22px] sm:grid-cols-[minmax(0,1fr)_auto] transition-colors duration-[160ms] group-hover:bg-panel-2">
        {/* 심각도 띠(2px). 배경 전체를 칠하지 않는다. */}
        <span
          aria-hidden
          className="absolute left-0 top-[18px] bottom-[18px] w-[2px] rounded-full"
          style={{ background: severityColors[tone] }}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-[6px]">
            <Badge severity={tone}>{severityLabel(incident.severity)}</Badge>
            <Badge severity={statusTone(incident.status)}>{statusLabel(incident.status)}</Badge>
            {incident.mitre.map((m) => (
              <Tag key={m}>{m}</Tag>
            ))}
          </div>
          <h3 className="mt-[8px] text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-ink wrap-anywhere">
            {first ?? '위협명 없음'}
            {rest.length > 0 && <span className="font-medium text-faint"> 외 {rest.length}건</span>}
          </h3>
          {/* 대표 위협명 아래에 detector 룰 원문을 깐다. 조사할 때 대조하는 값은 ruleId 다. */}
          <p className="mt-[2px] font-mono text-[12px] text-mid wrap-anywhere">
            <span className="text-ink-2">{incident.host}</span> · {incident.ruleIds.join(', ')}
          </p>
        </div>
        <div className="font-mono text-[11.5px] text-faint sm:text-right sm:whitespace-nowrap">
          <b className="mb-[2px] block font-sans text-[13px] font-semibold text-ink-2">
            {relativeTime(incident.lastTs)}
          </b>
          알림 {incident.alertCount} · {absoluteTime(incident.firstTs)} ~{' '}
          {clockTime(incident.lastTs)}
        </div>
        <Chain incident={incident} tone={severityColors[tone]} />
      </Card>
    </Link>
  )
}

/**
 * 사건이 어디서 시작해 무엇을 일으켰는지 잇는다.
 * 목록 응답에는 계보(lineage)가 없어(상세에서만 온다) 루트 프로세스와 거기서 난 탐지만 잇는다.
 * 루트 프로세스가 비면 원본 이벤트를 못 찾은 것이다. 프로세스명을 지어내지 않고 그렇다고 밝힌다.
 */
function Chain({ incident, tone }: { incident: Incident; tone: string }) {
  if (!incident.rootProcess) {
    return (
      <p className="text-[12.5px] leading-[1.5] text-faint sm:col-span-2">
        이 사건을 이을 관측이 없어 계보를 그리지 못했습니다. 루트 프로세스 확인 불가.
      </p>
    )
  }

  const shown = incident.threatNames.slice(0, CHAIN_DETECTIONS)
  const more = incident.threatNames.length - shown.length

  return (
    <ol aria-label="사건 체인" className="flex flex-wrap items-center gap-[8px] sm:col-span-2">
      <li className="max-w-full">
        <ChainNode caption="루트 프로세스" title={incident.rootProcess} mono />
      </li>
      {shown.length > 0 && (
        <li aria-hidden className="flex items-center gap-[6px] px-[4px] text-[11px] text-faint">
          탐지
          <svg width="22" height="8" viewBox="0 0 22 8" fill="none">
            <path
              d="M0 4h20M17 1l3 3-3 3"
              stroke="var(--line)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </li>
      )}
      {shown.map((name, i) => (
        <li key={`${name}#${i}`} className="max-w-full">
          {/* 결과 단계는 아래 2px 를 사건 심각도 색으로 긋는다(DESIGN.md 증거 체인). */}
          <ChainNode caption="탐지" title={name} underline={tone} />
        </li>
      ))}
      {more > 0 && <li className="px-[4px] text-[12px] text-faint">외 {more}건</li>}
    </ol>
  )
}

function ChainNode({
  caption,
  title,
  mono = false,
  underline,
}: {
  caption: string
  title: string
  /** 프로세스명은 mono, 한글 위협명은 본문 글꼴 */
  mono?: boolean
  underline?: string
}) {
  return (
    <span
      className="inline-flex max-w-full flex-col rounded-sm border border-line-2 bg-panel-2 px-[12px] py-[7px]"
      style={underline ? { borderBottom: `2px solid ${underline}` } : undefined}
    >
      <span className="text-[10.5px] text-faint">{caption}</span>
      <span
        className={`text-[12.5px] font-semibold text-ink wrap-anywhere ${mono ? 'font-mono' : ''}`}
      >
        {title}
      </span>
    </span>
  )
}

export default Incidents
