import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// ScrollTrigger 는 모듈이 처음 불러와질 때 한 번만 등록한다(랜딩 청크에서만 불러온다).
gsap.registerPlugin(ScrollTrigger)
export { gsap, ScrollTrigger }

// 움직임 줄이기 설정 여부
export const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 요소에 적용된 CSS 변수 값을 읽는다. 캔버스는 CSS 를 못 읽으므로 값으로 꺼내 쓴다.
export const cssVar = (el: Element, name: string) =>
  getComputedStyle(el).getPropertyValue(name).trim()

// '#rrggbb' 를 'r,g,b' 로 바꾼다. rgba() 문자열에 끼워 쓴다.
export const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`
}

// 테마(html 의 data-theme)가 바뀌면 cb 를 부른다. 해제 함수를 돌려준다.
export function onThemeChange(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => mo.disconnect()
}
