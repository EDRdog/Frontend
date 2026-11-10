import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import type { SelfTestRun, SelfTestStatus } from '@/api/types'
import AsyncState from '@/components/ui/AsyncState'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import CardHead from '@/components/ui/CardHead'
import ScrollArea from '@/components/ui/ScrollArea'
import { primaryButton } from '@/components/ui/styles'
import { useApi } from '@/hooks/useApi'
import { shortTime } from '@/lib/format'

const TRIGGER_LABELS: Record<SelfTestRun['trigger'], string> = {
  STARTUP: '기동',
  SCHEDULED: '주기',
  MANUAL: '요청',
}

const CATEGORY_LABELS = { selftest: '자체시험', integrity: '무결성' }

const STATUS_TONE = { PASS: 'good', FAIL: 'crit', SKIP: 'mid' } as const

function StatusBadge({ status }: { status: SelfTestStatus }) {
  return (
    <Badge severity={STATUS_TONE[status]} className="font-mono tracking-[0.04em]">
      {status}
    </Badge>
  )
}

const startedMs = (run: SelfTestRun) => new Date(run.startedAt).getTime()

function SelfTest() {
  const { data, loading, error, refetch } = useApi(() => api.selfTests(), [])
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  const runs = data ?? []
  // 고른 실행이 목록에 없으면(새로 받는 중이거나 밀려났으면) 가장 최근 것을 보여준다.
  const picked = runs.find((r) => r.id === pickedId) ?? runs[0]

  async function runNow() {
    setRunning(true)
    setRunError(null)
    try {
      const run = await api.runSelfTest()
      setPickedId(run.id)
      refetch()
    } catch (err) {
      setRunError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-wrap items-end gap-[16px]">
        <div>
          <div className="text-[18px] sm:text-[20px] font-bold text-ink tracking-[-0.01em]">
            자체점검
          </div>
          <div className="mt-[6px] text-[13px] text-faint">
            관리 서버가 스스로를 시험하고, 실행 파일과 설정 파일이 기준값과 같은지 확인합니다.
          </div>
        </div>
        <div className="ml-auto flex items-center gap-[12px]">
          {runError && <span className="text-[12.5px] text-crit">{runError}</span>}
          <button type="button" onClick={runNow} disabled={running} className={primaryButton}>
            {running ? '실행 중' : '지금 실행'}
          </button>
        </div>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={runs.length === 0}
        emptyText="아직 실행 기록이 없습니다"
        onRetry={refetch}
      >
        {picked && (
          <section className="grid items-start gap-[16px] lg:grid-cols-[minmax(0,1fr)_360px]">
            <RunDetail run={picked} />
            <aside className="flex flex-col gap-[12px] lg:sticky lg:top-[84px]">
              <Card>
                <CardHead
                  title="최근 실행"
                  meta={<span className="font-mono">{runs.length}회</span>}
                />
                <ul className="m-0 list-none p-[6px]">
                  {runs.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        aria-current={r.id === picked.id ? 'true' : undefined}
                        onClick={() => setPickedId(r.id)}
                        className={`flex w-full cursor-pointer items-center gap-[10px] rounded-sm border-0 p-[10px] text-left font-sans transition-colors ${
                          r.id === picked.id
                            ? 'bg-[var(--accent-wash)]'
                            : 'bg-transparent hover:bg-panel'
                        }`}
                      >
                        <i
                          aria-hidden
                          className={`w-[3px] flex-none self-stretch rounded-xs ${r.status === 'FAIL' ? 'bg-crit' : 'bg-line'}`}
                        />
                        <span className="min-w-0 flex-1">
                          <b className="block font-mono text-[12.5px] font-semibold text-ink">
                            {shortTime(startedMs(r), true)}
                          </b>
                          <span className="block truncate text-[11.5px] text-faint">
                            {TRIGGER_LABELS[r.trigger]} · {r.requestedBy ?? '시스템'}
                          </span>
                        </span>
                        <StatusBadge status={r.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              <div className="rounded-sm border border-dashed border-line px-[16px] py-[12px] text-[12.5px] text-mid">
                에이전트의 자체시험과 무결성 결과는 감사기록에서 종류 agent 로 봅니다.
                <Link to="/audit" className="ml-[4px] font-semibold">
                  감사기록 보기
                </Link>
              </div>
            </aside>
          </section>
        )}
      </AsyncState>
    </div>
  )
}

function RunDetail({ run }: { run: SelfTestRun }) {
  const fails = run.items.filter((i) => i.status === 'FAIL')
  const skips = run.items.filter((i) => i.status === 'SKIP')
  const head = fails.length
    ? `${CATEGORY_LABELS[fails[0].category]} ${fails.length}건 실패`
    : skips.length
      ? `통과, ${skips.length}개 항목 건너뜀`
      : '모든 항목 통과'
  // 무결성 실패만 변조를 의심할 이유가 된다. 자체시험 실패는 기준값과 무관하다.
  const tampered = fails.find((i) => i.category === 'integrity')

  return (
    <Card className="pt-[24px]">
      <div className="px-[20px] sm:px-[26px]">
        <div className="flex items-center gap-[8px]">
          <StatusBadge status={run.status} />
          <span className="rounded-xs border border-line px-[7px] py-[2px] font-mono text-[11px] text-ink-2">
            {TRIGGER_LABELS[run.trigger]}
          </span>
          <span className="ml-auto font-mono text-[12px] text-mid">
            {shortTime(startedMs(run), true)}
          </span>
        </div>
        <h2 className="m-0 mt-[14px] text-[24px] font-bold tracking-[-0.03em] text-ink">{head}</h2>
        <p className="m-0 mt-[4px] text-[13px] text-mid">
          요청자 <b className="font-mono font-medium text-ink-2">{run.requestedBy ?? '시스템'}</b> ·
          항목 {run.items.length}개
        </p>
      </div>
      <div className="mt-[18px] border-t border-line-2">
        <ScrollArea label="점검 항목">
          <table className="w-full min-w-[640px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[104px]" />
              <col className="w-[250px]" />
              <col className="w-[84px]" />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-line-2 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                <th className="py-[9px] pl-[20px] pr-[12px] font-semibold sm:pl-[26px]">분류</th>
                <th className="px-[12px] py-[9px] font-semibold">이름</th>
                <th className="px-[12px] py-[9px] font-semibold">결과</th>
                <th className="py-[9px] pl-[12px] pr-[20px] font-semibold sm:pr-[26px]">상세</th>
              </tr>
            </thead>
            <tbody>
              {run.items.map((item) => (
                <tr
                  key={`${item.category}/${item.name}`}
                  className={`border-b border-line-2 last:border-b-0 ${
                    item.status === 'FAIL'
                      ? 'bg-[var(--crit-wash)] shadow-[inset_2px_0_0_var(--crit)]'
                      : ''
                  }`}
                >
                  <td className="py-[10px] pl-[20px] pr-[12px] text-[12.5px] text-ink-2 sm:pl-[26px]">
                    {CATEGORY_LABELS[item.category]}
                  </td>
                  <td className="px-[12px] py-[10px] font-mono text-[12.5px] font-semibold text-ink wrap-anywhere">
                    {item.name}
                  </td>
                  <td className="px-[12px] py-[10px]">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-[10px] pl-[12px] pr-[20px] text-[12.5px] text-mid wrap-anywhere sm:pr-[26px]">
                    {item.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>
      {tampered ? (
        <div className="m-[20px] rounded-md border-l-2 border-accent bg-panel px-[14px] py-[12px] sm:mx-[26px]">
          <small className="mb-[2px] block font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            CHECK
          </small>
          <p className="m-0 text-[13px] text-ink">
            <b className="font-mono font-semibold">{tampered.name.split('/').pop()}</b> 이 기준값과
            다릅니다. 배포 뒤 바꾼 적이 없다면 변조를 의심하고 파일을 확인하세요.
          </p>
        </div>
      ) : (
        <div className="h-[20px]" />
      )}
    </Card>
  )
}

export default SelfTest
