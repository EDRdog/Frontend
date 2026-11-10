import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap, ScrollTrigger, prefersReduced, cssVar, rgbOf, onThemeChange } from './utils'

// 입자: 빛줄기 점(dot)과 차선을 따라 흐르는 글자 조각(chip)
type Lane = { u: number; z: number; v: number; list: Particle[] }
type Particle = {
  chip: boolean; z: number; u: number; x: number; y: number; v: number
  st: number; t: number; vy: number; s: number; sev: number; w: number; ln?: Lane
}

// 히어로: 이벤트 흐름 → 탐지 → 대시보드. 스크롤 하나에 세 장면이 이어진다.
function Hero() {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = rootRef.current!
    const stage = root.querySelector<HTMLElement>('.hx-stage')!
    const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!
    const $$ = (s: string) => [...root.querySelectorAll<HTMLElement>(s)]
    const cv = $<HTMLCanvasElement>('.hx-cv')
    const ctx = cv.getContext('2d', { alpha: false })!
    const intro = $('.hx-intro'), head2 = $('.hx-head2'), head3 = $('.hx-head3')
    const gtag = $('.hx-gtag'), count = $('.hx-count'), nEl = $('#hx-n'), mEl = $('#hx-m')
    const dash = $('.hx-dash'), parts = $$('.hx-dp'), rows = $$('.hx-row'), chips = $$('.hx-chip'), kvs = $$('.hx-kv')
    const plot = $('.hx-d-plot')
    const landing = root.closest('.landing') || root
    let dead = false, raf = 0
    const offs: (() => void)[] = []
    // 언마운트: rAF, 리스너, 관찰자, gsap, 직접 만든 막대를 모두 치운다
    const cleanup = () => {
      dead = true
      cancelAnimationFrame(raf)
      offs.forEach((f) => f())
      plot.replaceChildren()
    }
    const REDUCE = prefersReduced()
    const rnd = Math.random
    const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
    const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
    const out3 = (t: number) => 1 - (1 - t) ** 3
    const io3 = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
    const fmt = (n: number) => n.toLocaleString('en-US')
    const put = (el: HTMLElement, x: number, y: number, s: number, o: number | string) => { el.style.transform = `translate3d(${x}px,${y}px,0)` + (s !== 1 ? ` scale(${s})` : ''); el.style.opacity = String(o) }

    // 7일 추이 막대: 심각, 높음, 보통 순으로 쌓는다 (오늘 = 걸러낸 5건)
    const DAYS = [[0, 1, 2], [0, 0, 1], [1, 1, 0], [0, 2, 1], [0, 1, 1], [1, 1, 2], [2, 2, 1]]
    DAYS.forEach((d) => {
      const col = document.createElement('div')
      col.className = 'hx-col'
      d.forEach((n, i) => { if (n) col.insertAdjacentHTML('beforeend', `<i style="height:${n * 20}%;background:var(${['--crit', '--high', '--med'][i]})"></i>`) })
      plot.append(col)
    })
    const cols = $$('.hx-col')

    // 흐르는 이벤트 문구 (종류, 내용)
    const EV = [
      ['proc', 'powershell.exe -enc JABzAD0A…'], ['proc', 'svchost.exe -k netsvcs'], ['proc', 'chrome.exe --type=renderer'], ['proc', 'cmd.exe /c whoami'],
      ['proc', 'excel.exe /e -embedding'], ['proc', 'rundll32.exe shell32.dll'], ['proc', 'python3 sync.py --all'], ['proc', 'sshd -D'], ['proc', 'node server.js'],
      ['net', '10.0.4.12 › 185.220.101.4:443'], ['net', '10.0.2.31 › 52.84.12.7:443'], ['net', '10.0.8.5 › 10.0.8.1:53'], ['net', '10.0.3.44 › 142.250.196.110:443'],
      ['net', '10.0.4.12 › 10.0.4.20:445'], ['net', '10.0.6.9 › 13.107.42.14:443'],
      ['file', 'invoice.docm'], ['file', 'C:\\Users\\kim\\Downloads\\setup.exe'], ['file', 'report_q3.xlsx'], ['file', '/var/log/auth.log'], ['file', '~/.ssh/known_hosts'], ['file', 'payroll_2026.pdf'],
      ['reg', 'HKCU\\…\\Run\\updater'], ['reg', 'HKLM\\SYSTEM\\…\\Services'], ['reg', 'HKCU\\…\\RecentDocs'],
      ['auth', 'login kim'], ['auth', 'login svc_backup'], ['auth', 'sudo -u root'], ['auth', 'logout lee'], ['auth', 'kerberos tgt park'],
      ['dns', 'update.msedge.net'], ['dns', 'api.github.com'], ['dns', 'x7k2.duckdns.org'], ['dns', 'cdn.jsdelivr.net'],
    ]
    const RULE = { proc: 'T1059.001', net: 'T1071.001', file: 'T1486', reg: 'T1547.001', auth: 'T1078', dns: 'T1568' }
    // 캔버스 색: .landing 의 CSS 변수에서 읽고, 테마가 바뀌면 다시 읽는다
    let SEV: string[][] = [], TIER: string[][] = [], DOTC: string[] = [], dotStyle: string[][] = []
    let col = { bg: '', bgRgb: '', ink: '', accentRgb: '', accentInk: '', accentInkRgb: '' }
    const BANDS = 8
    function readColors() {
      const v = (n: string) => cssVar(landing, n)
      const [bg, shell, panel, raised, line, strong] = ['--bg', '--shell', '--panel', '--raised', '--line', '--line-strong'].map(v)
      const [ink, ink2, mid, faint] = ['--ink', '--ink-2', '--mid', '--faint'].map(v)
      const sev = ['--crit', '--high', '--med'].map(v)
      SEV = sev.map((c) => [rgbOf(c), c])
      // 문구 조각을 미리 그려 둔다. 멀수록 어두운 색 3단계 (불투명이라 겹쳐도 글자가 섞이지 않는다)
      TIER = [[panel, line, strong, faint], [shell, line, faint, mid], [raised, strong, mid, ink2]]
      DOTC = [rgbOf(ink2), rgbOf(faint)]
      dotStyle = DOTC.map((c) => Array.from({ length: BANDS }, (_, b) => `rgba(${c},${((b + 0.5) / BANDS).toFixed(3)})`))
      const accentInk = v('--accent-ink')
      col = { bg, bgRgb: rgbOf(bg), ink, accentRgb: rgbOf(v('--accent')), accentInk, accentInkRgb: rgbOf(accentInk) }
    }
    readColors()

    const small = innerWidth < 860
    const NDOT = small ? 340 : 1000, SPEED = small ? 150 : 330
    const LANES = small ? 15 : 30, PER = small ? 2 : 3
    let W = 1, H = 1, dpr = 1, Gx = 0, b1 = [0, 1], b2 = [0, 1], dx = 0, dy = 0, ds = 1, gw = 0, scrimY = 0, scrimRy = 1
    const eb = $('.hx-eb'), sub = $('.hx-sub'), cta = $('.hx-cta'), words = $$('.hx-w')
    // 조각마다 출발 자리(a), 머무는 자리(b), 표 위 자리(s), 도착할 표 행(r)
    const pos: Record<'a' | 'b' | 's' | 'r', number[]>[] = []

    let sprites: { c: HTMLCanvasElement; w: number; h: number }[][] = [], hot = new Map<number, { c: HTMLCanvasElement; w: number; h: number }>(), SS = 2
    function chipSprite(k: string, v: string, tier: number, sev?: number) {
      const c = document.createElement('canvas'), g = c.getContext('2d')!
      const fs = (small ? 10.5 : 12) * SS, pad = 9 * SS, gap = 8 * SS, h = Math.round((small ? 20 : 24) * SS)
      const font = `500 ${fs}px 'JetBrains Mono', ui-monospace, monospace`
      g.font = font
      const kw = g.measureText('file').width, vw = g.measureText(v).width
      const rule = sev == null ? '' : RULE[k as keyof typeof RULE], rw = rule ? g.measureText(rule).width + gap : 0
      c.width = Math.ceil(pad * 2 + kw + gap + vw + rw); c.height = h
      const [bg, line, kc, vc] = TIER[tier]
      g.font = font; g.textBaseline = 'middle'
      g.beginPath(); g.roundRect(SS * 0.5, SS * 0.5, c.width - SS, h - SS, 3 * SS)
      g.fillStyle = bg; g.fill()
      if (sev != null) { g.fillStyle = `rgba(${SEV[sev][0]},.16)`; g.fill() }
      g.lineWidth = SS; g.strokeStyle = sev == null ? line : `rgba(${SEV[sev][0]},.45)`; g.stroke()
      if (sev != null) { g.fillStyle = SEV[sev][1]; g.fillRect(SS * 0.5, SS * 0.5, 2 * SS, h - SS) }
      g.fillStyle = kc; g.fillText(k, pad, h / 2)
      g.fillStyle = sev == null ? vc : col.ink; g.fillText(v, pad + kw + gap, h / 2)
      if (rule) { g.fillStyle = SEV[sev!][1]; g.fillText(rule, pad + kw + gap + vw + gap, h / 2) }
      return { c, w: c.width / SS, h: h / SS }
    }
    function buildSprites() {
      SS = Math.min(devicePixelRatio || 1, 2) * 1.25
      sprites = [0, 1, 2].map((t) => EV.map(([k, v]) => chipSprite(k, v, t)))
      hot = new Map()
    }
    const hotSprite = (i: number, sev: number) => {
      const key = i * 3 + sev
      if (!hot.has(key)) hot.set(key, chipSprite(EV[i][0], EV[i][1], 2, sev))
      return hot.get(key)!
    }

    // 입자: 빛줄기 점(dot)과 차선을 따라 흐르는 글자 조각(chip). z 가 클수록 가깝고 크고 빠르다
    const mk = (chip: boolean): Particle => ({ chip, z: rnd(), u: 0, x: 0, y: 0, v: 0, st: 0, t: 0, vy: 0, s: 0, sev: 0, w: 200 })
    const P: Particle[] = []
    for (let i = 0; i < NDOT; i++) P.push(mk(false))
    // 같은 차선의 조각은 같은 속도라 서로 겹치지 않는다
    const lanes = Array.from({ length: LANES }, (_, i) => {
      const z = rnd()
      return { u: (i + 0.5 + (rnd() - 0.5) * 0.5) / LANES, z, v: SPEED * (0.4 + z) * (0.9 + rnd() * 0.2), list: [] as Particle[] }
    })
    const C: Particle[] = []
    for (const ln of lanes) for (let j = 0; j < PER; j++) { const p = mk(true); p.ln = ln; p.z = ln.z; ln.list.push(p); C.push(p) }
    C.sort((a, b) => a.z - b.z)
    const chipScale = (z: number) => 0.62 + 0.5 * z
    const tierOf = (z: number) => (z < 0.38 ? 0 : z < 0.72 ? 1 : 2)
    function reset(p: Particle, x: number) {
      p.x = x; p.st = 0; p.t = 0; p.vy = 0
      if (!p.chip) { p.u = rnd(); p.v = SPEED * (0.4 + p.z) * (0.85 + rnd() * 0.3); return }
      p.u = p.ln!.u; p.v = p.ln!.v
      p.s = (rnd() * EV.length) | 0
      p.w = sprites.length ? sprites[0][p.s].w * chipScale(p.z) : 200
    }
    // 조각은 같은 차선 맨 뒤 조각 뒤에 붙여 다시 흘려보낸다
    function respawn(p: Particle) {
      if (!p.chip) return reset(p, -30 - rnd() * W * 0.25)
      let left = W
      for (const q of p.ln!.list) if (q !== p && q.st === 0) left = Math.min(left, q.x - q.w)
      reset(p, 0)
      p.x = Math.min(-20, left - 36 - rnd() * 160)
    }
    // 처음 배치: 차선마다 화면 안팎에 조각을 띄엄띄엄 놓는다
    function placeChips() {
      for (const ln of lanes) {
        let x = rnd() * W * 1.3
        for (const p of ln.list) { reset(p, x); x -= p.w + 36 + rnd() * 200 }
      }
    }

    // 화면 크기에 맞춰 자리 계산
    const off = (el: HTMLElement, top: HTMLElement) => { let x = 0, y = 0; while (el && el !== top) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent as HTMLElement } return [x, y] }
    function layout() {
      W = stage.clientWidth; H = cv.clientHeight; dpr = Math.min(devicePixelRatio || 1, 2)
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
      const sm = W < 860
      Gx = sm ? W * 0.62 : W * 0.5
      b1 = [76, H - 24]
      b2 = sm ? [200, H * 0.56] : [244, H - 136]
      gw = gtag.offsetWidth
      // 1장 문장 덩어리의 가운데와 높이 (바탕색 눌러 주기용)
      const t0 = eb.offsetTop, t1 = cta.offsetTop + cta.offsetHeight
      scrimY = intro.offsetTop + (t0 + t1) / 2
      scrimRy = Math.max(Math.min(H * 0.32, 300), (t1 - t0) * 0.8)
      const cy2 = (b2[0] + b2[1]) / 2
      // 대시보드: 3장 문장 아래, 높이가 모자라면 줄인다
      const dw = dash.offsetWidth, dh = dash.offsetHeight
      const top = sm ? 140 : 200, avail = H - top - (sm ? 14 : 28)
      ds = Math.min(1, avail / dh)
      dx = (W - dw * ds) / 2
      dy = top + Math.max(0, (avail - dh * ds) * 0.35)
      // 조각마다 출발 차선, 잠시 머무는 자리, 도착할 표 행
      chips.forEach((c, k) => {
        const w = c.offsetWidth, h = c.offsetHeight
        const lane = cy2 + (k - 2) * (sm ? 18 : 26) - h / 2
        const o = off(rows[k], dash), rh = rows[k].offsetHeight
        pos[k] = {
          a: [Gx - w - 14, lane],
          b: [Gx - w - 14 + Math.min(w * 0.55, 150) + 28, lane],
          s: sm ? [16, b2[1] + 26 + k * (h + 8)] : [Gx + 64, cy2 - 2.5 * (h + 14) + 7 + k * (h + 14)],
          r: [dx + (o[0] + (sm ? 12 : 16)) * ds, dy + (o[1] + rh / 2) * ds - (h * ds) / 2],
        }
      })
      // 처음 한 번만 입자를 화면에 흩어 둔다 (모바일 주소창 resize 때 튀지 않게)
      if (!placed) { placed = true; for (const p of P) reset(p, rnd() * (W + 200) - 100); placeChips() }
    }
    let placed = false

    // 스크롤 진행도 p (0~1) 에 따라 화면 요소 배치. 되감아도 같은 자리로 돌아온다
    let N = 18240
    function apply(p: number) {
      const o1 = seg(p, 0.05, 0.12)
      put(intro, 0, -70 * out3(o1), 1, 1 - o1)
      intro.style.visibility = o1 >= 1 ? 'hidden' : ''
      const i2 = out3(seg(p, 0.12, 0.18)), o2 = seg(p, 0.5, 0.54)
      put(head2, 0, 30 * (1 - i2) - 40 * o2, 1, i2 * (1 - o2))
      const i3 = out3(seg(p, 0.54, 0.6))
      put(head3, 0, 30 * (1 - i3), 1, i3)
      const g = seg(p, 0.13, 0.2) * (1 - seg(p, 0.5, 0.56))
      put(gtag, Gx - gw / 2, b2[0] - 46 + 8 * (1 - g), 1, g)
      const c = out3(seg(p, 0.16, 0.22)) * (1 - seg(p, 0.5, 0.54))
      count.style.transform = `translate3d(-50%,${12 * (1 - c)}px,0)`; count.style.opacity = String(c)

      // 걸린 위협 조각: 등장 → 게이트 통과하며 색이 바뀜 → 자리 → 표 행으로 비행
      let caught = 0
      chips.forEach((ch, k) => {
        const a = 0.22 + k * 0.05
        const e1 = seg(p, a, a + 0.01), e2 = io3(seg(p, a, a + 0.022)), e3 = seg(p, a + 0.014, a + 0.026), e4 = io3(seg(p, a + 0.024, a + 0.044))
        const f0 = 0.6 + k * 0.02, e5 = io3(seg(p, f0, f0 + 0.06)), e6 = seg(p, f0 + 0.052, f0 + 0.066)
        const { a: pa, b: pb, s: ps, r: pr } = pos[k]
        let x = pa[0] + (pb[0] - pa[0]) * e2, y = pa[1]
        x += (ps[0] - x) * e4; y += (ps[1] - y) * e4
        x += (pr[0] - x) * e5; y += (pr[1] - y) * e5 - Math.sin(Math.PI * e5) * 50
        put(ch, x, y, 1 + (ds - 1) * e5, e1 * (1 - seg(e6, 0, 0.55)))
        const kids = ch.children as HTMLCollectionOf<HTMLElement>
        kids[0].style.opacity = String(e3)
        kids[3].style.opacity = String(e3)
        kids[3].style.transform = `translateX(${12 * (1 - out3(e3))}px)`
        if (e3 > 0.5) caught++
        const row = rows[k]
        const r6 = seg(e6, 0.35, 1)
        const rc = row.children as HTMLCollectionOf<HTMLElement>
        rc[0].style.opacity = String(1 - e6)
        for (const el of rc[1].children as HTMLCollectionOf<HTMLElement>) el.style.opacity = String(r6)
        ;(rc[1].children[1] as HTMLElement).style.transform = `translateX(${-8 * (1 - out3(r6))}px)`
      })
      mEl.textContent = String(caught)

      // 대시보드 틀이 조립된다
      const d = out3(seg(p, 0.52, 0.6))
      dash.style.transform = `translate3d(${dx}px,${dy + 48 * (1 - d)}px,0) scale(${ds})`
      dash.style.opacity = String(d)
      parts.forEach((el, i) => {
        const e = out3(seg(p, 0.54 + i * 0.007, 0.6 + i * 0.007))
        el.style.opacity = String(e)
        el.style.transform = `translate3d(0,${14 * (1 - e)}px,0)`
      })
      // 숫자가 차오르고 막대가 자란다
      const kf = out3(seg(p, 0.66, 0.8))
      kvs.forEach((el) => (el.textContent = fmt(Math.round((el.dataset.live ? N : +el.dataset.to!) * kf))))
      cols.forEach((el, i) => (el.style.transform = `scaleY(${out3(seg(p, 0.68 + i * 0.014, 0.76 + i * 0.014))})`))
    }

    // 캔버스: 이벤트 흐름 + 탐지 게이트
    const flashes: { y: number; t: number; c: string }[] = []
    function draw(dt: number, t: number, p: number, k: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = col.bg
      ctx.fillRect(0, 0, W, H)
      if (k <= 0.001) return
      const m = io3(seg(p, 0.07, 0.22))
      const f = seg(p, 0.12, 0.2)
      const top = b1[0] + (b2[0] - b1[0]) * m, bot = b1[1] + (b2[1] - b1[1]) * m, h = bot - top, cy = (top + bot) / 2
      const conv = 0.18 + 0.36 * m, wid = W * (0.34 - 0.08 * m)
      const gate = seg(p, 0.1, 0.2) * (1 - seg(p, 0.5, 0.58))

      // 움직임: 흐르다가 게이트를 지나면 대부분 회색으로 떨어지고, 일부만 색을 띤다
      const step = (p0: Particle) => {
        const xo = p0.x
        if (p0.st === 0) {
          p0.x += p0.v * dt
          const gx = (p0.x - Gx) / wid
          p0.y = cy + (top + p0.u * h - cy) * (1 - conv * Math.exp(-gx * gx))
          const cross = xo < Gx && p0.x >= Gx && dt > 0
          if (cross && gate > 0.3) N++
          // 게이트를 막 지났거나, 필터가 켜질 때 이미 오른쪽에 있던 것도 차례로 떨어뜨린다
          if (f > 0 && ((cross && rnd() < f) || (p0.x > Gx && rnd() < f * dt * 3))) {
            p0.st = cross && p0.chip && rnd() < 0.08 ? 2 : 1
            p0.t = 0
            p0.vy = -30 + rnd() * 70
            p0.sev = rnd() < 0.4 ? 0 : rnd() < 0.6 ? 1 : 2
            if (cross && p0.chip) flashes.push({ y: p0.y, t: 0, c: p0.st === 2 ? SEV[p0.sev][0] : col.accentInkRgb })
          }
          if (p0.x - p0.w > W + 20) respawn(p0)
        } else {
          p0.t += dt
          if (p0.st === 1) { p0.x += p0.v * 0.3 * dt; p0.vy += 980 * dt; p0.y += p0.vy * dt }
          else p0.x += p0.v * 0.12 * dt
          if (p0.t > (p0.st === 1 ? 0.75 : 1.2)) respawn(p0)
        }
      }

      // 빛줄기 점: 알파 단계별로 묶어서 한 번에 채운다
      for (const p0 of P) step(p0)
      for (let c = 0; c < 2; c++) {
        for (let b = 0; b < BANDS; b++) {
          ctx.fillStyle = dotStyle[c][b]
          ctx.beginPath()
          for (const p0 of P) {
            if ((p0.st === 1) !== (c === 1)) continue
            let a = (0.1 + 0.55 * p0.z) * k
            if (p0.st === 1) a *= 1 - p0.t / 0.75
            const bi = (a * BANDS) | 0
            if (bi !== b) continue
            const len = p0.st ? 4 : 4 + p0.v * 0.05
            ctx.rect(p0.x - len, p0.y, len, p0.z > 0.75 ? 1.5 : 1)
          }
          ctx.fill()
        }
      }

      // 글자 조각: 먼 것부터 그린다
      for (const p0 of C) {
        step(p0)
        if (!sprites.length) continue
        const sp = p0.st === 2 ? hotSprite(p0.s, p0.sev) : sprites[p0.st === 1 ? 0 : tierOf(p0.z)][p0.s]
        const sc = chipScale(p0.z)
        let a = k
        if (p0.st === 1) a *= 0.7 * (1 - p0.t / 0.75)
        if (p0.st === 2) a = k * (p0.t < 0.7 ? 1 : 1 - (p0.t - 0.7) / 0.5)
        if (a <= 0.01) continue
        const x0 = p0.x - p0.w
        if (x0 > W || p0.x < 0) continue
        ctx.globalAlpha = a
        ctx.drawImage(sp.c, x0, p0.y - (sp.h * sc) / 2, sp.w * sc, sp.h * sc)
      }
      ctx.globalAlpha = 1

      // 1장 문장 뒤를 바탕색으로 눌러 글자가 읽히게 한다
      const scrim = 1 - seg(p, 0.11, 0.17)
      if (scrim > 0) {
        const rx = W < 860 ? W * 0.8 : Math.min(W * 0.52, 720), ry = scrimRy
        ctx.save()
        ctx.translate(W / 2, scrimY)
        ctx.scale(rx / ry, 1)
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, ry)
        gr.addColorStop(0, `rgba(${col.bgRgb},.97)`)
        gr.addColorStop(0.55, `rgba(${col.bgRgb},.9)`)
        gr.addColorStop(1, `rgba(${col.bgRgb},0)`)
        ctx.globalAlpha = scrim
        ctx.fillStyle = gr
        ctx.fillRect(-ry, -ry, ry * 2, ry * 2)
        ctx.restore()
        ctx.globalAlpha = 1
      }

      // 움직임 줄이기 화면: 흐름 아래 끝을 바탕색으로 녹인다
      if (REDUCE) {
        const gr = ctx.createLinearGradient(0, H - 160, 0, H)
        gr.addColorStop(0, `rgba(${col.bgRgb},0)`)
        gr.addColorStop(1, `rgba(${col.bgRgb},1)`)
        ctx.fillStyle = gr
        ctx.fillRect(0, H - 160, W, 160)
      }

      // 탐지 게이트: 세로 선 + 눈금 + 위아래로 훑는 구간 + 통과할 때 깜빡임
      if (gate > 0) {
        const gt = b2[0] - 14, gb = b2[1] + 14, gl = (gb - gt) * out3(gate)
        ctx.globalAlpha = gate
        ctx.fillStyle = `rgba(${col.accentRgb},.9)`
        ctx.fillRect(Gx - 0.5, gt, 1, gl)
        ctx.fillStyle = `rgba(${col.accentInkRgb},.22)`
        ctx.beginPath()
        for (let y = gt; y < gt + gl; y += 14) ctx.rect(Gx - 4, y, 8, 1)
        ctx.fill()
        const sy = gt + ((Math.sin(t * 1.3) + 1) / 2) * Math.max(0, gl - 70)
        ctx.fillStyle = col.accentInk
        ctx.fillRect(Gx - 1, sy, 2, 70)
        for (let i = flashes.length - 1; i >= 0; i--) {
          const fl = flashes[i]
          fl.t += dt
          if (fl.t > 0.4) { flashes.splice(i, 1); continue }
          ctx.fillStyle = `rgba(${fl.c},${(1 - fl.t / 0.4).toFixed(3)})`
          ctx.fillRect(Gx - 12, fl.y, 24, 1)
        }
        ctx.globalAlpha = 1
      } else flashes.length = 0
    }

    // 하나의 rAF 루프: 화면에 보일 때만 돈다
    let pT = 0, pS = 0, t = 0, last = 0, running = false, inView = true
    const st = { k: 0 }
    function frame(now: number) {
      if (!inView) { running = false; return }
      const dt = Math.min(0.05, (now - last) / 1000 || 0)
      last = now; t += dt
      const prev = pS
      pS += (pT - pS) * (1 - Math.exp(-dt * 10))
      if (Math.abs(pT - pS) < 0.0004) pS = pT
      if (pS !== prev || pS > 0.6) apply(pS)
      draw(dt, t, pS, st.k * (1 - seg(pS, 0.52, 0.64)))
      nEl.textContent = fmt(N)
      raf = requestAnimationFrame(frame)
    }
    const start = () => { if (!running && inView) { running = true; last = performance.now(); raf = requestAnimationFrame(frame) } }

    const fontsReady = document.fonts ? Promise.race([document.fonts.load("500 12px 'JetBrains Mono'"), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve()
    let still: (() => void) | null = null
    // 테마가 바뀌면 색을 다시 읽고 문구 조각을 새 색으로 다시 그린다 (스크롤 진행도는 그대로)
    offs.push(onThemeChange(() => { readColors(); if (sprites.length) buildSprites(); still?.() }))

    if (REDUCE) {
      // 움직임 줄이기: 고정 없이 최종 대시보드와 모든 문장
      stage.classList.add('hx-static')
      still = () => {
        cv.style.height = intro.offsetTop + intro.offsetHeight + 'px'
        layout(); apply(1); intro.style.visibility = ''; draw(0, 0, 0, 1)
      }
      fontsReady.then(() => { if (dead) return; buildSprites(); still!() })
      const onResize = () => still!()
      addEventListener('resize', onResize)
      offs.push(() => removeEventListener('resize', onResize))
      return cleanup
    }

    layout()
    apply(0)
    fontsReady.then(() => { if (dead) return; buildSprites(); placeChips(); layout(); apply(pS) })

    const onResize = () => { layout(); apply(pS) }
    addEventListener('resize', onResize)
    offs.push(() => removeEventListener('resize', onResize))
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; start() })
    io.observe(stage)
    offs.push(() => io.disconnect())
    start()

    // gsap 연출은 context 안에서 만들어 언마운트 때 한 번에 되돌린다
    const gc = gsap.context(() => {
      // 첫 진입: 문장이 아래에서 올라오고 흐름이 번진다
      gsap.set(words, { yPercent: 115 })
      gsap.set([eb, sub, cta], { opacity: 0, y: 16 })
      gsap.timeline({ delay: 0.1 })
        .to(st, { k: 1, duration: 1.4, ease: 'power2.out' }, 0)
        .to(eb, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.15)
        .to(words, { yPercent: 0, duration: 1.05, ease: 'power4.out', stagger: 0.09 }, 0.25)
        .to([sub, cta], { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }, 0.7)

      ScrollTrigger.create({
        trigger: root, start: 'top top', end: '+=320%', pin: true,
        onUpdate: (s) => { pT = s.progress; start() },
      })
    }, root)
    offs.push(() => gc.revert())
    return cleanup

  }, [])

  return (
    <section id="hero" ref={rootRef} className="hx" aria-label="EDRdog 소개">
      <div className="hx-stage">
        <canvas className="hx-cv" aria-hidden="true"></canvas>

        <div className="hx-intro">
          <p className="eyebrow hx-eb">ENDPOINT DETECTION &amp; RESPONSE</p>
          <h1 className="hx-h1"><span className="hx-ln"><span className="hx-w">수많은</span> <span className="hx-w">이벤트</span> <span className="hx-w">속에서</span></span></h1>
          <p className="hx-sub">서버와 PC에서 일어나는 이상 행동을 실시간으로 잡아내고, 어떤 위협부터 처리해야 할지 짚어 드립니다.</p>
          <div className="hx-cta"><Link className="btn primary" to="/dashboard">데모 보기</Link><Link className="btn" to="/login">로그인</Link></div>
        </div>

        <p className="h2 hx-head hx-head2">위협만 골라내고</p>
        <p className="h2 hx-head hx-head3">한 화면에 정리합니다</p>

        <div className="hx-gtag" aria-hidden="true"><i></i>탐지 규칙 312개</div>
        <div className="hx-count" aria-hidden="true">
          <div>들어온 이벤트 <b id="hx-n">18,240</b></div>
          <div>걸러낸 위협 <b className="hx-m" id="hx-m">0</b></div>
        </div>

        <div className="hx-dash" aria-hidden="true">
          <aside className="hx-d-side hx-dp">
            <div className="hx-d-brand"><img src="/logo.png" alt="" />EDRdog</div>
            <div className="hx-d-nav">
              <span className="hx-on"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>대시보드</span>
              <h6>TRIAGE</h6>
              <span><svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>위협<em>5</em></span>
              <span><svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/></svg>사건</span>
              <h6>EVIDENCE</h6>
              <span><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/></svg>엔드포인트</span>
              <span><svg viewBox="0 0 24 24"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>수집 로그</span>
              <h6>ANALYSIS</h6>
              <span><svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.5 8 11 16M16.5 8 13 16"/></svg>관계 분석</span>
            </div>
          </aside>
          <div className="hx-d-main">
            <header className="hx-d-top hx-dp"><div><small>EDRDOG / OVERVIEW</small><b>대시보드</b></div><span className="hx-d-search">호스트·위협·로그 검색</span></header>
            <div className="hx-d-body">
              <div className="card hx-d-strip hx-dp">
                <div><span className="hx-live"></span>LIVE SIGNAL</div>
                <div>24시간 수집 이벤트<b className="hx-kv" data-live="1">0</b></div>
                <div>탐지 규칙<b>312</b></div>
                <div>규칙 적중<b className="hx-kv" data-to="5">0</b></div>
                <div>온라인 엔드포인트<b>126 / 128</b></div>
              </div>
              <div className="hx-d-kpis">
                <div className="card hx-d-kpi hx-dp"><span>미판단 위협</span><b className="hx-kv" data-to="5">0</b><p>판단을 기다리는 위협</p></div>
                <div className="card hx-d-kpi hx-dp"><span>심각 위협</span><b className="hx-kv" data-to="2" style={{ color: 'var(--crit)' }}>0</b><p>즉시 조치가 필요한 항목</p></div>
                <div className="card hx-d-kpi hx-dp"><span>위험 엔드포인트</span><b style={{ color: 'var(--high)' }}><span className="hx-kv" data-to="3" style={{ display: 'inline', font: 'inherit', color: 'inherit' }}>0</span><small> / 128</small></b><p>위험 등급 호스트</p></div>
                <div className="card hx-d-kpi hx-dp"><span>오늘 들어온 이벤트</span><b className="hx-kv" data-live="1">0</b><p>모든 엔드포인트 합계</p></div>
              </div>
              <div className="hx-d-grid">
                <div className="card hx-dp">
                  <div className="hx-d-ph"><b>최근 탐지된 위협</b><span>실시간</span></div>
                  <div className="hx-d-th"><span>THREAT</span><span>HOST</span><span>SEV</span><span>TIME</span></div>
                  <div className="hx-rows">
                    <div className="hx-row hx-crit"><div className="hx-row-ph"><i style={{ width: '38%' }}></i><i style={{ width: '14%', marginLeft: 'auto' }}></i></div><div className="hx-row-c"><i className="hx-row-bar"></i><div className="hx-row-t"><b>문서 대량 암호화 시도</b><code>T1486 · ransomware_mass_encrypt</code></div><span className="hx-row-h">WIN-FIN-02</span><span><span className="badge crit"><i></i>심각</span></span><span className="hx-row-d">02:53:54</span></div></div>
                    <div className="hx-row hx-crit"><div className="hx-row-ph"><i style={{ width: '30%' }}></i><i style={{ width: '14%', marginLeft: 'auto' }}></i></div><div className="hx-row-c"><i className="hx-row-bar"></i><div className="hx-row-t"><b>LSASS 메모리 접근</b><code>T1003.001 · lsass_memory_access</code></div><span className="hx-row-h">WIN-DEV-01</span><span><span className="badge crit"><i></i>심각</span></span><span className="hx-row-d">02:17:54</span></div></div>
                    <div className="hx-row hx-high"><div className="hx-row-ph"><i style={{ width: '42%' }}></i><i style={{ width: '14%', marginLeft: 'auto' }}></i></div><div className="hx-row-c"><i className="hx-row-bar"></i><div className="hx-row-t"><b>인코딩된 PowerShell 명령 실행</b><code>T1059.001 · powershell_encoded_command</code></div><span className="hx-row-h">WIN-HR-03</span><span><span className="badge high"><i></i>높음</span></span><span className="hx-row-d">01:06:18</span></div></div>
                    <div className="hx-row hx-high"><div className="hx-row-ph"><i style={{ width: '34%' }}></i><i style={{ width: '14%', marginLeft: 'auto' }}></i></div><div className="hx-row-c"><i className="hx-row-bar"></i><div className="hx-row-t"><b>시작 프로그램 무단 등록</b><code>T1547.001 · registry_run_key</code></div><span className="hx-row-h">WIN-HR-03</span><span><span className="badge high"><i></i>높음</span></span><span className="hx-row-d">00:41:07</span></div></div>
                    <div className="hx-row hx-med"><div className="hx-row-ph"><i style={{ width: '28%' }}></i><i style={{ width: '14%', marginLeft: 'auto' }}></i></div><div className="hx-row-c"><i className="hx-row-bar"></i><div className="hx-row-t"><b>비정상 시간대 로그인</b><code>T1078 · off_hours_login</code></div><span className="hx-row-h">SRV-DB-01</span><span><span className="badge med"><i></i>보통</span></span><span className="hx-row-d">00:12:30</span></div></div>
                  </div>
                </div>
                <div className="card hx-d-chart hx-dp">
                  <div className="hx-d-ph"><b>심각도별 탐지</b><span>최근 7일</span></div>
                  <div className="hx-d-plot"></div>
                  <div className="hx-d-days"><span>11/5</span><span>11/6</span><span>11/7</span><span>11/8</span><span>11/9</span><span>11/10</span><span>오늘</span></div>
                  <div className="hx-d-legend"><span><i style={{ background: 'var(--crit)' }}></i>심각</span><span><i style={{ background: 'var(--high)' }}></i>높음</span><span><i style={{ background: 'var(--med)' }}></i>보통</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hx-chip hx-crit" aria-hidden="true"><i className="hx-chip-t"></i><span className="hx-chip-k">file</span><span className="hx-chip-v">x214 .docx › .locked</span><span className="hx-chip-r">T1486</span></div>
        <div className="hx-chip hx-crit" aria-hidden="true"><i className="hx-chip-t"></i><span className="hx-chip-k">proc</span><span className="hx-chip-v">rundll32.exe comsvcs.dll MiniDump</span><span className="hx-chip-r">T1003.001</span></div>
        <div className="hx-chip hx-high" aria-hidden="true"><i className="hx-chip-t"></i><span className="hx-chip-k">proc</span><span className="hx-chip-v">powershell.exe -enc JABzAD0A…</span><span className="hx-chip-r">T1059.001</span></div>
        <div className="hx-chip hx-high" aria-hidden="true"><i className="hx-chip-t"></i><span className="hx-chip-k">reg</span><span className="hx-chip-v">HKCU\…\Run\updater</span><span className="hx-chip-r">T1547.001</span></div>
        <div className="hx-chip hx-med" aria-hidden="true"><i className="hx-chip-t"></i><span className="hx-chip-k">auth</span><span className="hx-chip-v">login svc_backup 00:12</span><span className="hx-chip-r">T1078</span></div>
      </div>
    </section>
  )
}

export default Hero
