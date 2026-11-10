import type { ReactNode } from 'react'

type CardHeadProps = {
  title: string
  /** 제목 옆 작은 글씨. */
  meta?: ReactNode
  /** 오른쪽 끝에 붙는 것(버튼, 쪽 이동). */
  children?: ReactNode
}

function CardHead({ title, meta, children }: CardHeadProps) {
  return (
    <div className="flex flex-wrap items-center gap-[10px] border-b border-line-2 px-[16px] py-[14px] sm:px-[20px]">
      <h2 className="m-0 text-[14px] font-bold text-ink">{title}</h2>
      {meta && <span className="text-[12px] text-faint">{meta}</span>}
      {children && <div className="ml-auto flex items-center gap-[8px]">{children}</div>}
    </div>
  )
}

export default CardHead
