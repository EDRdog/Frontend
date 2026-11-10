import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import type {
  Correlation,
  CorrelationNodeKind,
  DnsLookupStatus,
  ForwardLookup,
  RelationOrigin,
  ReverseLookup,
  TopologyNode,
} from '@/api/types'
import AsyncState from '@/components/ui/AsyncState'
import Badge from '@/components/ui/Badge'
import Card, { panelHead } from '@/components/ui/Card'
import RelationGraph, {
  type GraphEdge,
  type GraphNode,
  type GraphTone,
} from '@/components/ui/RelationGraph'
import Tag from '@/components/ui/Tag'
import { useApi } from '@/hooks/useApi'
import { absoluteTime } from '@/lib/format'

type NodeVariant = 'solid' | 'outline' | 'dashed'
type EdgeLine = 'solid' | 'dashed' | 'dotted'

type EdgeStyle = { tone: GraphTone; line: EdgeLine }

/**
 * 엣지 출처. 셋을 같게 보여주면 추측이 관측으로 읽힌다. 색과 선 모양을 둘 다 갈라 놓는다.
 */
const originMeta: Record<RelationOrigin, EdgeStyle & { label: string; note: string }> = {
  OBSERVED: {
    label: '관측',
    note: '수집한 이벤트에 그대로 있던 사실입니다.',
    tone: 'ink',
    line: 'solid',
  },
  INFERRED: {
    label: '추정',
    note: '관측 두 건을 시각과 IP 로 이어 붙인 추측입니다. 근거는 아래에 적습니다.',
    tone: 'high',
    line: 'dashed',
  },
  LIVE_DNS: {
    label: '실시간 DNS',
    note: '지금 물어본 결과입니다. 조회 시점 상태일 뿐 우리 관측이 아닙니다.',
    tone: 'accent',
    line: 'dotted',
  },
}

const relationLabels: Record<string, string> = {
  RESOLVED_TO: '이름 해석',
  ALIAS_OF: '별칭',
  CONNECTED_VIA: '경유 연결',
  QUERIED: 'DNS 질의',
  CONNECTED: '연결',
  PTR_CANDIDATE: 'PTR 후보',
}

/** 모르는 관계 유형은 감추지 말고 원문 그대로 보여준다. */
function relationLabel(relation: string): string {
  return relationLabels[relation] ?? relation
}

type NodeStyle = { caption: string; tone: GraphTone; variant: NodeVariant }

const corrNodeMeta: Record<CorrelationNodeKind, NodeStyle> = {
  HOST: { caption: '엔드포인트', tone: 'accent', variant: 'outline' },
  PROCESS: { caption: '프로세스', tone: 'high', variant: 'outline' },
  DOMAIN: { caption: '도메인', tone: 'ink', variant: 'outline' },
  IP: { caption: 'IP', tone: 'mid', variant: 'outline' },
  // PTR 이름은 우리가 관측한 적 없는 후보라 점선으로 확정을 피한다.
  PTR_NAME: { caption: 'PTR 후보', tone: 'mid', variant: 'dashed' },
}

const dnsStatusMeta: Record<
  DnsLookupStatus,
  { label: string; tone: 'good' | 'mid' | 'crit'; note: string }
> = {
  OK: { label: '조회 성공', tone: 'good', note: '' },
  NOT_FOUND: {
    label: '기록 없음',
    tone: 'mid',
    note: 'DNS 서버가 그런 이름은 없다고 답했습니다. 조회 자체는 성공했습니다.',
  },
  FAILED: {
    label: '조회 실패',
    tone: 'crit',
    note: '묻지 못했습니다. 기록이 없다는 뜻이 아닙니다.',
  },
}

function dnsStatus(status: string) {
  return (
    dnsStatusMeta[status as DnsLookupStatus] ?? { label: status, tone: 'mid' as const, note: '' }
  )
}

function corrGraphNodes(correlation: Correlation): GraphNode[] {
  return correlation.nodes.map((node) => {
    const meta = corrNodeMeta[node.kind] ?? corrNodeMeta.DOMAIN
    const isTarget = node.value === correlation.target.value
    return {
      id: node.id,
      caption: meta.caption,
      label: node.value,
      sublabel: isTarget ? '조회 대상' : undefined,
      tone: meta.tone,
      variant: isTarget ? 'solid' : meta.variant,
      tooltip: [
        meta.caption,
        node.value,
        node.kind === 'PTR_NAME'
          ? 'PTR 이 답한 이름 후보입니다. IP 의 이름이 아닙니다.'
          : isTarget
            ? '지금 조회한 대상입니다.'
            : '',
      ].filter(Boolean),
    }
  })
}

function corrGraphEdges(correlation: Correlation): GraphEdge[] {
  const labelOf = new Map(correlation.nodes.map((node) => [node.id, node.value]))
  return correlation.edges.map((edge) => {
    const origin = originMeta[edge.origin]
    return {
      from: edge.from,
      to: edge.to,
      label: relationLabel(edge.relation),
      line: origin.line,
      tone: origin.tone,
      emphasis: edge.origin === 'OBSERVED',
      tooltip: [
        `${labelOf.get(edge.from) ?? edge.from} → ${labelOf.get(edge.to) ?? edge.to}`,
        `관계 ${relationLabel(edge.relation)}`,
        `출처 ${origin.label}`,
        origin.note,
        `관측 ${edge.observations}건`,
        edge.firstSeen === null ? '관측 시각 없음' : `처음 관측 ${absoluteTime(edge.firstSeen)}`,
        edge.lastSeen === null ? '' : `마지막 관측 ${absoluteTime(edge.lastSeen)}`,
        edge.basis ? `근거 ${edge.basis}` : '',
      ].filter(Boolean),
    }
  })
}

/** 범례 줄 머리(관계의 출처, 노드). */
function LegendTitle({ children }: { children: string }) {
  return (
    <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-faint">
      {children}
    </span>
  )
}

/** 범례 한 칸: 견본, 이름, 짧은 설명. 그래프 아래에 가로로 흘려 놓는다. */
function LegendItem({
  mark,
  label,
  note,
}: {
  mark: React.ReactNode
  label: string
  note?: string
}) {
  return (
    <span className="inline-flex items-center gap-[8px]">
      <span className="flex h-[12px] w-[22px] shrink-0 items-center justify-center">{mark}</span>
      <span className="shrink-0">{label}</span>
      {note && <small className="text-[11.5px] text-faint">{note}</small>}
    </span>
  )
}

/** 그래프 노드가 카드라서 범례 견본도 작은 사각 테두리로 둔다. */
function NodeMark({ tone, variant = 'outline' }: { tone: GraphTone; variant?: NodeVariant }) {
  const stroke = `var(--${tone})`
  return (
    <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden>
      <rect
        x="1"
        y="1"
        width="18"
        height="10"
        rx="2.5"
        fill="none"
        stroke={stroke}
        strokeWidth={variant === 'solid' ? 2 : 1}
        strokeDasharray={variant === 'dashed' ? '3 2.5' : undefined}
      />
    </svg>
  )
}

function LineMark({ tone, line }: { tone: GraphTone; line: EdgeLine }) {
  const dash = line === 'dashed' ? '5 3' : line === 'dotted' ? '1.5 3' : undefined
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden>
      <line
        x1="1"
        y1="4"
        x2="21"
        y2="4"
        stroke={`var(--${tone})`}
        strokeWidth="2"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  )
}

function DnsAddressList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <div className="text-[12.5px] text-faint">{empty}</div>
  return (
    <div className="flex flex-wrap gap-[6px]">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-xs bg-panel px-[8px] py-[3px] font-mono text-[12px] text-ink-2"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function LookupBlock({
  title,
  note,
  status,
  error,
  children,
}: {
  title: string
  note: string
  status: string
  error: string | null
  children: React.ReactNode
}) {
  const meta = dnsStatus(status)
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <span className="text-[12.5px] font-semibold text-ink">{title}</span>
        <Badge severity={meta.tone}>{meta.label}</Badge>
      </div>
      <div className="text-[11.5px] leading-[1.6] text-faint">{note}</div>
      {meta.note && <div className="text-[12px] leading-[1.6] text-ink-2">{meta.note}</div>}
      {/* FAILED 는 왜 못 물었는지가 판단 근거라 error 를 그대로 보여준다. */}
      {status === 'FAILED' && error && (
        <div className="rounded-sm border border-line bg-panel px-[10px] py-[7px] font-mono text-[11.5px] text-crit">
          {error}
        </div>
      )}
      {status === 'OK' && children}
    </div>
  )
}

function LiveDnsCard({
  forward,
  reverse,
}: {
  forward: ForwardLookup | null
  reverse: ReverseLookup | null
}) {
  return (
    <Card className="flex flex-col gap-[16px] px-[18px] py-[18px]">
      <div>
        <h2 className="text-[14px] font-bold text-ink">실시간 DNS 조회</h2>
        <div className="mt-[5px] text-[11.5px] leading-[1.6] text-faint">
          조회 버튼을 누른 시점에 DNS 서버에 물어본 결과입니다. 우리가 수집한 이벤트와는 무관합니다.
        </div>
      </div>

      {forward && (
        <LookupBlock
          title="정방향 조회"
          note="이 도메인이 지금 어느 주소를 가리키는지."
          status={forward.status}
          error={forward.error}
        >
          <DnsAddressList items={forward.addresses} empty="응답에 주소가 없습니다" />
        </LookupBlock>
      )}

      {reverse && (
        <LookupBlock
          title="PTR 후보"
          note="PTR 이름은 IP 소유자가 임의로 적을 수 있습니다. 이 IP 의 이름이 아니라 후보로만 봅니다."
          status={reverse.status}
          error={reverse.error}
        >
          <DnsAddressList items={reverse.ptrNames} empty="응답에 이름이 없습니다" />
        </LookupBlock>
      )}

      {!forward && !reverse && (
        <div className="text-[12.5px] text-faint">이 대상에는 조회 결과가 없습니다.</div>
      )}
    </Card>
  )
}

/** INFERRED 는 무엇을 근거로 이었는지까지 봐야 믿을지 말지 정할 수 있다. */
function InferredBasis({ correlation }: { correlation: Correlation }) {
  const labelOf = new Map(correlation.nodes.map((node) => [node.id, node.value]))
  const inferred = correlation.edges.filter((edge) => edge.origin === 'INFERRED')
  if (inferred.length === 0) return null

  return (
    <div className="flex flex-col gap-[8px] rounded-sm bg-panel-2 px-[14px] py-[12px]">
      <div className="text-[12.5px] font-semibold text-ink">추정 관계의 근거</div>
      {inferred.map((edge, i) => (
        <div key={`${edge.from}-${edge.to}-${i}`} className="text-[12px] leading-[1.6] text-faint">
          <span className="font-mono text-ink-2">
            {labelOf.get(edge.from) ?? edge.from} → {labelOf.get(edge.to) ?? edge.to}
          </span>
          <span className="mx-[6px]">{relationLabel(edge.relation)}</span>
          <span>{edge.basis ?? '근거가 함께 오지 않았습니다'}</span>
        </div>
      ))}
    </div>
  )
}

/** 조회 예시 칩. 지어낸 값을 두면 관측된 목적지로 오해하므로 토폴로지에서만 가져온다. */
function useDestinationExamples(): string[] {
  const topology = useApi(() => api.topology({ limit: 50 }))
  return useMemo(
    () =>
      (topology.data?.nodes ?? [])
        .filter((node: TopologyNode) => node.kind === 'destination')
        .slice(0, 6)
        .map((node) => node.label),
    [topology.data],
  )
}

function Lookup() {
  const [input, setInput] = useState('')
  const [target, setTarget] = useState('')
  const examples = useDestinationExamples()

  const correlation = useApi(
    () => (target ? api.correlate(target, { liveDns: true }) : Promise.resolve(null)),
    [target],
  )

  const data = correlation.data
  const nodes = useMemo(() => (data ? corrGraphNodes(data) : []), [data])
  const edges = useMemo(() => (data ? corrGraphEdges(data) : []), [data])

  const lookup = (value: string) => {
    const trimmed = value.trim()
    setInput(trimmed)
    setTarget(trimmed)
  }

  const hasInferred = data?.edges.some((edge) => edge.origin === 'INFERRED') ?? false

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <div className="text-[18px] font-bold tracking-[-0.01em] text-ink sm:text-[20px]">
          IP·도메인 조회
        </div>
        <div className="mt-[6px] text-[13px] text-faint">
          IP 나 도메인 하나가 우리 관측에서 무엇과 이어져 있는지 봅니다. 관측된 사실과 추측, 지금
          물어본 결과를 갈라 그립니다.
        </div>
      </div>

      {/* 검색 중심: 큰 검색창과 관측된 목적지 칩 */}
      <Card className="flex flex-col items-center gap-[16px] px-[16px] py-[28px] text-center sm:px-[32px] sm:py-[40px]">
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink sm:text-[24px]">
          무엇과 이어져 있는지 찾아봅니다
        </h2>
        <form
          className="flex w-full max-w-[640px] items-center gap-[10px] rounded-sm border border-line bg-bg py-[6px] pl-[16px] pr-[6px] focus-within:border-accent"
          onSubmit={(e) => {
            e.preventDefault()
            lookup(input)
          }}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-[18px] w-[18px] flex-none fill-none stroke-mid stroke-2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="도메인 또는 IP"
            aria-label="상관 분석 대상"
            className="h-[42px] min-w-0 flex-1 bg-transparent font-mono text-[15px] text-ink outline-none placeholder:font-sans placeholder:text-faint sm:text-[17px]"
          />
          <button
            type="submit"
            disabled={input.trim() === ''}
            className="h-[42px] shrink-0 rounded-pill bg-accent px-[22px] font-sans text-[13px] font-semibold text-white transition-colors duration-[140ms] enabled:cursor-pointer enabled:hover:bg-accent-strong disabled:opacity-50"
          >
            조회
          </button>
        </form>

        {examples.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-[7px]">
            <span className="mr-[2px] text-[11.5px] text-faint">관측된 목적지</span>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => lookup(example)}
                aria-pressed={example === target}
                className={`max-w-full cursor-pointer truncate rounded-pill border bg-surface px-[11px] py-[4px] font-mono text-[11.5px] transition-colors duration-[140ms] hover:border-accent-ink hover:text-accent-ink ${
                  example === target
                    ? 'border-accent-ink text-accent-ink'
                    : 'border-line text-ink-2'
                }`}
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </Card>

      {target === '' ? (
        <div className="py-[12px] text-center text-[12.5px] text-faint">
          대상을 입력하면 관계를 그립니다.
        </div>
      ) : (
        <>
          <Card className="overflow-hidden">
            <AsyncState
              loading={correlation.loading}
              error={correlation.error}
              onRetry={correlation.refetch}
            >
              {data && (
                <>
                  {/* 결과 머리: 대상 종류, 값, 관측 수, 위협 목록으로 가는 길 */}
                  <div className={`${panelHead} flex-wrap`}>
                    <Tag>{data.target.kind === 'IP' ? 'IP' : '도메인'}</Tag>
                    <h2 className="min-w-0 font-mono text-[14px] font-semibold text-ink wrap-anywhere">
                      {data.target.value}
                    </h2>
                    <span className="font-mono text-[11px] text-faint">
                      관측 이벤트 {data.observedEvents.toLocaleString()}건
                    </span>
                    <Link
                      to={`/threats?${data.target.kind === 'IP' ? 'destIp' : 'domain'}=${encodeURIComponent(data.target.value)}`}
                      className="ml-auto text-[12px] font-semibold hover:underline"
                    >
                      이 목적지의 위협 보기 →
                    </Link>
                  </div>

                  <div className="flex flex-col gap-[14px] px-[10px] py-[12px] sm:px-[18px] sm:py-[16px]">
                    {/* 관측이 0 이면 그래프만 비워 두지 않고 무엇이 없는 것인지 말한다. */}
                    {data.observedEvents === 0 && (
                      <div className="flex flex-col gap-[4px] rounded-sm bg-panel-2 px-[14px] py-[11px]">
                        <div className="text-[12.5px] font-semibold text-ink-2">
                          우리가 관측한 적 없는 대상입니다
                        </div>
                        <div className="text-[12.5px] leading-[1.6] text-faint">
                          이 대상이 들어간 이벤트가 수집 기록에 없습니다. 아래에 관계가 그려진다면
                          지금 물어본 DNS 결과이지 우리 관측이 아닙니다.
                        </div>
                      </div>
                    )}

                    {nodes.length === 0 ? (
                      <div className="py-[36px] text-center text-[12.5px] text-faint">
                        그릴 관계가 없습니다
                      </div>
                    ) : (
                      <RelationGraph
                        nodes={nodes}
                        edges={edges}
                        height={400}
                        label={`${data.target.value} 상관 관계 그래프`}
                      />
                    )}
                  </div>

                  {/* 범례: 출처별 선 모양과 노드 종류 */}
                  <div className="flex flex-col gap-[10px] border-t border-line-2 px-[18px] py-[16px] text-[12px] text-ink-2">
                    <div className="flex flex-wrap items-center gap-x-[22px] gap-y-[10px]">
                      <LegendTitle>관계의 출처</LegendTitle>
                      {(Object.keys(originMeta) as RelationOrigin[]).map((origin) => (
                        <LegendItem
                          key={origin}
                          mark={
                            <LineMark
                              tone={originMeta[origin].tone}
                              line={originMeta[origin].line}
                            />
                          }
                          label={originMeta[origin].label}
                          note={originMeta[origin].note}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-[22px] gap-y-[10px]">
                      <LegendTitle>노드</LegendTitle>
                      {(Object.keys(corrNodeMeta) as CorrelationNodeKind[]).map((kind) => (
                        <LegendItem
                          key={kind}
                          mark={
                            <NodeMark
                              tone={corrNodeMeta[kind].tone}
                              variant={corrNodeMeta[kind].variant}
                            />
                          }
                          label={corrNodeMeta[kind].caption}
                          note={kind === 'PTR_NAME' ? 'IP 의 이름이 아니라 후보입니다' : undefined}
                        />
                      ))}
                      <LegendItem
                        mark={<NodeMark tone="accent" variant="solid" />}
                        label="조회 대상"
                        note="테두리가 굵은 카드입니다"
                      />
                    </div>
                    <p className="text-[11.5px] leading-[1.6] text-faint">
                      같은 두 점 사이라도 출처가 다르면 관계를 따로 그립니다.
                    </p>
                  </div>
                </>
              )}
            </AsyncState>
          </Card>

          {/* 그래프 아래: 추정 근거와 실시간 DNS. 근거가 없으면 DNS 카드가 폭을 다 쓴다. */}
          {data && !correlation.loading && (
            <section
              className={`grid grid-cols-1 items-start gap-[16px] ${
                hasInferred ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''
              }`}
            >
              <InferredBasis correlation={data} />
              {data.liveDns ? (
                <LiveDnsCard forward={data.liveDns.forward} reverse={data.liveDns.reverse} />
              ) : (
                <Card className="px-[18px] py-[18px] text-[12.5px] leading-[1.6] text-faint">
                  실시간 DNS 조회를 하지 않았습니다.
                </Card>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default Lookup
