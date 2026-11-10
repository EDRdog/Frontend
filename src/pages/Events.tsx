import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/api'
import { useApi } from '@/hooks/useApi'
import { usePagedList } from '@/hooks/usePagedList'
import type { EdrEvent } from '@/api/types'
import ActiveFilters, { type ActiveFilter } from '@/components/ui/ActiveFilters'
import AsyncState from '@/components/ui/AsyncState'
import Badge from '@/components/ui/Badge'
import Card, { panelHead } from '@/components/ui/Card'
import FocusList from '@/components/ui/FocusList'
import Select from '@/components/ui/Select'
import { absoluteTime, eventTypeLabel } from '@/lib/format'

/** 한 쪽 크기. 더 볼 것은 아래 더 보기로 이어 붙인다. */
const LIMIT = 50

const HOUR = 3_600_000

const PERIODS = [
  { value: '1', label: '최근 1시간', hours: 1 },
  { value: '24', label: '최근 24시간', hours: 24 },
  { value: '168', label: '최근 7일', hours: 168 },
  { value: '720', label: '최근 30일', hours: 720 },
  { value: 'all', label: '전체 기간', hours: null },
] as const

const DEFAULT_PERIOD = '168'

const ALL_TYPES = 'all'

/** 유형 드롭다운에 먼저 세울 순서. 여기 없는 유형(백엔드가 새로 수집하기 시작한 것)은 뒤에 붙는다. */
const TYPE_ORDER = ['process', 'script', 'network', 'file', 'dns', 'l7']

const dnsCodeLabels: Record<number, string> = {
  0: '성공',
  1: '형식 오류',
  2: '서버 실패',
  3: '도메인 없음',
  5: '거부됨',
}

/** 0 이 성공이라 "응답 코드 없음"과 절대 같이 취급하면 안 된다. */
function dnsCodeLabel(code: number): string {
  return `${code} (${dnsCodeLabels[code] ?? '실패'})`
}

/**
 * 목록 한 줄에 걸 유형별 핵심 값. 이게 없으면 펼치기 전까지 시각과 호스트만 보여서
 * 무엇을 펼쳐야 할지 고를 수가 없다.
 */
function summarize(e: EdrEvent): string {
  switch (e.type) {
    // script 는 인터프리터 실행이라 채워지는 필드가 process 와 같다. 무엇을 실행했는지는
    // 인터프리터 이름이 아니라 명령줄에 담긴 대상 경로에 있어 process 와 같은 규칙을 쓴다.
    case 'process':
    case 'script':
      return e.cmdline || e.process
    case 'network':
      return [e.protocol?.toUpperCase(), e.destPort ? `${e.destIp}:${e.destPort}` : e.destIp]
        .filter(Boolean)
        .join(' · ')
    case 'file':
      return [e.action, e.sha256].filter(Boolean).join(' · ')
    case 'dns':
      return [
        e.domain,
        e.dnsRecordType,
        e.dnsResponseCode === null ? null : dnsCodeLabel(e.dnsResponseCode),
      ]
        .filter(Boolean)
        .join(' · ')
    case 'l7':
      return [
        e.l7Protocol,
        e.domain || e.destIp,
        e.httpMethod && e.httpPath ? `${e.httpMethod} ${e.httpPath}` : e.tlsVersion,
        e.httpStatusCode,
      ]
        .filter(Boolean)
        .join(' · ')
    default:
      // 모르는 유형이면 무엇이 담겼는지 원본으로라도 보여준다.
      return e.detail
  }
}

/**
 * 펼쳤을 때 보여줄 필드. 값이 없는 항목은 뺀다. 유형별로 분기하지 않는 이유는
 * 새 유형이 생겨도 화면을 고칠 필요가 없고, 유형과 무관하게 채워지는 필드도 있기 때문이다.
 */
function detailFields(e: EdrEvent): [string, string][] {
  const pairs: [string, string | number | null][] = [
    ['프로세스', e.process],
    ['부모 프로세스', e.parent],
    ['PID', e.pid],
    ['부모 PID', e.ppid],
    ['명령줄', e.cmdline],
    ['목적지 IP', e.destIp],
    // destPort 만 없음을 0 으로 표현한다(네트워크 이벤트가 아닌 행). 포트 0 은 실제로 쓰이지 않는다.
    ['목적지 포트', e.destPort === 0 ? null : e.destPort],
    ['프로토콜', e.protocol],
    ['도메인', e.domain],
    ['파일 동작', e.action],
    ['SHA-256', e.sha256],
    ['DNS 레코드', e.dnsRecordType],
    ['DNS 응답', e.dnsAnswers?.length ? e.dnsAnswers.join(', ') : null],
    ['DNS 응답 코드', e.dnsResponseCode === null ? null : dnsCodeLabel(e.dnsResponseCode)],
    ['L7 프로토콜', e.l7Protocol],
    ['TLS 버전', e.tlsVersion],
    ['ALPN', e.alpn?.length ? e.alpn.join(', ') : null],
    ['HTTP 메서드', e.httpMethod],
    ['HTTP 경로', e.httpPath],
    ['HTTP 상태', e.httpStatusCode],
    ['User-Agent', e.httpUserAgent],
    ['발생 시각', absoluteTime(e.ts)],
    ['적재 시각', e.ingestedAt === null ? null : absoluteTime(e.ingestedAt)],
  ]
  // 0 은 실제 값이므로 빈 값으로 걸러내면 안 된다(포트 0, DNS 응답 코드 0).
  return pairs
    .filter(([, value]) => value !== null && value !== '')
    .map(([label, value]) => [label, String(value)])
}

/** 한 줄 JSON 은 눈으로 못 읽는다. 파싱에 실패하면 형식이 JSON 이 아닌 것이므로 원문을 그대로 둔다. */
function prettyDetail(detail: string): string {
  if (!detail) return '(없음)'
  try {
    return JSON.stringify(JSON.parse(detail), null, 2)
  } catch {
    return detail
  }
}

/**
 * 고른 이벤트를 짚는 값. id 가 결정적이라 새로고침으로 줄이 밀려도 같은 이벤트를 가리킨다.
 * id 가 비어 오면 내용으로 접는다. 같은 초에 같은 프로세스가 여러 이벤트를 남기므로 유형·목적지까지 넣는다.
 */
function keyOf(e: EdrEvent): string {
  return e.id || [e.ts, e.type, e.host, e.process, e.destIp, e.domain].join('|')
}

/** 크게 세울 제목. 모르는 유형의 요약은 원본 JSON 이라 제목으로 세우지 않는다. */
function titleOf(e: EdrEvent): string {
  if (e.type === 'process' || e.type === 'script') return e.process || e.cmdline || '프로세스 없음'
  // 64자 해시는 큰 글씨로 세 줄을 넘긴다. 제목에는 앞부분만, 전체 값은 아래 필드에 있다.
  if (e.type === 'file' && e.sha256) {
    return [e.action, `${e.sha256.slice(0, 16)}…`].filter(Boolean).join(' · ')
  }
  if (TYPE_ORDER.includes(e.type)) return summarize(e) || e.process || eventTypeLabel(e.type)
  return e.process || eventTypeLabel(e.type)
}

// 명령줄·원본 detail 블록. 긴 한 줄도 접어서 좁은 화면에서 옆으로 밀리지 않게 한다.
const codeBlock =
  'rounded-sm border border-line-2 bg-bg px-[14px] py-[12px] font-mono text-[12px] leading-[1.7] text-ink-2 whitespace-pre-wrap wrap-anywhere'

/** 고른 이벤트 하나: 유형·시각, 제목, 호스트·부모, 명령줄, 필드, 원본 detail. */
function EventFocus({ event, onFilterHost }: { event: EdrEvent; onFilterHost?: () => void }) {
  // 명령줄은 위에 블록으로 크게 보여주므로 필드 목록에서는 뺀다.
  const fields = detailFields(event).filter(([label]) => !(event.cmdline && label === '명령줄'))

  return (
    <>
      <div className="flex flex-wrap items-center gap-[8px]">
        {/*
          유형은 심각도가 아니다. 이 앱에서 색은 심각도 뜻으로만 쓰기 때문에
          유형에 색을 주면 위험도로 잘못 읽힌다. 배지 모양만 쓰고 색은 중립으로 둔다.
        */}
        <Badge severity="mid">{eventTypeLabel(event.type)}</Badge>
        <span className="ml-auto font-mono text-[12px] text-mid tabular-nums">
          {absoluteTime(event.ts)}
        </span>
      </div>
      <h2 className="mt-[16px] font-mono text-[20px] sm:text-[24px] font-semibold leading-[1.3] tracking-[-0.02em] text-ink wrap-anywhere">
        {titleOf(event)}
      </h2>
      <p className="mt-[4px] text-[13px] text-mid wrap-anywhere">
        <span className="font-mono font-semibold text-ink">{event.host}</span>
        {event.parent && (
          <>
            {' '}
            · 부모 <span className="font-mono font-semibold text-ink">{event.parent}</span>
          </>
        )}
      </p>

      {event.cmdline && (
        <>
          <h3 className="mt-[22px] mb-[10px] text-[13px] font-bold text-ink">명령줄</h3>
          <pre className={`m-0 ${codeBlock} text-[13px]`}>{event.cmdline}</pre>
        </>
      )}

      <h3 className="mt-[22px] mb-[10px] text-[13px] font-bold text-ink">필드</h3>
      <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-[16px] gap-y-[9px]">
        {fields.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-[12px] text-faint">{label}</dt>
            <dd className="min-w-0 font-mono text-[12px] text-ink-2 wrap-anywhere">{value}</dd>
          </Fragment>
        ))}
      </dl>

      {/*
        백엔드가 새로 수집하기 시작한 값은 위 필드에 아직 없다. 그때 화면을 고칠 때까지
        조사를 멈추지 않으려면 평탄화 전 원문을 볼 수 있어야 한다. 길 수 있어 접어 두고, 펴도 안에서 스크롤한다.
      */}
      <details className="mt-[22px]">
        <summary className="cursor-pointer text-[13px] font-bold text-ink">원본 detail</summary>
        <pre className={`mt-[10px] mb-0 max-h-[360px] overflow-y-auto ${codeBlock}`}>
          {prettyDetail(event.detail)}
        </pre>
      </details>

      {onFilterHost && (
        <button
          type="button"
          onClick={onFilterHost}
          className="mt-[20px] cursor-pointer rounded-sm border border-line bg-surface px-[14px] py-[8px] font-sans text-[12.5px] font-semibold text-ink-2 hover:bg-panel-2 active:translate-y-px"
        >
          이 호스트만 보기
        </button>
      )}
    </>
  )
}

function Events() {
  const [period, setPeriod] = useState<string>(DEFAULT_PERIOD)
  const [type, setType] = useState<string>(ALL_TYPES)
  // 오른쪽 흐름에서 고른 이벤트. 고른 게 없거나 목록에서 빠지면 맨 위(최신) 이벤트로 돌아간다.
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const focusRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const host = searchParams.get('host')
  const navigate = useNavigate()
  // 이 화면이 첫 진입이면 되돌아갈 곳이 없다. 눌러도 아무 일 없는 버튼은 두지 않는다.
  const canGoBack = window.history.length > 1

  // 호스트는 다 입력한 뒤에 보낸다. 글자마다 조회하면 서버를 의미 없이 여러 번 두드린다.
  const [hostInput, setHostInput] = useState(host ?? '')
  useEffect(() => setHostInput(host ?? ''), [host])

  /*
    상단바 검색에서 이벤트 한 건을 짚고 들어온 경우. 그 이벤트가 목록 첫 쪽에 있으리라는 보장이
    없어 따로 받아 위에 세운다. id 는 저장된 값이 아니라 행을 접어 만든 것이라 host·ts 가 함께 있어야
    서버가 찾는다. 셋 다 주소에 담겨 있으니 새로고침해도 그대로 열린다.
  */
  const pinnedId = searchParams.get('id')
  const pinnedTs = searchParams.get('ts')
  const pinned = useApi(
    () =>
      pinnedId && host && pinnedTs
        ? api.event(pinnedId, host, Number(pinnedTs))
        : Promise.resolve(null),
    [pinnedId, host, pinnedTs],
  )

  const { rows, total, hasMore, loading, loadingMore, error, moreError, loadMore, reload } =
    usePagedList<EdrEvent>(
      (page) => {
        const hours = PERIODS.find((p) => p.value === period)?.hours ?? null
        return api.eventPage({
          host: host ?? undefined,
          type: type === ALL_TYPES ? undefined : type,
          // 첫 쪽이면 고른 기간으로 열고, 다음 쪽부터는 서버가 잡은 구간을 그대로 되돌려준다.
          from: page.from ?? (hours === null ? undefined : Date.now() - hours * HOUR),
          to: page.to,
          limit: page.limit,
          offset: page.offset,
          withTotal: page.withTotal,
        })
      },
      [host, period, type],
      LIMIT,
    )

  /*
    유형은 서버에 넘겨서 거른다. 화면에서 거르면 받아 둔 쪽 안에서만 걸러져 실제와 다른 목록이 된다.
    같은 이유로 건수도 붙이지 않는다. 받은 만큼만 셀 수 있어 사실과 달라진다.
    선택지는 기본 유형에 실제로 받은 유형을 더한다. 백엔드가 새로 수집하는 유형도 눈에 띈다.
  */
  const typeOptions = useMemo(() => {
    const found = [...new Set([...TYPE_ORDER, ...rows.map((e) => e.type)])]
    return [
      { value: ALL_TYPES, label: '전체 유형' },
      ...found.map((t) => ({ value: t, label: eventTypeLabel(t) })),
    ]
  }, [rows])

  // 필터가 바뀌면 목록이 통째로 달라진다. 고른 줄을 그대로 두면 엉뚱한 줄이 남는다.
  function change(apply: () => void) {
    apply()
    setSelectedKey(null)
  }

  const focus = rows.find((e) => keyOf(e) === selectedKey) ?? rows[0] ?? null

  function select(key: string) {
    setSelectedKey(key)
    // 검색으로 연 이벤트를 보던 중이면 흐름에서 고른 것으로 넘어간다. 호스트 조건은 남긴다.
    if (pinnedId) setSearchParams(host ? { host } : {})
    // 1280 미만에서는 상세가 목록 위에 쌓여 있어 눌러도 바뀐 게 안 보인다. 상세 머리로 올려 준다.
    if (!window.matchMedia('(min-width: 1280px)').matches) {
      focusRef.current?.scrollIntoView({ block: 'start' })
    }
  }

  function commitHost() {
    const next = hostInput.trim()
    // 입력칸을 눌렀다 나오기만 해도 blur 가 온다. 값이 그대로면 보던 이벤트를 놓지 않는다.
    if (next === (host ?? '')) return
    change(() => setSearchParams(next ? { host: next } : {}))
  }

  const activeFilters: ActiveFilter[] = [
    ...(period === DEFAULT_PERIOD
      ? []
      : [
          {
            label: '기간',
            value: PERIODS.find((p) => p.value === period)?.label ?? period,
            onClear: () => change(() => setPeriod(DEFAULT_PERIOD)),
          },
        ]),
    ...(host
      ? [{ label: '호스트', value: host, onClear: () => change(() => setSearchParams({})) }]
      : []),
    ...(type === ALL_TYPES
      ? []
      : [
          {
            label: '유형',
            value: eventTypeLabel(type),
            onClear: () => change(() => setType(ALL_TYPES)),
          },
        ]),
  ]

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <div className="text-[18px] sm:text-[20px] font-bold text-ink tracking-[-0.01em]">
          수집 로그
        </div>
        <div className="mt-[6px] text-[13px] text-faint">
          엔드포인트에서 수집한 원시 이벤트입니다. 최신순으로 {LIMIT}건씩 봅니다.
        </div>
      </div>

      <Card className="px-[16px] py-[16px] sm:px-[20px]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            commitHost()
          }}
          className="grid gap-[14px] sm:grid-cols-3"
        >
          <Select
            label="기간"
            value={period}
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
            onChange={(value) => change(() => setPeriod(value))}
          />
          <label className="flex min-w-0 flex-col gap-[7px]">
            <span className="text-[11.5px] font-semibold text-faint">호스트</span>
            <input
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              onBlur={commitHost}
              placeholder="전체 호스트"
              className="w-full rounded-sm border border-line bg-surface px-[11px] py-[8px] font-mono text-[12.5px] text-ink placeholder:font-sans placeholder:text-faint"
            />
          </label>
          <Select
            label="유형"
            value={type}
            options={typeOptions}
            onChange={(value) => change(() => setType(value))}
          />
        </form>
      </Card>

      {/* 다른 화면에서 호스트를 좁혀 들어오는 경로가 있어(엔드포인트 등) 되돌아갈 길을 준다. */}
      <ActiveFilters filters={activeFilters} onBack={canGoBack ? () => navigate(-1) : undefined} />

      {/*
        포커스: 왼쪽 이벤트 하나 크게, 오른쪽 최신순 흐름. 2열은 대시보드와 같이 xl(1280) 부터.
        상단바 검색에서 이벤트 한 건을 짚고 들어왔으면 그 이벤트를 먼저 띄운다.
      */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-[16px] items-start">
        <div ref={focusRef} className="min-w-0 scroll-mt-[74px]">
          <Card className="px-[18px] py-[20px] sm:px-[28px] sm:py-[26px]">
            {pinnedId ? (
              <>
                <div className="mb-[16px] flex items-center justify-between gap-[12px] border-b border-line-2 pb-[12px]">
                  <span className="text-[12px] font-semibold text-faint">검색으로 연 이벤트</span>
                  <button
                    type="button"
                    onClick={() => setSearchParams(host ? { host } : {})}
                    className="cursor-pointer font-sans text-[12px] font-semibold text-faint hover:text-ink-2"
                  >
                    닫기
                  </button>
                </div>
                <AsyncState
                  loading={pinned.loading}
                  error={pinned.error}
                  empty={pinned.data === null}
                  emptyText="이 이벤트를 찾지 못했습니다"
                  onRetry={pinned.refetch}
                >
                  {pinned.data && <EventFocus event={pinned.data} />}
                </AsyncState>
              </>
            ) : focus ? (
              // 이벤트가 바뀌면 펼쳐 둔 원본 detail 같은 로컬 상태를 버린다.
              <EventFocus
                key={keyOf(focus)}
                event={focus}
                onFilterHost={
                  // 이미 그 호스트로 좁혀 있으면 눌러도 바뀌지 않으니 버튼을 두지 않는다.
                  host === focus.host
                    ? undefined
                    : () => change(() => setSearchParams({ host: focus.host }))
                }
              />
            ) : (
              <AsyncState
                loading={loading}
                error={error}
                empty
                emptyText="조건에 맞는 이벤트가 없습니다"
                onRetry={reload}
              >
                {null}
              </AsyncState>
            )}
          </Card>
        </div>

        <aside className="min-w-0">
          <Card className="overflow-hidden">
            <div className={panelHead}>
              <h2 className="text-[14px] font-bold text-ink">이벤트 흐름</h2>
              <span className="ml-auto font-mono text-[11px] text-faint">
                최신순 {total === null ? `${rows.length}건` : `${rows.length} / ${total}건`}
              </span>
            </div>
            <AsyncState
              loading={loading}
              error={error}
              empty={rows.length === 0}
              emptyText="조건에 맞는 이벤트가 없습니다"
              onRetry={reload}
            >
              {/* 유형에는 색을 주지 않는다. 띠는 고른 줄만 강조색, 나머지는 중립 선색이다. */}
              <FocusList
                mono
                className="max-h-[640px]"
                items={rows.map((row) => {
                  const key = keyOf(row)
                  const on = key === (pinnedId || (focus ? keyOf(focus) : null))
                  return {
                    key,
                    color: on ? 'var(--accent)' : 'var(--line)',
                    title: summarize(row) || row.process || eventTypeLabel(row.type),
                    sub: `${row.host} · ${eventTypeLabel(row.type)} · ${absoluteTime(row.ts)}`,
                  }
                })}
                currentKey={pinnedId || (focus ? keyOf(focus) : null)}
                onSelect={select}
              />
              {(moreError || hasMore) && (
                <div className="flex flex-col gap-[10px] border-t border-line-2 px-[12px] py-[12px]">
                  {moreError && (
                    <div className="text-center text-[12.5px] text-crit">{moreError}</div>
                  )}
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
                </div>
              )}
            </AsyncState>
          </Card>
        </aside>
      </section>
    </div>
  )
}

export default Events
