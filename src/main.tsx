import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// 배포 뒤 열려 있던 탭이 사라진 화면 파일을 부르면 새로고침해 새 버전을 받는다. 10초 안에 또 실패하면 멈춘다(무한 새로고침 방지)
window.addEventListener('vite:preloadError', () => {
  const last = Number(sessionStorage.getItem('chunk-reload') || 0)
  if (Date.now() - last < 10_000) return
  sessionStorage.setItem('chunk-reload', String(Date.now()))
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
