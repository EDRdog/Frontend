import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import type { Topology, TopologyNode } from '@/api/types'
import ActiveFilters, { type ActiveFilter } from '@/components/ui/ActiveFilters'
import AsyncState from '@/components/ui/AsyncState'
import Card, { panelHead } from '@/components/ui/Card'
import FilterChips from '@/components/ui/FilterChips'
import RelationGraph, {
  type GraphEdge,
  type GraphNode,
  type GraphTone,
} from '@/components/ui/RelationGraph'
import { useApi } from '@/hooks/useApi'
import { absoluteTime, unknownable } from '@/lib/format'

const LIMITS = ['50', '100', '200', '500']

/**
 * 서버 기본값은 200 이지만 그만큼을 한 그림에 넣으면 읽을 수가 없다.
 * 실제로 엔드포인트 하나가 목적지 200곳으로 뻗어 카드가 200장 깔린다. 좁혀서 보는 게 조사에 맞다.
 * 더 봐야 하면 관계 수를 올리거나 검색으로 범위를 좁히라고 위 배너가 안내한다.
 */
const DEFAULT_LIMIT = '50'

type NodeVariant = 'solid' | 'outline' | 'dashed'
type EdgeLine = 'solid' | 'dashed' | 'dotted'

function endpointSublabel(node: TopologyNode): string | undefined {
  const parts: string[] = []
  if (node.riskScore !== null) parts.push(`위험 ${node.riskScore}`)
  if (node.openAlerts) parts.push(`알림 ${node.openAlerts}`)
  return parts.length ? parts.join(' · ') : undefined
}

function topologyGraphNodes(nodes: TopologyNode[]): GraphNode[] {
  return nodes.map((node) => {
    if (node.kind === 'endpoint') {
      return {
        id: node.id,
        caption: '엔드포인트',
        label: node.label,
        sublabel: endpointSublabel(node),
        tone: 'accent',
        // 알림이 있는 엔드포인트가 조사 시작점이다.
        variant: (node.openAlerts ?? 0) > 0 ? 'solid' : 'outline',
        tooltip: [
          '엔드포인트',
          node.label,
          `위험도 ${unknownable(node.riskScore)}`,
          `열린 알림 ${unknownable(node.openAlerts)}`,
        ],
      }
    }
    if (node.kind === 'destination') {
      // destKind 가 ip 면 도메인을 잡지 못한 것이다. 서버가 이름을 지어 붙이지 않으므로 화면도 IP 그대로 둔다.
      const isIp = node.destKind === 'ip'
      return {
        id: node.id,
        caption: '목적지',
        label: node.label,
        sublabel: isIp ? 'IP (도메인 미확인)' : undefined,
        tone: 'mid',
        variant: 'outline',
        tooltip: [
          '목적지',
          node.label,
          isIp
            ? '이 연결에서는 도메인을 잡지 못해 IP 로만 남았습니다.'
            : '이벤트에 도메인이 함께 남은 연결입니다.',
        ],
      }
    }
    return {
      id: node.id,
      caption: '도메인 묶음',
      label: node.label,
      sublabel: `목적지 ${unknownable(node.members)}개`,
      tone: 'high',
      variant: 'outline',
      tooltip: ['도메인 묶음', node.label, `묶인 목적지 ${unknownable(node.members)}개`],
    }
  })
}

function topologyGraphEdges(topology: Topology): GraphEdge[] {
  const labelOf = new Map(topology.nodes.map((node) => [node.id, node.label]))
  return topology.edges.map((edge) => {
    // 알림이 하나라도 있으면 조사 대상이다. 관측만 된 관계와 반드시 갈라 그린다.
    const alerted = edge.alerts > 0
    return {
      from: edge.from,
      to: edge.to,
      label: alerted ? `이벤트 ${edge.events} · 알림 ${edge.alerts}` : `이벤트 ${edge.events}`,
      line: alerted ? 'solid' : 'dashed',
      tone: alerted ? 'crit' : 'mid',
      emphasis: alerted,
      tooltip: [
        `${labelOf.get(edge.from) ?? edge.from} → ${labelOf.get(edge.to) ?? edge.to}`,
        alerted ? '알림이 난 관계입니다' : '관측만 된 관계입니다',
        `이벤트 ${edge.events}건 · 알림 ${edge.alerts}건`,
        edge.protocols.length ? `프로토콜 ${edge.protocols.join(', ')}` : '프로토콜 미상',
        `마지막 관측 ${absoluteTime(edge.lastSeen)}`,
      ],
    }
  })
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

/** 범례 줄 머리(노드, 관계). */
function LegendTitle({ children }: { children: string }) {
  return (
    <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-faint">
      {children}
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

/** 그래프 노드는 링크가 아니라서, 목적지에서 위협 목록으로 넘어갈 길을 칩으로 따로 둔다. */
function DestinationLinks({ nodes }: { nodes: TopologyNode[] }) {
  const destinations = nodes.filter((node) => node.kind === 'destination')
  if (destinations.length === 0) return null

  return (
    // 관계 수 500 이면 목적지도 수백 곳이다. 페이지가 끝없이 길어지지 않게 안에서 스크롤한다.
    <div className="flex max-h-[200px] flex-wrap items-center gap-[7px] overflow-y-auto">
      <span className="mr-[2px] text-[11.5px] text-faint">
        목적지 목록 · 눌러서 이 목적지 때문에 난 위협 보기
      </span>
      {destinations.map((node) => (
        <Link
          key={node.id}
          to={`/threats?${node.destKind === 'ip' ? 'destIp' : 'domain'}=${encodeURIComponent(node.label)}`}
          className="max-w-full truncate rounded-pill border border-line bg-surface px-[11px] py-[4px] font-mono text-[11.5px] !text-ink-2 transition-colors duration-[140ms] hover:border-accent-ink hover:!text-accent-ink"
        >
          {node.label}
        </Link>
      ))}
    </div>
  )
}

/** 응답이 잘렸으면 반드시 알린다. 알리지 않으면 이게 전부라고 읽힌다. */
function TruncatedNotice({ total, shown }: { total: number; shown: number }) {
  return (
    <div className="flex flex-col gap-[2px] rounded-sm border-l-2 border-med bg-panel-2 px-[14px] py-[12px]">
      <div className="text-[12.5px] font-semibold text-med">일부만 표시하고 있습니다</div>
      <div className="text-[12.5px] leading-[1.6] text-ink-2">
        조회 구간의 관계 {total.toLocaleString()}건 중 {shown.toLocaleString()}건만 그렸습니다. 관계
        수를 늘리거나 검색으로 범위를 좁히세요.
      </div>
    </div>
  )
}

function Intelligence() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(DEFAULT_LIMIT)

  const topology = useApi(
    () => api.topology({ q: query || undefined, limit: Number(limit) }),
    [query, limit],
  )

  const data = topology.data
  const nodes = useMemo(() => (data ? topologyGraphNodes(data.nodes) : []), [data])
  const edges = useMemo(() => (data ? topologyGraphEdges(data) : []), [data])

  const filters: ActiveFilter[] = query
    ? [
        {
          label: '검색',
          value: query,
          onClear: () => {
            setSearch('')
            setQuery('')
          },
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <div className="text-[18px] font-bold tracking-[-0.01em] text-ink sm:text-[20px]">
          관계 분석
        </div>
        <div className="mt-[6px] text-[13px] text-faint">
          엔드포인트가 외부로 어디까지 나갔는지 전체를 봅니다.
        </div>
      </div>

      {/* 조건 줄: 검색, 관계 수, 서버가 적용한 조회 구간 */}
      <div className="flex flex-wrap items-center gap-[10px]">
        <form
          className="flex min-w-[220px] flex-1 items-center gap-[10px]"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(search.trim())
          }}
        >
          <span className="shrink-0 text-[12px] text-faint">호스트·목적지 검색</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="부분 일치. 입력 후 Enter"
            aria-label="호스트 또는 목적지 검색"
            className="min-w-0 flex-1 rounded-sm border border-line bg-surface px-[11px] py-[8px] font-mono text-[12.5px] text-ink placeholder:font-sans placeholder:text-faint"
          />
        </form>
        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="text-[12px] text-faint">관계 수</span>
          <FilterChips
            chips={LIMITS.map((value) => ({
              label: `${value}개`,
              active: limit === value,
              onClick: () => setLimit(value),
            }))}
          />
        </div>
        <span className="ml-auto font-mono text-[11.5px] text-faint">
          조회 구간 {data ? `${absoluteTime(data.from)} ~ ${absoluteTime(data.to)}` : '불러오는 중'}
        </span>
      </div>

      <ActiveFilters filters={filters} />

      {data?.truncated && (
        <TruncatedNotice total={data.totalRelations} shown={data.shownRelations} />
      )}

      {/* 그래프 중심: 화면 폭 전체를 그래프에 주고 범례는 그 아래로 내린다. */}
      <Card className="overflow-hidden">
        <div className={`${panelHead} flex-wrap`}>
          <h2 className="text-[14px] font-bold text-ink">egress 토폴로지</h2>
          <span className="text-[12px] text-faint">
            엔드포인트에서 외부로 나간 연결을 목적지별로 묶어 그립니다
          </span>
        </div>
        <div className="px-[10px] py-[12px] sm:px-[18px] sm:py-[16px]">
          <AsyncState
            loading={topology.loading}
            error={topology.error}
            empty={nodes.length === 0}
            emptyText={
              query ? '검색 조건에 맞는 연결이 없습니다' : '조회 구간에 외부 연결이 없습니다'
            }
            onRetry={topology.refetch}
          >
            <RelationGraph
              nodes={nodes}
              edges={edges}
              height={520}
              label="egress 토폴로지 그래프"
            />
          </AsyncState>
        </div>
        <div className="flex flex-col gap-[10px] border-t border-line-2 px-[18px] py-[16px] text-[12px] text-ink-2">
          <div className="flex flex-wrap items-center gap-x-[22px] gap-y-[10px]">
            <LegendTitle>노드</LegendTitle>
            <LegendItem mark={<NodeMark tone="accent" />} label="엔드포인트" />
            <LegendItem
              mark={<NodeMark tone="accent" variant="solid" />}
              label="알림 있는 엔드포인트"
            />
            <LegendItem
              mark={<NodeMark tone="mid" />}
              label="목적지"
              note="도메인을 잡지 못한 연결은 IP 그대로 둡니다"
            />
            <LegendItem
              mark={<NodeMark tone="high" />}
              label="도메인 묶음"
              note="같은 등록 도메인끼리 묶은 것"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-[22px] gap-y-[10px]">
            <LegendTitle>관계</LegendTitle>
            <LegendItem
              mark={<LineMark tone="crit" line="solid" />}
              label="알림 있는 관계"
              note="조사 대상입니다"
            />
            <LegendItem
              mark={<LineMark tone="mid" line="dashed" />}
              label="관측만 된 관계"
              note="알림 없이 연결만 있었습니다"
            />
          </div>
          <p className="text-[11.5px] leading-[1.6] text-faint">
            선 위 숫자는 이벤트 수와 알림 수입니다. 주고받은 트래픽 양이 아닙니다.
          </p>
        </div>
      </Card>

      <DestinationLinks nodes={data?.nodes ?? []} />
    </div>
  )
}

export default Intelligence
