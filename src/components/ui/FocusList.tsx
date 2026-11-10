export type FocusItem = {
  /** 고른 항목을 짚는 값 */
  key: string
  /** 왼쪽 3px 띠 색. 심각도·상태 색이거나 중립색이다. */
  color: string
  title: string
  sub: string
  /** 색으로만 전하는 뜻(심각도 등)을 화면 읽기 도구에 알린다. */
  srLabel?: string
}

type FocusListProps = {
  items: FocusItem[]
  currentKey: string | null
  onSelect: (key: string) => void
  /** 호스트명, 명령줄처럼 mono 로 보여줄 제목 */
  mono?: boolean
  /** 목록 높이 상한. 넘치면 안에서 스크롤한다. */
  className?: string
}

/** 포커스 배치의 오른쪽 목록. 누르면 왼쪽이 그 항목으로 바뀐다. */
function FocusList({
  items,
  currentKey,
  onSelect,
  mono = false,
  className = 'max-h-[420px]',
}: FocusListProps) {
  return (
    <ul className={`flex flex-col overflow-y-auto p-[6px] ${className}`}>
      {items.map((item, i) => {
        const on = item.key === currentKey
        return (
          // 같은 내용의 이벤트가 두 번 올 수 있어 순번을 붙여 React 키를 가른다.
          <li key={`${item.key}#${i}`}>
            <button
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={on ? 'true' : undefined}
              className={`flex w-full gap-[10px] p-[10px] rounded-sm text-left cursor-pointer font-sans transition-colors duration-[140ms] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-ink ${
                on ? 'bg-[var(--accent-wash)]' : 'hover:bg-panel-2'
              }`}
            >
              <span
                aria-hidden
                className="w-[3px] flex-none rounded-full"
                style={{ background: item.color }}
              />
              <span className="min-w-0 flex-1">
                {item.srLabel && <span className="sr-only">{item.srLabel} </span>}
                <span
                  className={`block truncate text-ink ${
                    mono ? 'font-mono text-[12px] font-medium' : 'text-[13px] font-semibold'
                  }`}
                >
                  {item.title}
                </span>
                <span className="block truncate font-mono text-[11px] text-faint">{item.sub}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default FocusList
