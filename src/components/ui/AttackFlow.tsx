import type { AttackStep } from '@/components/ui/AttackPath'

type AttackFlowProps = {
  steps: Pick<AttackStep, 'title' | 'caption'>[]
  label?: string
}

/** 세로 공격 흐름. 마지막(결과)은 빨강으로 채우고, 그 앞(경고)은 주황 테두리다. */
function AttackFlow({ steps, label = '공격 흐름' }: AttackFlowProps) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {steps.map((step, i) => {
        const hit = i === steps.length - 1
        const warn = i === steps.length - 2
        const tone = hit
          ? 'bg-crit border-crit text-white'
          : warn
            ? 'bg-[var(--high-wash)] border-high text-high'
            : 'bg-surface border-line text-ink-2'
        return (
          <li key={i} className="relative flex gap-[16px] pb-[18px] last:pb-0">
            {!hit && (
              <span
                aria-hidden
                className="absolute left-[15px] top-[32px] bottom-0 w-[2px] bg-line"
              />
            )}
            <span
              className={`grid flex-none place-items-center w-[32px] h-[32px] rounded-full border font-mono text-[11px] font-semibold ${tone}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 pt-[1px]">
              <span className="block text-[11px] text-faint">{step.caption}</span>
              <span
                className={`block font-mono text-[14px] font-semibold wrap-anywhere ${
                  hit ? 'text-crit' : warn ? 'text-high' : 'text-ink'
                }`}
              >
                {step.title}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default AttackFlow
