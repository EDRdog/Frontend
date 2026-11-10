import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useThemeStore } from '@/store/theme'
import '@/components/landing/landing.css'
import { ScrollTrigger } from '@/components/landing/utils'
import Hero from '@/components/landing/Hero'
import Flow from '@/components/landing/Flow'
import ThreatMap from '@/components/landing/ThreatMap'
import Features from '@/components/landing/Features'

// 해(다크일 때) / 달(라이트일 때) 아이콘 하나로 테마를 바꾼다. 글자 라벨은 두지 않는다.
function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  return (
    <button
      type="button"
      className="theme-btn"
      onClick={toggle}
      aria-label={theme === 'dark' ? '라이트 테마로 전환' : '다크 테마로 전환'}
    >
      <span data-om-sun>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.3" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      </span>
      <span data-om-moon>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      </span>
    </button>
  )
}

// 랜딩: 스크롤 하나로 제품이 하는 일을 순서대로 보여준다(docs/design-docs/landing-v2.md).
function Landing() {
  // 글꼴이 늦게 들어와 높이가 바뀌면 고정 구간 위치가 어긋나므로 한 번 다시 잰다.
  useEffect(() => {
    let dead = false
    document.fonts?.ready.then(() => {
      if (!dead) ScrollTrigger.refresh()
    })
    return () => {
      dead = true
    }
  }, [])

  return (
    <div className="landing">
      <header className="nav">
        <a className="logo" href="#">
          <img src="/logo.png" alt="" />
          EDRdog
        </a>
        <nav className="nav-links">
          <a href="#flow">동작 방식</a>
          <a href="#map">위협 지도</a>
          <a href="#features">기능</a>
        </nav>
        <div className="cta">
          <ThemeToggle />
          <Link className="btn sm" to="/login">
            로그인
          </Link>
          <Link className="btn sm primary" to="/dashboard">
            데모 보기
          </Link>
        </div>
      </header>
      <main>
        <Hero />
        <Flow />
        <ThreatMap />
        <Features />
      </main>
      <footer className="ft-foot">
        <div className="wrap ft-foot-in">
          <a className="logo" href="#">
            <img src="/logo.png" alt="" />
            EDRdog
          </a>
          <nav className="ft-links" aria-label="푸터">
            <a href="#flow">동작 방식</a>
            <a href="#map">위협 지도</a>
            <a href="#features">기능</a>
            <Link to="/login">로그인</Link>
          </nav>
          <p className="mono ft-copy">© 2026 EDRdog</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
