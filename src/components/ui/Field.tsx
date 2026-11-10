import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  children: ReactNode
  /** 입력칸 아래 한 줄. Msg 를 넘긴다. */
  message?: ReactNode
  className?: string
}

/** 라벨은 위, 도움말과 오류는 아래. */
function Field({ label, children, message, className = '' }: FieldProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-[6px] ${className}`}>
      <span className="text-[12px] font-semibold text-ink-2">{label}</span>
      {children}
      {message}
    </label>
  )
}

const tones = { mid: 'text-mid', bad: 'text-crit', ok: 'text-good' }

/** 입력 결과를 알리는 한 줄. 스크린리더에도 읽히도록 aria-live 로 둔다. */
export function Msg({
  tone = 'mid',
  children,
}: {
  tone?: keyof typeof tones
  children?: ReactNode
}) {
  return (
    <span aria-live="polite" className={`min-h-[18px] text-[12px] ${tones[tone]}`}>
      {children}
    </span>
  )
}

export default Field
