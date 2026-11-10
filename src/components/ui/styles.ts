/** 보안 기능 화면(설정, 감사기록, 자체점검, 로그인)이 같이 쓰는 폼 요소 스타일. */

export const inputClass =
  'h-[38px] w-full rounded-sm border border-line bg-panel-2 px-[12px] font-sans text-[13px] text-ink outline-none transition-colors placeholder:text-faint hover:border-faint focus:border-accent aria-[invalid=true]:border-crit [&[type=password]]:font-mono [&[type=password]]:tracking-[0.12em]'

const button =
  'inline-flex h-[38px] cursor-pointer items-center justify-center whitespace-nowrap rounded-sm px-[16px] font-sans text-[13px] font-semibold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0'

export const primaryButton = `${button} bg-accent text-white hover:bg-accent-strong disabled:hover:bg-accent`
export const secondaryButton = `${button} border border-line bg-surface text-ink-2 hover:bg-panel disabled:hover:bg-surface`
export const ghostButton = `${button} text-mid hover:bg-panel hover:text-ink-2 disabled:hover:bg-transparent`
