import { Fragment, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import Card, { panelHead } from '@/components/ui/Card'
import AsyncState from '@/components/ui/AsyncState'
import FocusList from '@/components/ui/FocusList'
import Tag from '@/components/ui/Tag'
import { useApi } from '@/hooks/useApi'
import { useAuthStore } from '@/store/auth'
import { hostStatusColor, hostStatusLabel, relativeTime } from '@/lib/format'
import type { Host, InstallLink } from '@/api/types'

type OsKey = 'macos' | 'windows'

/** manual: 사람이 직접 해야 하는 단계. 스크립트가 대신 못 하므로 주의 색으로 표시한다. */
type Step = { title: string; body: string; command?: string; manual?: boolean }

const OS_TABS: { key: OsKey; label: string }[] = [
  { key: 'macos', label: 'macOS' },
  { key: 'windows', label: 'Windows' },
]

/**
 * 설치 안내. 자체 에이전트(edrdog-agent) 기준이다.
 *
 * 명령 한 줄은 서버가 조립해 준다(POST /api/tenant/install-link). 화면이 주소나 토큰을 이어
 * 붙이지 않는 이유는, 둘이 어긋나면 사용자가 붙여넣은 명령이 조용히 틀린 곳을 가리키기 때문이다.
 * 그래서 여기 있는 Step 들은 설명만 들고, 실제 명령은 발급 응답을 그대로 보여준다.
 */
const INSTALL_NOTES: Record<OsKey, Step[]> = {
  macos: [
    {
      title: '터미널에서 명령 실행',
      body: '위에서 발급한 한 줄을 터미널에 붙여넣습니다.\n중간에 권한 승인을 기다리므로 터미널에서 직접 실행해야 합니다. 다른 프로그램이 대신 실행하면 그 단계에서 멈춥니다.',
    },
    {
      title: '전체 디스크 접근(FDA) 승인',
      manual: true,
      body: '이 단계만 사람이 직접 해야 합니다. macOS의 TCC는 사람 승인이나 MDM 프로파일로만 켤 수 있어 스크립트가 대신할 수 없습니다.\n스크립트가 설정 창을 열어 줍니다. "+"를 누르고 아래 경로를 추가한 뒤 켜고 Enter를 누르면 이어서 진행합니다.\n/usr/local/bin/edrdog-agent',
    },
    {
      title: '결과 확인',
      body: '스크립트가 끝나면서 결과를 알려줍니다. "등록 완료"가 보이면 끝난 것이고, 3번 기기 상태에도 이 기기가 나타납니다.\nERR_NOT_PERMITTED가 보이면 권한이 아직 안 켜진 것입니다. 전체 디스크 접근에서 껐다 다시 켠 뒤 아래로 재시작하고 로그를 확인하세요.',
      command:
        'sudo launchctl kickstart -k system/com.edrdog.agent\ntail -n 50 /var/log/edrdog/agent.log',
    },
  ],
  windows: [
    {
      title: '관리자 PowerShell에서 명령 실행',
      body: '위에서 발급한 한 줄을 관리자 권한 PowerShell에 붙여넣습니다.\n바이너리 수신, 서버 인증서 고정, 설정 작성, 서비스 등록까지 한 번에 끝납니다. macOS와 달리 사람이 승인할 권한 단계가 없습니다.',
    },
    {
      title: '결과 확인',
      body: '서비스가 Running이면 수집이 시작된 것입니다.\n등록되면 3번 기기 상태에 이 기기가 먼저 나타나고, 이벤트가 아직 없으면 수집 없음으로 표시됩니다.',
      command: 'Get-Service edrdog-agent',
    },
  ],
}

/** 설치 경로. 문제가 생겼을 때 어디를 볼지 알아야 해서 화면에 남긴다. */
const INSTALL_PATHS: Record<OsKey, { label: string; value: string }[]> = {
  macos: [
    { label: '실행 파일', value: '/usr/local/bin/edrdog-agent' },
    { label: '설정', value: '/etc/edrdog/config.json' },
    { label: '데몬', value: '/Library/LaunchDaemons/com.edrdog.agent.plist' },
    { label: '로그', value: '/var/log/edrdog/agent.log' },
  ],
  windows: [
    { label: '실행 파일', value: 'C:\\Program Files\\EDRdog\\edrdog-agent.exe' },
    { label: '설정', value: 'C:\\ProgramData\\EDRdog\\config.json' },
    { label: '서비스', value: 'edrdog-agent' },
    { label: '로그', value: 'C:\\ProgramData\\EDRdog\\agent.log' },
  ],
}

const SLACK_STEPS = [
  'api.slack.com/apps 접속 → Create New App → From scratch 선택',
  '앱 이름 입력, 알림을 받을 워크스페이스 선택 후 생성',
  '좌측 메뉴 Incoming Webhooks → Activate Incoming Webhooks 켜기',
  'Add New Webhook to Workspace → 알림 받을 채널 선택 → Allow',
  '생성된 Webhook URL(https://hooks.slack.com/services/...) 복사 후 아래 입력칸에 붙여넣기',
]

// lastSeen 이 이 시간을 넘으면 에이전트가 멈춘 것으로 본다. status(열린 alert 기준)와는 다른 축이다.
const STALE_MS = 10 * 60_000

function CopyButton({ text, onError }: { text: string; onError: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    // 비보안 컨텍스트(http://192.168.x.x:5173)에서는 navigator.clipboard 자체가 없어 TypeError 가 난다.
    // 버튼이 무반응으로 죽지 않도록 동기 예외와 reject 를 모두 잡아 수동 복사로 안내한다.
    try {
      void navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        })
        .catch(onError)
    } catch {
      onError()
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-sm border border-line px-[10px] py-[5px] text-[12px] font-semibold text-mid hover:text-ink-2 hover:bg-panel cursor-pointer transition-colors"
    >
      {copied ? '복사됨' : '복사'}
    </button>
  )
}

/** display 를 주면 화면에는 그 값을 보여주고 복사는 command 원문으로 한다(enroll secret 마스킹용). */
function CommandBlock({ command, display }: { command: string; display?: string }) {
  const [copyFailed, setCopyFailed] = useState(false)

  return (
    <div className="mt-[10px] rounded-sm border border-line bg-panel-2 px-[12px] py-[9px]">
      <div className="flex items-center gap-[10px]">
        <code className="grow overflow-x-auto whitespace-pre font-mono text-[12.5px] text-good">
          {display ?? command}
        </code>
        <CopyButton text={command} onError={() => setCopyFailed(true)} />
      </div>
      {copyFailed && (
        <div className="mt-[8px] text-[12px] text-med">
          클립보드를 쓸 수 없는 환경입니다. 위 내용을 직접 선택해 복사하세요.
        </div>
      )}
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="mt-[1px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full border border-line text-[12px] font-semibold text-mid">
      {n}
    </span>
  )
}

function OsTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <div className="inline-flex gap-[3px] rounded-md border border-line-2 p-[3px]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-xs px-[16px] py-[6px] text-[13px] font-semibold cursor-pointer transition-colors ${
            value === tab.key
              ? 'bg-[var(--accent-wash)] text-accent'
              : 'text-mid hover:text-ink-2 hover:bg-panel'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** 설치 안내를 세로 흐름으로 잇는다. 사람이 직접 해야 하는 단계만 주의 색이다. */
function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={step.title} className="relative flex gap-[16px] pb-[18px] last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className="absolute left-[15px] top-[32px] bottom-0 w-[2px] bg-line"
            />
          )}
          <span
            className={`grid h-[32px] w-[32px] flex-none place-items-center rounded-full border font-mono text-[11px] font-semibold ${
              step.manual
                ? 'border-med bg-[color-mix(in_srgb,var(--med)_var(--wash),transparent)] text-med'
                : 'border-line bg-surface text-ink-2'
            }`}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0 grow pt-[5px]">
            <div className={`text-[14px] font-semibold ${step.manual ? 'text-med' : 'text-ink'}`}>
              {step.title}
            </div>
            <div className="mt-[4px] whitespace-pre-line text-[13px] text-mid leading-[1.6]">
              {step.body}
            </div>
            {step.command && <CommandBlock command={step.command} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

function LoginHint() {
  return (
    <div className="rounded-sm border border-dashed border-line px-[16px] py-[14px] text-[13px] text-mid leading-[1.6]">
      로그인하면 여기서 바로 발급·저장·등록할 수 있습니다.{' '}
      <Link to="/login" className="font-semibold !text-accent">
        로그인
      </Link>
    </div>
  )
}

/** 단계 사이 의존 관계처럼 놓치면 알림이 사라지는 전제를 강조하는 주의 박스. */
function NoteBox({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border-l-2 border-med bg-panel-2 px-[14px] py-[12px] text-[13px] text-mid leading-[1.6]">
      {title && <strong className="mb-[2px] block font-semibold text-med">{title}</strong>}
      {children}
    </div>
  )
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-sm bg-accent px-[18px] py-[9px] text-[13px] font-semibold !text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-sm border border-line px-[16px] py-[9px] text-[13px] font-semibold text-mid hover:text-ink-2 hover:bg-panel disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
    >
      {children}
    </button>
  )
}

/** 만료까지 남은 시간. 분 단위로 끊어 "곧 만료"인지 한눈에 보이게 한다. */
function remainingText(expiresAt: string): string {
  const left = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(left)) return ''
  if (left <= 0) return '만료됨'
  const hours = Math.floor(left / 3_600_000)
  const minutes = Math.floor((left % 3_600_000) / 60_000)
  return hours > 0 ? `${hours}시간 ${minutes}분 뒤 만료` : `${minutes}분 뒤 만료`
}

/**
 * 설치 링크 발급. 누를 때 부른다.
 *
 * 화면을 열 때 미리 받아두지 않는 이유는 토큰이 짧게 살기 때문이다(기본 24시간). 보고만 있어도
 * 발급되면 쓰지도 않은 토큰이 계속 쌓이고, 사용자는 언제 받은 것인지 모르는 링크를 보게 된다.
 */
function InstallLinkPanel({
  os,
  link,
  pending,
  error,
  onIssue,
}: {
  os: OsKey
  link: InstallLink | null
  pending: boolean
  error: string | null
  onIssue: () => void
}) {
  const command = link && (os === 'macos' ? link.macosCommand : link.windowsCommand)

  return (
    <div className="mt-[16px] rounded-md border border-line-2 bg-panel-2 px-[14px] py-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <div>
          <div className="text-[13px] font-semibold text-ink">설치 링크</div>
          <div className="mt-[3px] text-[12px] leading-[1.6] text-faint">
            서버 주소와 enroll secret이 이미 들어 있는 한 줄을 발급합니다. 받는 사람이 키를 다룰
            일이 없습니다.
          </div>
        </div>
        <PrimaryButton onClick={onIssue} disabled={pending}>
          {pending ? '발급 중' : link ? '다시 발급' : '설치 링크 발급'}
        </PrimaryButton>
      </div>

      {error && <div className="mt-[10px] text-[12px] text-crit">{error}</div>}

      {command && (
        <>
          {/* 서버가 준 문자열을 그대로 보여준다. 화면에서 조립하면 서버와 어긋난다. */}
          <CommandBlock command={command} />
          <div className="mt-[8px] text-[12px] text-faint">
            {remainingText(link.expiresAt)} · 여러 대에 같은 링크를 쓸 수 있습니다.
          </div>
        </>
      )}
    </div>
  )
}

/** 등록한 host 이름이 실제 관측된 이름과 일치하는지. 불일치면 알림이 조용히 사라진다. */
function ObservedBadge({ observed }: { observed: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-xs border border-line px-[7px] py-[3px] text-[11px] font-semibold ${
        observed ? 'text-good' : 'text-med'
      }`}
    >
      {observed ? '관측됨' : '관측된 적 없음 (오타 의심)'}
    </span>
  )
}

type ChecklistItem = { label: string; detail: string; done: boolean }

function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="flex flex-col gap-[8px]">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-[10px] rounded-sm border border-line bg-panel-2 px-[12px] py-[9px]"
        >
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: item.done ? 'var(--good)' : 'var(--mid)' }}
          />
          <span className="grow text-[13px] text-ink-2">{item.label}</span>
          <span className={`shrink-0 text-[12px] ${item.done ? 'text-good' : 'text-faint'}`}>
            {item.detail}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 개인·조직 webhook 이 저장 방식만 다르고 입력·검증은 같아서 onSave 로만 갈라 쓴다. */
function WebhookForm({
  initial,
  onSave,
  onSaved,
  showTest = false,
}: {
  initial: string | null
  onSave: (url: string) => Promise<unknown>
  /** 저장된 값을 부모에 알린다. 재조회로 폼을 다시 그리면 저장 안내가 바로 사라져서 refetch 를 쓰지 않는다. */
  onSaved: (url: string) => void
  showTest?: boolean
}) {
  const [url, setUrl] = useState(initial ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mutErr, setMutErr] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const valid = url.startsWith('https://hooks.slack.com/')

  const save = async () => {
    setBusy(true)
    setSaved(false)
    setMutErr(null)
    try {
      await onSave(url)
      setSaved(true)
      onSaved(url)
    } catch (e) {
      setMutErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // 저장된 webhook 으로 실제 발송을 시도한다. 입력칸의 값이 아니라 서버에 저장된 값이 대상이다.
  const runTest = async () => {
    setTesting(true)
    setTestMsg(null)
    try {
      const res = await api.testWebhook()
      setTestMsg(
        res.ok
          ? { ok: true, text: `테스트 알림을 보냈습니다. Slack 응답 ${res.status}` }
          : { ok: false, text: `전송에 실패했습니다. Slack 응답 ${res.status}` },
      )
    } catch (e) {
      setTestMsg({ ok: false, text: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-[8px] sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setSaved(false)
          }}
          placeholder="https://hooks.slack.com/services/..."
          className="grow rounded-sm border border-line bg-panel-2 px-[12px] py-[9px] text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <PrimaryButton onClick={save} disabled={busy || !valid}>
          {busy ? '저장 중' : '저장'}
        </PrimaryButton>
        {showTest && (
          <SecondaryButton onClick={runTest} disabled={testing}>
            {testing ? '보내는 중' : '테스트 알림 보내기'}
          </SecondaryButton>
        )}
      </div>
      {url.length > 0 && !valid && (
        <div className="mt-[8px] text-[12px] text-med">
          https://hooks.slack.com/ 로 시작하는 URL을 입력하세요.
        </div>
      )}
      {saved && <div className="mt-[8px] text-[12px] text-good">저장되었습니다.</div>}
      {mutErr && <div className="mt-[8px] text-[12px] text-crit">{mutErr}</div>}
      {showTest && (
        <div className="mt-[8px] text-[12px] text-faint">
          테스트는 저장된 webhook으로 보냅니다. 입력만 하고 저장하지 않으면 이전 값으로 갑니다.
        </div>
      )}
      {testMsg && (
        <div className={`mt-[6px] text-[12px] ${testMsg.ok ? 'text-good' : 'text-crit'}`}>
          {testMsg.text}
        </div>
      )}
    </div>
  )
}

// select 의 "직접 입력" 항목. 공백은 hostname 에 올 수 없어 실제 호스트 이름과 절대 겹치지 않는다.
const MANUAL_OPTION = '__직접 입력__'

function MyHostsPanel({
  observed,
  myHosts,
  loading,
  error,
  refetch,
}: {
  observed: Host[]
  myHosts: string[]
  loading: boolean
  error: string | null
  refetch: () => void
}) {
  const [choice, setChoice] = useState('')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyHost, setBusyHost] = useState<string | null>(null)
  const [mutErr, setMutErr] = useState<string | null>(null)

  const observedNames = observed.map((h) => h.host)
  const candidates = observedNames.filter((name) => !myHosts.includes(name))
  const name = (choice === MANUAL_OPTION ? manual : choice).trim()
  // 관측 목록에 없는 이름은 오타일 가능성이 크다. 라우팅이 tenantId+host 완전 일치라 한 글자만 틀려도 알림이 사라진다.
  const unobserved = name.length > 0 && !observedNames.includes(name)

  const register = async () => {
    if (!name) return
    if (
      unobserved &&
      !window.confirm(
        `'${name}'은 아직 관측되지 않은 호스트입니다.\n\n이름이 정확하지 않으면 알림이 전달되지 않습니다. 그래도 등록할까요?`,
      )
    )
      return
    setBusy(true)
    setMutErr(null)
    try {
      await api.registerHost(name)
      setChoice('')
      setManual('')
      refetch()
    } catch (e) {
      setMutErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // 확인 없이 연타하면 두 번째 요청이 404 를 받는다. busy 로 버튼도 함께 잠근다.
  const unregister = async (target: string) => {
    if (
      !window.confirm(`'${target}' 등록을 해제할까요?\n\n해제하면 이 기기의 알림이 오지 않습니다.`)
    )
      return
    setBusyHost(target)
    setMutErr(null)
    try {
      await api.unregisterHost(target)
      refetch()
    } catch (e) {
      setMutErr((e as Error).message)
    } finally {
      setBusyHost(null)
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-[8px] sm:flex-row">
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="grow rounded-sm border border-line bg-panel-2 px-[12px] py-[9px] text-[13px] text-ink focus:border-accent focus:outline-none cursor-pointer"
        >
          <option value="">관측된 기기에서 선택</option>
          {candidates.map((host) => (
            <option key={host} value={host}>
              {host}
            </option>
          ))}
          <option value={MANUAL_OPTION}>직접 입력</option>
        </select>
        <PrimaryButton onClick={register} disabled={busy || name.length === 0}>
          {busy ? '등록 중' : '등록'}
        </PrimaryButton>
      </div>

      {choice === MANUAL_OPTION && (
        <input
          type="text"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="본인 기기의 hostname (터미널에서 hostname 명령)"
          className="mt-[8px] w-full rounded-sm border border-line bg-panel-2 px-[12px] py-[9px] text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
      )}

      {candidates.length === 0 && choice !== MANUAL_OPTION && (
        <div className="mt-[8px] text-[12px] text-faint">
          아직 선택할 수 있는 관측 기기가 없습니다. 1번 설치를 마치면 목록에 나타납니다.
        </div>
      )}
      {unobserved && (
        <div className="mt-[8px] text-[12px] text-med leading-[1.6]">
          아직 관측되지 않은 호스트입니다. 이름이 정확하지 않으면 알림이 전달되지 않습니다.
        </div>
      )}
      {mutErr && <div className="mt-[8px] text-[12px] text-crit">{mutErr}</div>}

      <div className="mt-[14px]">
        <AsyncState
          loading={loading}
          error={error}
          empty={myHosts.length === 0}
          emptyText="아직 등록한 기기가 없습니다."
          onRetry={refetch}
        >
          <div className="flex flex-col gap-[8px]">
            {myHosts.map((host) => (
              <div
                key={host}
                className="flex flex-wrap items-center gap-[12px] rounded-sm border border-line bg-panel-2 px-[12px] py-[9px]"
              >
                <span className="grow font-mono text-[13px] text-ink-2">{host}</span>
                <ObservedBadge observed={observedNames.includes(host)} />
                <button
                  type="button"
                  onClick={() => unregister(host)}
                  disabled={busyHost !== null}
                  className="shrink-0 text-[12px] font-semibold text-mid hover:text-crit disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {busyHost === host ? '해제 중' : '해제'}
                </button>
              </div>
            ))}
          </div>
        </AsyncState>
      </div>
    </div>
  )
}

const statusGrid = 'grid grid-cols-[1fr_90px_90px_100px_100px] gap-[12px]'

function HostStatusPanel({
  hosts,
  loading,
  error,
  refetch,
}: {
  hosts: Host[]
  loading: boolean
  error: string | null
  refetch: () => void
}) {
  const now = Date.now()

  return (
    <div>
      <div className="flex items-center justify-between gap-[12px]">
        <span className="text-[12px] text-faint">
          여기 표시된 이름이 알림 라우팅이 대조하는 값입니다. 4번에서 이 이름 그대로 등록하세요.
        </span>
        <SecondaryButton onClick={refetch} disabled={loading}>
          {loading ? '불러오는 중' : '새로고침'}
        </SecondaryButton>
      </div>

      <div className="mt-[14px]">
        <AsyncState
          loading={loading}
          error={error}
          empty={hosts.length === 0}
          emptyText="아직 등록되거나 관측된 기기가 없습니다. 설치·등록을 마치면 여기에 표시됩니다."
          onRetry={refetch}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div
                className={`${statusGrid} pb-[8px] border-b border-line-2 text-[11px] text-faint uppercase tracking-[0.04em]`}
              >
                <span>호스트</span>
                <span>상태</span>
                <span>연결</span>
                <span className="text-right">마지막 이벤트</span>
                <span className="text-right">에이전트 연결</span>
              </div>
              {hosts.map((h, i) => {
                // 등록은 됐지만 이벤트가 아직 없는 기기. 이런 기기는 열린 알림이 없어 healthy 로
                // 오는데, 그대로 초록 "정상"을 켜면 검증도 안 된 상태를 좋다고 말하는 셈이라
                // 중립으로 내린다.
                const noEvents = h.enrolled && h.lastSeen === 0
                // 에이전트 생존은 이벤트가 아니라 서버에 붙은 시각으로 판단해야 한다. lastSeen 으로
                // 보면 이벤트만 없어도 죽은 것처럼 보인다. 미등록 기기는 agentSeen 이 없어 기존처럼
                // lastSeen 을 쓴다.
                const aliveTs = h.enrolled ? h.agentSeen : h.lastSeen
                const stale = now - aliveTs > STALE_MS
                return (
                  <div
                    key={h.host}
                    className={`${statusGrid} items-center py-[11px] ${
                      i === hosts.length - 1 ? '' : 'border-b border-line-2'
                    }`}
                  >
                    <span className="font-mono text-[13px] text-ink-2">{h.host}</span>
                    <span className="flex items-center gap-[7px] text-[12.5px] text-mid">
                      <span
                        className="h-[7px] w-[7px] rounded-full"
                        style={{
                          background: noEvents ? 'var(--faint)' : hostStatusColor(h.status),
                        }}
                      />
                      {noEvents ? '수집 없음' : hostStatusLabel(h.status)}
                    </span>
                    <span className={`text-[12.5px] ${stale ? 'text-med' : 'text-mid'}`}>
                      {stale ? '연결 끊김' : '연결됨'}
                    </span>
                    <span className="font-mono text-[11px] text-faint text-right">
                      {noEvents ? '수집 없음' : relativeTime(h.lastSeen)}
                    </span>
                    <span className="font-mono text-[11px] text-faint text-right">
                      {h.enrolled ? relativeTime(h.agentSeen) : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </AsyncState>
      </div>

      <div className="mt-[14px] text-[12px] text-faint leading-[1.6]">
        상태는 열린 알림의 심각도로만 매기므로 에이전트가 멈춰도 알림이 없으면 계속 정상으로 보일 수
        있습니다. 등록됐지만 이벤트가 아직 없는 기기는 상태를 수집 없음으로 표시합니다. 에이전트가
        살아 있는지는 마지막 이벤트가 아니라 에이전트 연결 시각(연결 열)으로 판단하세요.
      </div>
    </div>
  )
}

/** 연동 4단계. 오른쪽 목록과 본문 머리가 같은 값을 쓴다. */
const STEPS = [
  {
    title: '기기 설치 및 로그 수집',
    description:
      '설치 링크를 발급해 나온 한 줄을 대상 기기에서 실행하세요. 프로세스·파일·네트워크를 한 에이전트가 모두 수집합니다.',
    sub: '대상 기기에서 한 줄 실행',
  },
  {
    title: 'Slack 알림 연결',
    description: 'Slack Incoming Webhook을 발급받아 등록하면 탐지 알림이 이 채널로 전달됩니다.',
    sub: 'Incoming Webhook 등록',
  },
  {
    title: '기기 상태',
    description:
      '조직에 등록됐거나 관측 중인 기기입니다. 4번에 입력할 정확한 host 이름을 여기서 확인하세요.',
    sub: '정확한 host 이름 확인',
  },
  {
    title: '내 기기 등록',
    description: '등록한 host의 탐지 알림이 내 Slack Webhook으로 전달됩니다.',
    sub: 'host 이름 완전 일치',
  },
]

function Onboarding() {
  const [os, setOs] = useState<OsKey>('macos')
  const loggedIn = useAuthStore((s) => s.token !== null)
  // 지금 크게 보는 단계(0~3). 오른쪽 목록에서 누르면 바뀐다.
  const [step, setStep] = useState(0)
  const focusRef = useRef<HTMLDivElement>(null)

  // 체크리스트·호스트 선택·관측 배지가 같은 응답을 봐야 해서 조회를 이 위치에서 한 번만 한다.
  // 비로그인 상태의 개인 설정 API 는 401 이라 아예 부르지 않는다(화면은 LoginHint 로 대체된다).
  const observedQ = useApi(() => api.hosts())
  const myHostsQ = useApi(() => (loggedIn ? api.myHosts() : Promise.resolve(null)), [loggedIn])
  const webhookQ = useApi(() => (loggedIn ? api.getWebhook() : Promise.resolve(null)), [loggedIn])

  // 저장 직후 값. 저장 뒤 재조회하면 폼이 다시 마운트되면서 "저장되었습니다" 가 즉시 사라져서,
  // 체크리스트만 이 값으로 갱신하고 폼은 건드리지 않는다.
  const [justSavedWebhook, setJustSavedWebhook] = useState<string | null>(null)

  // 설치 링크는 useApi 로 자동 조회하지 않는다. 토큰이 짧게 살아서, 화면을 열어만 둬도
  // 발급되면 쓰지 않은 토큰이 쌓이고 사용자는 언제 받은 링크인지 알 수 없다.
  const [installLink, setInstallLink] = useState<InstallLink | null>(null)
  const [linkPending, setLinkPending] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  async function issueLink() {
    setLinkPending(true)
    setLinkError(null)
    try {
      setInstallLink(await api.issueInstallLink())
    } catch (e) {
      setLinkError((e as Error).message)
    } finally {
      setLinkPending(false)
    }
  }

  const observed = observedQ.data ?? []
  const observedNames = observed.map((h) => h.host)
  const myHosts = myHostsQ.data?.hosts ?? []
  const webhookUrl = justSavedWebhook ?? webhookQ.data?.webhookUrl ?? null

  // 등록했지만 그 이름으로 관측된 적이 없는 기기. 오타로 알림이 사라지고 있다는 신호다.
  const unmatched = myHosts.filter((host) => !observedNames.includes(host)).length

  const checklist: ChecklistItem[] = [
    {
      label: '등록·관측 기기',
      detail: `${observed.length}대`,
      done: observed.length > 0,
    },
    {
      label: '내 기기 등록',
      detail:
        unmatched > 0 ? `${myHosts.length}대 (관측 미확인 ${unmatched}대)` : `${myHosts.length}대`,
      done: myHosts.length > 0 && unmatched === 0,
    },
    {
      label: '개인 webhook',
      detail: webhookUrl ? '등록됨' : '미등록',
      done: webhookUrl !== null,
    },
  ]

  function select(key: string) {
    setStep(Number(key))
    // 1280 미만에서는 단계 목록이 본문 아래에 쌓여 있어 눌러도 바뀐 게 안 보인다. 본문 머리로 올려 준다.
    if (!window.matchMedia('(min-width: 1280px)').matches) {
      focusRef.current?.scrollIntoView({ block: 'start' })
    }
  }

  // 단계별 본문. 넷 다 그려 두고 고른 것만 보인다. 단계를 오가도 입력 중인 값이 지워지지 않는다.
  const bodies = [
    <Fragment key="install">
      <OsTabs tabs={OS_TABS} value={os} onChange={setOs} />

      {loggedIn ? (
        <InstallLinkPanel
          os={os}
          link={installLink}
          pending={linkPending}
          error={linkError}
          onIssue={issueLink}
        />
      ) : (
        <div className="mt-[16px] text-[13px] text-med leading-[1.6]">
          로그인하면 내 조직의 설치 링크를 발급할 수 있습니다.
        </div>
      )}

      <div className="mt-[24px]">
        <StepList steps={INSTALL_NOTES[os]} />
      </div>

      {/* 설치 경로: 문제가 생겼을 때 볼 곳 */}
      <h3 className="mt-[24px] text-[13px] font-bold text-ink">
        설치 경로
        <small className="ml-[8px] text-[12px] font-normal text-faint">
          문제가 생겼을 때 볼 곳
        </small>
      </h3>
      <div className="mt-[10px] flex flex-col gap-[6px]">
        {INSTALL_PATHS[os].map((p) => (
          <div key={p.label} className="flex flex-wrap gap-[10px] text-[12px]">
            <span className="w-[68px] shrink-0 text-faint">{p.label}</span>
            <span className="font-mono wrap-anywhere text-mid">{p.value}</span>
          </div>
        ))}
      </div>
    </Fragment>,
    <Fragment key="slack">
      <NoteBox>
        webhook만 등록하면 알림은 오지 않습니다.{' '}
        <span className="text-ink-2">4번 내 기기 등록</span>
        까지 마쳐야 그 기기의 알림이 이 채널로 전달됩니다.
      </NoteBox>

      <div className="mt-[18px] text-[13px] font-semibold text-ink-2">Webhook 발급 방법</div>
      <ol className="mt-[10px] flex flex-col gap-[10px]">
        {SLACK_STEPS.map((item, i) => (
          <li key={item} className="flex gap-[12px]">
            <StepNumber n={i + 1} />
            <span className="grow text-[13px] text-mid leading-[1.6] self-center">{item}</span>
          </li>
        ))}
      </ol>

      <div className="mt-[18px] text-[13px] font-semibold text-ink-2">내 Webhook URL</div>
      <div className="mt-[6px] text-[12px] text-faint leading-[1.6]">
        4번에서 내가 등록한 host의 알림이 이 채널로 갑니다.
      </div>
      <div className="mt-[10px]">
        {loggedIn ? (
          <AsyncState loading={webhookQ.loading} error={webhookQ.error} onRetry={webhookQ.refetch}>
            <WebhookForm
              initial={webhookUrl}
              onSave={api.setWebhook}
              onSaved={setJustSavedWebhook}
              showTest
            />
          </AsyncState>
        ) : (
          <LoginHint />
        )}
      </div>
    </Fragment>,
    <HostStatusPanel
      key="hosts"
      hosts={observed}
      loading={observedQ.loading}
      error={observedQ.error}
      refetch={observedQ.refetch}
    />,
    <Fragment key="register">
      <NoteBox>
        알림 라우팅은 host 이름 <span className="text-ink-2">완전 일치</span>로 동작합니다. 3번
        목록에서 고르면 항상 일치하고, 직접 입력한 이름이 한 글자라도 다르면 알림이 조용히
        사라집니다. 2번의 webhook도 함께 등록해야 알림이 옵니다.
      </NoteBox>

      <div className="mt-[16px]">
        {loggedIn ? (
          <MyHostsPanel
            observed={observed}
            myHosts={myHosts}
            loading={myHostsQ.loading}
            error={myHostsQ.error}
            refetch={myHostsQ.refetch}
          />
        ) : (
          <LoginHint />
        )}
      </div>
    </Fragment>,
  ]

  return (
    <div className="flex flex-col gap-[20px]">
      <div>
        <div className="text-[18px] sm:text-[20px] font-bold text-ink tracking-[-0.01em]">
          수집 알림 연동
        </div>
        <div className="mt-[6px] text-[13px] text-faint leading-[1.6]">
          기기당 1회 설치·등록을 마치면 이벤트 수집과 실제 조치가 동작합니다. 조치(kill)는 같은
          에이전트가 실행하고 결과를 보고할 때까지 서버가 기다렸다가 응답합니다.
        </div>
      </div>

      {/* 포커스: 왼쪽 지금 단계 하나 크게, 오른쪽 4단계 목록. 2열은 대시보드와 같이 xl(1280) 부터. */}
      <section className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div ref={focusRef} className="min-w-0 scroll-mt-[74px]">
          {STEPS.map((item, i) => (
            <div key={item.title} hidden={step !== i}>
              <Card className="px-[18px] py-[20px] sm:px-[28px] sm:py-[26px]">
                <Tag>
                  {i + 1} / {STEPS.length}
                </Tag>
                <h2 className="mt-[16px] text-[24px] sm:text-[30px] font-bold leading-[1.25] tracking-[-0.03em] text-ink">
                  {item.title}
                </h2>
                <p className="mt-[4px] text-[13px] text-mid leading-[1.6]">{item.description}</p>
                <div className="mt-[20px]">{bodies[i]}</div>
              </Card>
            </div>
          ))}
        </div>

        <aside className="flex min-w-0 flex-col gap-[12px]">
          <Card className="overflow-hidden">
            <div className={panelHead}>
              <h2 className="text-[14px] font-bold text-ink">연동 단계</h2>
              <span className="font-mono text-[11px] text-faint">{STEPS.length}단계</span>
            </div>
            {/* 누르면 왼쪽이 그 단계로 바뀐다. */}
            <FocusList
              items={STEPS.map((item, i) => ({
                key: String(i),
                color: i === step ? 'var(--accent)' : 'var(--line)',
                title: `${i + 1}. ${item.title}`,
                sub: i === 2 && observedQ.data ? `${item.sub} · ${observed.length}대` : item.sub,
              }))}
              currentKey={String(step)}
              onSelect={select}
            />
          </Card>

          {loggedIn && (
            <Card className="overflow-hidden">
              <div className={panelHead}>
                <h2 className="text-[14px] font-bold text-ink">연동 체크리스트</h2>
              </div>
              <div className="px-[18px] py-[16px]">
                <Checklist items={checklist} />
              </div>
            </Card>
          )}

          <NoteBox title="알림이 오려면">
            탐지 알림이 전달되려면 개인 webhook 과 내 기기 등록이 둘 다 갖춰져야 합니다. 하나라도
            비어 있으면 알림은 조용히 사라집니다.
          </NoteBox>
        </aside>
      </section>
    </div>
  )
}

export default Onboarding
