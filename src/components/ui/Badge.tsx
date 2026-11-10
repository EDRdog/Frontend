import type { ReactNode } from 'react'

type Severity = 'crit' | 'high' | 'med' | 'mid' | 'accent' | 'good'

// 글자색만 정하면 배경은 같은 색을 옅게 섞어 깐다(--wash 비율, 테마별로 다르다).
const styles: Record<Severity, string> = {
  crit: 'text-crit',
  high: 'text-high',
  med: 'text-med',
  mid: 'text-mid',
  accent: 'text-accent-ink',
  good: 'text-good',
}

type BadgeProps = {
  severity: Severity
  children: ReactNode
  className?: string
}

// 소프트 배지: 알약 모양, 테두리 없이 옅은 배경 + 앞에 점.
function Badge({ severity, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-pill bg-[color-mix(in_srgb,currentColor_var(--wash),transparent)] text-[11px] font-semibold ${styles[severity]} ${className}`}
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />
      {children}
    </span>
  )
}

export default Badge
