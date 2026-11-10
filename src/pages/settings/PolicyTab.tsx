import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '@/api'
import type { SecurityPolicy } from '@/api/types'
import AsyncState from '@/components/ui/AsyncState'
import Card from '@/components/ui/Card'
import CardHead from '@/components/ui/CardHead'
import { Msg } from '@/components/ui/Field'
import { ghostButton, inputClass, primaryButton } from '@/components/ui/styles'
import { useApi } from '@/hooks/useApi'

type Key = keyof SecurityPolicy

/** 범위는 안내용이다(ADR 013). 서버가 밖의 값을 400 으로 거절한다. */
const FIELDS: { key: Key; label: string; help: string; unit: string; min: number; max: number }[] =
  [
    {
      key: 'maxLoginFailures',
      label: '연속 실패 허용 횟수',
      help: '이 횟수만큼 연속으로 틀리면 그 계정을 잠급니다.',
      unit: '회',
      min: 1,
      max: 5,
    },
    {
      key: 'lockMinutes',
      label: '잠금 시간',
      help: '잠긴 계정은 이 시간이 지나야 다시 로그인할 수 있습니다.',
      unit: '분',
      min: 5,
      max: 1440,
    },
    {
      key: 'idleMinutes',
      label: '유휴 세션 종료',
      help: '아무 조작이 없으면 이 시간 뒤에 로그아웃합니다.',
      unit: '분',
      min: 1,
      max: 60,
    },
  ]

type Values = Record<Key, string>

const toValues = (p: SecurityPolicy): Values => ({
  maxLoginFailures: String(p.maxLoginFailures),
  lockMinutes: String(p.lockMinutes),
  idleMinutes: String(p.idleMinutes),
})

function inRange(value: string, min: number, max: number) {
  const n = Number(value)
  return value !== '' && Number.isInteger(n) && n >= min && n <= max
}

function PolicyTab() {
  const { data, loading, error, refetch } = useApi(() => api.securityPolicy(), [])

  return (
    <AsyncState loading={loading} error={error} onRetry={refetch}>
      {data && <PolicyForm policy={data} onSaved={refetch} />}
    </AsyncState>
  )
}

/** 입력칸은 처음 받은 서버 값으로 열고, 그 뒤로는 편집 중인 값을 지우지 않는다(되돌리기가 최신 서버 값으로 되돌린다). */
function PolicyForm({ policy, onSaved }: { policy: SecurityPolicy; onSaved: () => void }) {
  const [values, setValues] = useState<Values>(() => toValues(policy))
  const [pending, setPending] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const valid = FIELDS.every((f) => inRange(values[f.key], f.min, f.max))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setPending(true)
    setSaveError(null)
    setSaved(false)
    try {
      await api.saveSecurityPolicy({
        maxLoginFailures: Number(values.maxLoginFailures),
        lockMinutes: Number(values.lockMinutes),
        idleMinutes: Number(values.idleMinutes),
      })
      setSaved(true)
      onSaved()
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid max-w-[1060px] items-start gap-[16px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHead title="로그인 보안정책" meta="조직의 모든 계정에 적용" />
        <form onSubmit={save} noValidate className="px-[16px] pb-[20px] pt-[8px] sm:px-[20px]">
          {FIELDS.map((f) => {
            const ok = inRange(values[f.key], f.min, f.max)
            const hint = `${f.min}~${f.max}${f.unit} 사이`
            return (
              <div
                key={f.key}
                className="grid gap-[12px] border-t border-line-2 py-[16px] first:border-t-0 sm:grid-cols-[minmax(0,1fr)_180px] sm:gap-[20px]"
              >
                <div>
                  <label htmlFor={f.key} className="block text-[13.5px] font-semibold text-ink">
                    {f.label}
                  </label>
                  <p className="m-0 mt-[3px] text-[12.5px] text-mid">{f.help}</p>
                </div>
                <div className="flex flex-col gap-[6px]">
                  <div className="flex items-center gap-[8px]">
                    <input
                      id={f.key}
                      type="number"
                      inputMode="numeric"
                      min={f.min}
                      max={f.max}
                      value={values[f.key]}
                      onChange={(e) => {
                        setValues({ ...values, [f.key]: e.target.value })
                        setSaved(false)
                      }}
                      aria-invalid={!ok}
                      className={`${inputClass} text-right font-mono`}
                    />
                    <span className="w-[18px] shrink-0 text-[13px] text-mid">{f.unit}</span>
                  </div>
                  <Msg tone={ok ? 'mid' : 'bad'}>{ok ? hint : `${hint}로 입력하세요`}</Msg>
                </div>
              </div>
            )
          })}
          <div className="mt-[6px] flex flex-wrap items-center gap-[12px] border-t border-line-2 pt-[16px]">
            {saveError ? (
              <Msg tone="bad">{saveError}</Msg>
            ) : saved ? (
              <Msg tone="ok">저장했습니다.</Msg>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setValues(toValues(policy))
                setSaved(false)
                setSaveError(null)
              }}
              className={`${ghostButton} ml-auto`}
            >
              되돌리기
            </button>
            <button type="submit" disabled={!valid || pending} className={primaryButton}>
              {pending ? '저장 중' : '저장'}
            </button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHead title="적용 내용" />
        <div className="grid gap-[14px] px-[16px] py-[18px] text-[13.5px] leading-[1.6] text-ink-2 sm:px-[20px]">
          {valid ? (
            <>
              <p className="m-0">
                <b className="font-mono font-semibold text-ink">{values.maxLoginFailures}번</b>{' '}
                연속으로 틀리면 그 계정은{' '}
                <b className="font-mono font-semibold text-ink">{values.lockMinutes}분</b> 동안
                로그인할 수 없습니다.
              </p>
              <p className="m-0">
                <b className="font-mono font-semibold text-ink">{values.idleMinutes}분</b> 동안 아무
                조작이 없으면 로그아웃합니다.
              </p>
            </>
          ) : (
            <p className="m-0 text-mid">범위를 벗어난 값이 있어 저장할 수 없습니다.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

export default PolicyTab
