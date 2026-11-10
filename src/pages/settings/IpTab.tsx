import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api } from '@/api'
import AsyncState from '@/components/ui/AsyncState'
import Card from '@/components/ui/Card'
import CardHead from '@/components/ui/CardHead'
import { Msg } from '@/components/ui/Field'
import ScrollArea from '@/components/ui/ScrollArea'
import { ghostButton, inputClass, primaryButton } from '@/components/ui/styles'
import { useApi } from '@/hooks/useApi'
import { shortTime } from '@/lib/format'

const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const IPV6_FULL = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i

/** `::` 는 한 번만 올 수 있다. 줄인 표기의 세부 판정은 서버가 한다. */
function isIpv6(s: string) {
  if (!/^[0-9a-f:]+$/i.test(s)) return false
  return s.includes('::') ? s.split('::').length === 2 : IPV6_FULL.test(s)
}

/** 단일 IPv4·IPv6 만 받는다. 형식의 최종 판정은 서버가 한다(ADR 013). */
function ipError(s: string, existing: string[], yourIp: string): string {
  if (!s) return ''
  if (/[/*,~\s-]/.test(s))
    return '범위, 와일드카드, 여러 개는 등록할 수 없습니다. IP 하나만 입력하세요.'
  if (!IPV4.test(s) && !isIpv6(s)) return 'IP 주소 형식이 아닙니다.'
  if (existing.includes(s)) return '이미 목록에 있는 IP 입니다.'
  if (existing.length === 0 && s !== yourIp) {
    return `처음 등록하는 IP 는 지금 내 IP(${yourIp})여야 합니다.`
  }
  return ''
}

function IpTab() {
  const { data, loading, error, refetch } = useApi(() => api.adminIps(), [])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const ips = data?.allowedIps ?? []
  const yourIp = data?.yourIp ?? ''
  const mine = ips.some((r) => r.ip === yourIp)
  const typed = input.trim()
  const typedError = ipError(
    typed,
    ips.map((r) => r.ip),
    yourIp,
  )

  /** 쓰기 요청 하나를 돌리고 끝나면 목록을 다시 받는다. 서버가 거절한 이유(자기 잠금 등)는 그대로 보여준다. */
  async function run(action: () => Promise<unknown>) {
    setPending(true)
    setActionError(null)
    try {
      await action()
      refetch()
      return true
    } catch (err) {
      setActionError((err as Error).message)
      return false
    } finally {
      setPending(false)
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!typed || typedError) return
    if (await run(() => api.addAdminIp(typed))) setInput('')
  }

  const message = typedError || actionError

  return (
    <AsyncState loading={loading} error={error} onRetry={refetch}>
      <div className="grid max-w-[1060px] items-start gap-[16px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-[16px]">
          <Card className="grid items-center gap-[16px] px-[16px] py-[18px] sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-[28px] sm:px-[20px]">
            <div>
              <small className="block text-[11.5px] font-semibold text-faint">지금 내 IP</small>
              <span className="mt-[4px] block font-mono text-[24px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
                {yourIp}
              </span>
            </div>
            <div className="border-line-2 sm:border-l sm:pl-[28px]">
              <b className="flex flex-wrap items-center gap-[8px] text-[14px] font-bold text-ink">
                {ips.length > 0 ? '제한 켜짐' : '제한 없음'}
                <span
                  className={`inline-flex items-center gap-[7px] text-[12.5px] font-semibold ${
                    ips.length === 0 ? 'text-faint' : mine ? 'text-good' : 'text-high'
                  }`}
                >
                  <i aria-hidden className="h-[8px] w-[8px] rounded-full bg-current" />
                  {ips.length === 0
                    ? '목록 비어 있음'
                    : mine
                      ? '내 IP 는 목록에 있음'
                      : '내 IP 는 목록에 없음'}
                </span>
              </b>
              <p className="m-0 mt-[3px] text-[12.5px] text-mid">
                {ips.length > 0
                  ? `목록에 있는 IP ${ips.length}개에서만 로그인하고 관리 화면을 쓸 수 있습니다.`
                  : '어느 IP 에서든 로그인할 수 있습니다.'}
              </p>
            </div>
          </Card>

          <Card>
            <CardHead
              title="허용 IP 목록"
              meta={<span className="font-mono">{ips.length}개</span>}
            />
            <form
              onSubmit={add}
              noValidate
              className="flex flex-col gap-[6px] px-[16px] py-[16px] sm:px-[20px]"
            >
              <label htmlFor="ipInput" className="text-[12px] font-semibold text-ink-2">
                IP 추가
              </label>
              <div className="flex gap-[8px]">
                <input
                  id="ipInput"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="예: 198.51.100.17"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    setActionError(null)
                  }}
                  aria-invalid={typedError !== ''}
                  aria-describedby="ipMsg ipHelp"
                  className={`${inputClass} flex-1 font-mono`}
                />
                <button
                  type="submit"
                  disabled={!typed || typedError !== '' || pending}
                  className={primaryButton}
                >
                  추가
                </button>
              </div>
              <span id="ipMsg">
                <Msg tone="bad">{message}</Msg>
              </span>
              <span id="ipHelp" className="text-[12px] leading-[1.55] text-mid">
                IP 를 하나씩 등록합니다. 범위(
                <code className="font-mono text-[11.5px] text-ink-2">198.51.100.0/24</code>,{' '}
                <code className="font-mono text-[11.5px] text-ink-2">10.0.0.1-10.0.0.20</code>)와
                와일드카드(<code className="font-mono text-[11.5px] text-ink-2">*</code>)는 받지
                않습니다.
              </span>
            </form>

            {ips.length === 0 ? (
              <div className="border-t border-line-2 px-[16px] py-[22px] sm:px-[20px]">
                <b className="block text-[14px] font-bold text-ink">
                  등록된 IP 가 없어 접속 IP 를 제한하지 않습니다
                </b>
                <p className="m-0 mb-[16px] mt-[4px] text-[12.5px] text-mid">
                  어느 IP 에서든 로그인할 수 있습니다. 처음 등록하는 IP 는 지금 내 IP 여야 합니다.
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => api.addAdminIp(yourIp))}
                  className={primaryButton}
                >
                  내 IP 로 제한 시작
                </button>
              </div>
            ) : (
              <>
                <ScrollArea label="허용 IP 목록">
                  <table className="w-full min-w-[560px] border-collapse">
                    <thead>
                      <tr className="border-y border-line-2 text-left text-[10px] uppercase tracking-[0.1em] text-faint">
                        <th className="px-[20px] py-[9px] font-mono font-semibold">IP 주소</th>
                        <th className="w-[200px] py-[9px] font-mono font-semibold">등록한 사람</th>
                        <th className="w-[120px] py-[9px] font-mono font-semibold">등록 시각</th>
                        <th className="w-[90px] px-[20px] py-[9px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {ips.map((r) => {
                        const isMine = r.ip === yourIp
                        // 다른 IP 가 남아 있는 동안 내 IP 를 빼면 스스로 잠긴다. 서버도 409 로 막는다.
                        const locked = isMine && ips.length > 1
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-line-2 last:border-b-0 hover:bg-panel"
                          >
                            <td className="px-[20px] py-[10px] font-mono text-[13px] font-semibold text-ink">
                              {r.ip}
                              {isMine && (
                                <span className="ml-[8px] rounded-xs border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-[7px] py-[2px] font-mono text-[11px] font-medium text-accent">
                                  내 IP
                                </span>
                              )}
                            </td>
                            <td className="py-[10px] pr-[12px] text-[12.5px] text-ink-2">
                              {r.createdBy}
                            </td>
                            <td className="whitespace-nowrap py-[10px] font-mono text-[12px] text-mid">
                              {shortTime(r.createdAt)}
                            </td>
                            <td className="px-[20px] py-[10px] text-right">
                              <button
                                type="button"
                                disabled={locked || pending}
                                title={
                                  locked
                                    ? '다른 IP 가 남아 있는 동안 내 IP 는 뺄 수 없습니다'
                                    : undefined
                                }
                                aria-label={`${r.ip} 삭제`}
                                onClick={() => run(() => api.removeAdminIp(r.id))}
                                className={`${ghostButton} !h-[30px] !px-[10px] text-[12px]`}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
                <div className="border-t border-line-2 px-[16px] py-[14px] text-[12px] leading-[1.55] text-mid sm:px-[20px]">
                  내 IP 는 다른 IP 가 목록에 남아 있는 동안 뺄 수 없습니다. 스스로 접속이 막히는
                  것을 막기 위해서입니다.
                </div>
              </>
            )}
          </Card>
        </div>

        <Card>
          <CardHead title="목록이 하는 일" />
          <ul className="m-0 grid list-none gap-[12px] p-[16px] sm:p-[20px]">
            <SideItem title="비어 있으면 제한 없음">
              어느 IP 에서든 로그인하고 관리 화면을 쓸 수 있습니다.
            </SideItem>
            <SideItem title="하나라도 있으면 목록 안에서만">
              목록 밖 IP 의 로그인과 관리 요청은 거부되고 감사기록에{' '}
              <code className="font-mono text-[11.5px] text-ink-2">admin_ip_block</code> 으로
              남습니다.
            </SideItem>
            <SideItem title="에이전트는 대상이 아님">
              에이전트와 서버 사이 통신은 이 목록과 상관없이 계속됩니다.
            </SideItem>
          </ul>
        </Card>
      </div>
    </AsyncState>
  )
}

function SideItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="grid gap-[2px] border-l-2 border-line pl-[12px]">
      <b className="text-[13px] font-semibold text-ink">{title}</b>
      <span className="text-[12.5px] leading-[1.55] text-mid">{children}</span>
    </li>
  )
}

export default IpTab
