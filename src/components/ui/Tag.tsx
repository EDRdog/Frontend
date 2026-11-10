import type { ReactNode } from 'react'

// 태그: MITRE 기법, OS 같은 분류 값. 곡률 3px, 강조 글자색에 옅은 테두리(DESIGN.md 4장).
function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="px-[7px] py-[2px] rounded-xs border border-[color-mix(in_srgb,var(--accent-ink)_30%,transparent)] font-mono text-[11px] text-accent-ink">
      {children}
    </span>
  )
}

export default Tag
