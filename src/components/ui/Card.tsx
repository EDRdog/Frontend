import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

// 카드 안 패널 머리: 제목 + 보조 정보, 아래 1px 구획선
export const panelHead = 'flex items-center gap-[10px] px-[18px] py-[14px] border-b border-line-2'

// 소프트 카드: 밝은 테마는 그림자만, 어두운 테마는 옅은 테두리와 위쪽 빛을 더한다(index.css --card-line, --shadow-card).
function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-surface border border-[var(--card-line)] rounded-md shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  )
}

export default Card
