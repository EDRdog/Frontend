import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger, prefersReduced, cssVar, onThemeChange } from './utils'
import { COLS, ROWS, LAT0, CELL, LAND_B64 } from './mapData'

// 위협 지도 + 관계 분석: 점 세계 지도로 들어오는 연결을 그리고, 사건 하나의 흔적을 선으로 잇는다.
function ThreatMap() {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = rootRef.current!
    const R = prefersReduced()
    const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!
    const $$ = (s: string) => [...root.querySelectorAll<HTMLElement>(s)]
    // 캔버스 색: .landing 의 CSS 변수에서 읽고, 테마가 바뀌면 다시 읽는다
    const landing = root.closest('.landing') || root
    const C: Record<string, string> = {}
    const readColors = () => {
      const v = (n: string) => cssVar(landing, n)
      Object.assign(C, {
        dot: v('--line-strong'),
        faint: v('--faint'),
        accent: v('--accent'),
        accentInk: v('--accent-ink'),
        ink: v('--ink'),
        crit: v('--crit'),
        high: v('--high'),
      })
    }
    readColors()
    // gsap 트윈은 context 에 모아 언마운트 때 한 번에 되돌린다 (rAF 안에서 만드는 트윈도 gc.add 로 모은다)
    const gc = gsap.context(() => {}, root)
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const out3 = (t: number) => 1 - Math.pow(1 - t, 3)
    const clamp = (v: number) => Math.max(0, Math.min(1, v))

    /* ---------- 1. 위협 지도 ---------- */

    const raw = atob(LAND_B64)
    const isLand = (c: number, r: number) =>
      (raw.charCodeAt((r * COLS + c) >> 3) >> (7 - ((r * COLS + c) & 7))) & 1

    const HOME = { lat: 37.57, lon: 126.98 }
    type Src = {
      cc: string
      name: string
      ip: string
      lat: number
      lon: number
      sev: 'crit' | 'high'
      n: number
      li?: HTMLElement
      cnt?: HTMLElement
    }
    const SRC: Src[] = [
      {
        cc: 'RU',
        name: '러시아 · 모스크바',
        ip: '91.243.44.130',
        lat: 55.75,
        lon: 37.62,
        sev: 'crit',
        n: 214,
      },
      {
        cc: 'DE',
        name: '독일 · 프랑크푸르트',
        ip: '185.220.101.4',
        lat: 50.11,
        lon: 8.68,
        sev: 'crit',
        n: 198,
      },
      {
        cc: 'NL',
        name: '네덜란드 · 암스테르담',
        ip: '45.137.21.9',
        lat: 52.37,
        lon: 4.9,
        sev: 'high',
        n: 176,
      },
      {
        cc: 'US',
        name: '미국 · 애시번',
        ip: '23.94.180.12',
        lat: 39.04,
        lon: -77.49,
        sev: 'high',
        n: 149,
      },
      {
        cc: 'SG',
        name: '싱가포르',
        ip: '103.152.36.18',
        lat: 1.35,
        lon: 103.82,
        sev: 'high',
        n: 131,
      },
      {
        cc: 'BR',
        name: '브라질 · 상파울루',
        ip: '177.54.150.200',
        lat: -23.55,
        lon: -46.63,
        sev: 'high',
        n: 118,
      },
    ]
    const SEV = { crit: '심각', high: '높음' }

    // 목록 행
    const ul = $('#mp-rows'),
      totalEl = $('#mp-total')
    let total = 1284
    for (const s of SRC) {
      const li = document.createElement('li')
      li.className = 'mp-row'
      li.innerHTML = `<span class="mp-fl"></span><span class="mp-band" style="background:var(--${s.sev})"></span>
        <div class="mp-ra"><span class="mono">${s.ip}</span><span class="badge ${s.sev}"><i></i>${SEV[s.sev]}</span></div>
        <div class="mp-rb"><span><b class="mono">${s.cc}</b>${s.name}</span><span class="mp-cnt mono">${s.n}<small>회</small></span></div>`
      s.li = li
      s.cnt = li.querySelector<HTMLElement>('.mp-cnt')!
      ul.appendChild(li)
    }

    // 연결이 도착하면 숫자를 올리고, 순위가 바뀌면 행을 부드럽게 옮긴다(FLIP)
    function onLand(s: Src) {
      const add = 1 + ((Math.random() * 3) | 0)
      s.n += add
      total += add
      s.cnt!.firstChild!.nodeValue = String(s.n)
      totalEl.textContent = total.toLocaleString('en-US')
      gc.add(() => {
        gsap.fromTo(
          s.li!.firstChild,
          { opacity: 1 },
          { opacity: 0, duration: 1.4, ease: 'power2.out' },
        )
        gsap.fromTo(
          s.cnt!,
          { y: -5, opacity: 0.3 },
          { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' },
        )
        const order = [...SRC].sort((a, b) => b.n - a.n)
        if (order.every((o, i) => ul.children[i] === o.li)) return
        const before = new Map(order.map((o) => [o.li!, o.li!.getBoundingClientRect().top]))
        order.forEach((o) => ul.appendChild(o.li!))
        for (const o of order) {
          const dy = before.get(o.li!)! - o.li!.getBoundingClientRect().top
          if (dy) gsap.fromTo(o.li!, { y: dy }, { y: 0, duration: 0.7, ease: 'power3.out' })
        }
      })
    }

    // 캔버스
    const box = $('.mp-mapbox'),
      cv = $<HTMLCanvasElement>('#mp-canvas'),
      ctx = cv.getContext('2d')!
    const layer = document.createElement('canvas'),
      lctx = layer.getContext('2d')!
    let W = 0,
      H = 0,
      top = 0,
      mapH = 0,
      dpr = 1,
      dotR = 1,
      twinkles: number[][] = []
    const px = (lon: number) => ((lon + 180) / 360) * W
    const py = (lat: number) => top + ((LAT0 - lat) / (ROWS * CELL)) * mapH
    const disc = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      c.beginPath()
      c.arc(x, y, r, 0, 6.2832)
      c.fill()
    }

    // 점 지도를 한 번만 그려 둔다(크기가 바뀔 때만 다시)
    function size() {
      W = box.clientWidth
      mapH = (W * ROWS) / COLS
      top = Math.round(W * 0.05)
      H = Math.round(mapH + top)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      for (const c of [cv, layer]) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
      }
      cv.style.height = H + 'px'
      const pitch = W / COLS,
        step = pitch < 3.2 ? 2 : 1
      dotR = Math.max(0.75, pitch * step * 0.3)
      const hx = px(HOME.lon),
        hy = py(HOME.lat),
        dots: number[][] = []
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lctx.clearRect(0, 0, W, H)
      for (let r = 0; r < ROWS; r += step)
        for (let c = 0; c < COLS; c += step) {
          // 좁은 화면은 2x2 칸을 하나로 합친다(작은 섬이 사라지지 않게 OR)
          if (!(
            isLand(c, r) ||
            (step === 2 && (isLand(c + 1, r) || isLand(c, r + 1) || isLand(c + 1, r + 1)))
          ))
            continue
          const x = (c + step / 2) * pitch,
            y = top + (r + step / 2) * pitch
          const edge = Math.min(1, Math.min(x, W - x) / (W * 0.07))
          const near = Math.max(0, 1 - Math.hypot(x - hx, y - hy) / (W * 0.11))
          lctx.globalAlpha = edge
          lctx.fillStyle = C.dot
          disc(lctx, x, y, dotR)
          if (near > 0) {
            lctx.globalAlpha = near * 0.9 * edge
            lctx.fillStyle = C.faint
            disc(lctx, x, y, dotR)
          }
          dots.push([x, y])
        }
      lctx.globalAlpha = 1
      twinkles = Array.from({ length: 70 }, () => {
        const d = dots[(Math.random() * dots.length) | 0]
        return [d[0], d[1], Math.random() * 6.28, 0.0006 + Math.random() * 0.0012]
      })
      if (R) drawStatic()
    }

    function curve(s: Src) {
      const x0 = px(s.lon),
        y0 = py(s.lat),
        x2 = px(HOME.lon),
        y2 = py(HOME.lat)
      const d = Math.hypot(x2 - x0, y2 - y0)
      return [x0, y0, (x0 + x2) / 2, Math.max(2, (y0 + y2) / 2 - d * 0.3), x2, y2]
    }
    const qb = (k: number[], t: number) => {
      const u = 1 - t
      return [
        u * u * k[0] + 2 * u * t * k[2] + t * t * k[4],
        u * u * k[1] + 2 * u * t * k[3] + t * t * k[5],
      ]
    }
    function strokePart(k: number[], a: number, b: number, n: number) {
      ctx.beginPath()
      for (let j = 0; j <= n; j++) {
        const p = qb(k, a + ((b - a) * j) / n)
        if (j) ctx.lineTo(p[0], p[1])
        else ctx.moveTo(p[0], p[1])
      }
      ctx.stroke()
    }
    function drawHome(t: number) {
      const hx = px(HOME.lon),
        hy = py(HOME.lat)
      ctx.strokeStyle = C.accent
      ctx.lineWidth = 1
      for (const off of [0, 0.5]) {
        const e = (t / 3200 + off) % 1
        ctx.globalAlpha = (1 - e) * 0.55
        ctx.beginPath()
        ctx.arc(hx, hy, 5 + e * 22, 0, 6.2832)
        ctx.stroke()
      }
      ctx.fillStyle = C.accent
      ctx.globalAlpha = 0.22
      disc(ctx, hx, hy, 7)
      ctx.globalAlpha = 1
      disc(ctx, hx, hy, 3.4)
      ctx.fillStyle = C.ink
      disc(ctx, hx, hy, 1.2)
      ctx.fillStyle = C.accentInk
      ctx.font = '600 10px "JetBrains Mono", monospace'
      ctx.fillText('SEOUL', hx + 11, hy + 17)
    }
    function drawSources(alpha: number) {
      for (const s of SRC) {
        ctx.globalAlpha = alpha
        ctx.fillStyle = C[s.sev]
        disc(ctx, px(s.lon), py(s.lat), 2.2)
      }
      ctx.globalAlpha = 1
    }

    // 움직임을 끈 경우: 모든 경로를 그린 마지막 모습
    function drawStatic() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(layer, 0, 0, W, H)
      ctx.lineWidth = 1.2
      for (const s of SRC) {
        ctx.strokeStyle = C[s.sev]
        ctx.globalAlpha = 0.5
        strokePart(curve(s), 0, 1, 40)
      }
      drawSources(1)
      drawHome(800)
    }

    type Arc = { s: Src; t0: number; dur: number; landed: boolean }
    type Ring = { x: number; y: number; col: string; t0: number; dur: number; r: number }
    const arcs: Arc[] = [],
      rings: Ring[] = []
    let revealAt = -1,
      nextSpawn = 0
    const TAIL = 0.34
    function spawn(t: number) {
      const pool = SRC.flatMap((s) => (s.sev === 'crit' ? [s, s, s] : [s, s]))
      const s = pool[(Math.random() * pool.length) | 0]
      const k = curve(s)
      arcs.push({
        s,
        t0: t,
        dur: 1100 + (Math.hypot(k[4] - k[0], k[5] - k[1]) / W) * 1700,
        landed: false,
      })
      rings.push({ x: k[0], y: k[1], col: C[s.sev], t0: t, dur: 900, r: 12 })
    }

    function drawMap(t: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      if (revealAt < 0) return
      const hx = px(HOME.lon),
        hy = py(HOME.lat)
      const rv = clamp((t - revealAt) / 1900)
      // 처음 보일 때 서울에서 퍼져 나가며 지도가 드러난다
      if (rv < 1) {
        const rr = out3(rv) * Math.hypot(Math.max(hx, W - hx), Math.max(hy, H - hy))
        ctx.save()
        ctx.beginPath()
        ctx.arc(hx, hy, rr, 0, 6.2832)
        ctx.clip()
        ctx.drawImage(layer, 0, 0, W, H)
        ctx.restore()
        ctx.globalAlpha = 0.4 * (1 - rv)
        ctx.strokeStyle = C.accent
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(hx, hy, rr, 0, 6.2832)
        ctx.stroke()
      } else ctx.drawImage(layer, 0, 0, W, H)

      // 깜박이는 점 몇 개로 살아 있는 느낌
      ctx.fillStyle = C.faint
      for (const d of twinkles) {
        const a = Math.sin(t * d[3] + d[2])
        if (a > 0.55) {
          ctx.globalAlpha = (a - 0.55) * 2.2 * rv
          disc(ctx, d[0], d[1], dotR)
        }
      }
      drawSources(clamp(rv * 2 - 1))

      if (rv > 0.55 && t >= nextSpawn && arcs.length < 6) {
        spawn(t)
        nextSpawn = t + 380 + Math.random() * 520
      }

      // 연결 궤적: 밝은 머리 + 옅어지는 꼬리 + 지나간 길
      ctx.lineCap = 'round'
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i],
          k = curve(a.s),
          col = C[a.s.sev]
        const u = (t - a.t0) / a.dur
        const head = ease(clamp(u)),
          tail = ease(clamp(u - TAIL))
        const fade = u < 1 + TAIL ? 1 : 1 - (u - 1 - TAIL) / 0.6
        if (fade <= 0) {
          arcs.splice(i, 1)
          continue
        }
        ctx.strokeStyle = col
        ctx.globalAlpha = 0.16 * fade
        ctx.lineWidth = 1
        strokePart(k, 0, head, 36)
        const n = 22
        for (let j = 0; j < n; j++) {
          const f = (j + 1) / n
          ctx.globalAlpha = f * f
          ctx.lineWidth = 0.4 + 1.8 * f
          strokePart(k, tail + ((head - tail) * j) / n, tail + ((head - tail) * (j + 1)) / n, 2)
        }
        if (u < 1) {
          const p = qb(k, head)
          ctx.globalAlpha = 1
          ctx.fillStyle = col
          disc(ctx, p[0], p[1], 2.4)
          ctx.fillStyle = C.ink
          disc(ctx, p[0], p[1], 1.1)
        }
        if (u < 0.7) {
          ctx.globalAlpha = Math.sin((u / 0.7) * Math.PI)
          ctx.fillStyle = col
          ctx.font = '600 10px "JetBrains Mono", monospace'
          ctx.fillText(a.s.cc, k[0] + 7, k[1] - 7)
        }
        if (u >= 1 && !a.landed) {
          a.landed = true
          rings.push({ x: hx, y: hy, col, t0: t, dur: 1200, r: 24 })
          onLand(a.s)
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i],
          e = (t - g.t0) / g.dur
        if (e >= 1) {
          rings.splice(i, 1)
          continue
        }
        ctx.globalAlpha = (1 - e) * 0.85
        ctx.strokeStyle = g.col
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(g.x, g.y, 2 + out3(e) * g.r, 0, 6.2832)
        ctx.stroke()
      }
      ctx.globalAlpha = rv
      drawHome(t)
      ctx.globalAlpha = 1
    }

    /* ---------- 2. 관계 분석 ---------- */

    // d: 넓은 화면 좌표(viewBox 756x440), m: 좁은 화면 좌표(360x402, 없으면 생략)
    // k: high/crit 악성 경로, ctx 사건 맥락, off 무관
    type NodeDef = { id: string; t: string; l: string; d: number[]; m?: number[]; k: string }
    const NODES: NodeDef[] = [
      { id: 'kim', t: 'USER', l: 'kim', d: [66, 64], m: [92, 36], k: 'ctx' },
      { id: 'web', t: 'HOST', l: 'web-03', d: [66, 220], m: [268, 36], k: 'ctx' },
      { id: 'doc', t: 'FILE', l: 'invoice.docm', d: [265, 64], m: [92, 146], k: 'high' },
      { id: 'word', t: 'PROC', l: 'winword.exe', d: [265, 220], m: [268, 146], k: 'high' },
      { id: 'exp', t: 'PROC', l: 'explorer.exe', d: [265, 376], k: 'off' },
      { id: 'reg', t: 'REG', l: 'HKCU\\…\\Run', d: [464, 64], m: [92, 256], k: 'crit' },
      { id: 'ps', t: 'PROC', l: 'powershell.exe', d: [464, 220], m: [268, 256], k: 'crit' },
      { id: 'chr', t: 'PROC', l: 'chrome.exe', d: [464, 376], k: 'off' },
      { id: 'dom', t: 'DOMAIN', l: 'update-cdn.top', d: [663, 64], m: [92, 366], k: 'crit' },
      { id: 'ip', t: 'IP', l: '185.220.101.4', d: [663, 220], m: [268, 366], k: 'crit' },
      { id: 'lan', t: 'IP', l: '10.20.0.15', d: [663, 376], k: 'off' },
    ]
    // 그려지는 순서대로. 넷째 값은 경로 색(악성일 때)
    const EDGES = [
      ['kim', 'web', 'logon', 'ctx'],
      ['web', 'word', 'runs', 'ctx'],
      ['web', 'exp', 'runs', 'off'],
      ['doc', 'word', 'opened', 'high'],
      ['exp', 'chr', 'spawned', 'off'],
      ['word', 'ps', 'spawned', 'high'],
      ['chr', 'lan', ':443', 'off'],
      ['ps', 'reg', 'wrote', 'crit'],
      ['ps', 'ip', ':443', 'crit'],
      ['dom', 'ip', 'resolves', 'crit'],
    ]
    const NS = 'http://www.w3.org/2000/svg'
    const svg = $('#mp-graph') as unknown as SVGSVGElement,
      card = $('.mp-gcard'),
      verdict = $('.mp-verdict'),
      relEl = $('#mp-rel')
    const mk = (tag: string, at: Record<string, string | number>, parent: Element) => {
      const e = document.createElementNS(NS, tag)
      for (const k in at) e.setAttribute(k, String(at[k]))
      parent.appendChild(e)
      return e
    }
    const bad = (k: string) => k === 'high' || k === 'crit'

    type Box = { x: number; y: number; w: number; h: number; k: string }
    function edgePath(a: Box, b: Box) {
      const dx = b.x - a.x,
        dy = b.y - a.y
      if (Math.abs(dy) < 1) {
        const s = Math.sign(dx)
        return `M${a.x + (s * a.w) / 2} ${a.y}H${b.x - (s * b.w) / 2}`
      }
      if (Math.abs(dx) < 1) {
        const s = Math.sign(dy)
        return `M${a.x} ${a.y + (s * a.h) / 2}V${b.y - (s * b.h) / 2}`
      }
      const s = Math.sign(dx),
        x1 = a.x + (s * a.w) / 2,
        x2 = b.x - (s * b.w) / 2,
        xm = (x1 + x2) / 2
      return `M${x1} ${a.y}C${xm} ${a.y} ${xm} ${b.y} ${x2} ${b.y}`
    }
    const dash = (p: SVGPathElement) => {
      const l = p.getTotalLength()
      p.style.strokeDasharray = String(l)
      p.style.strokeDashoffset = String(l)
      return l
    }

    // 그려 둔 그래프의 조각들: 장면과 신호 애니메이션이 이걸 움직인다
    type Graph = {
      nodes: SVGElement[]
      edges: { p: SVGPathElement; lab: SVGElement }[]
      mal: SVGPathElement[]
      hl: SVGElement[]
      off: SVGElement[]
      ctx: SVGElement[]
      pk: { c: SVGElement; p: SVGPathElement; len: number }[]
    }
    // 화면 폭에 맞는 그래프를 새로 그린다
    function build(desk: boolean): Graph {
      const S = desk
        ? { w: 756, h: 440, f: 13, cw: 7.8, nh: 54, tg: 9, pad: 28, ef: 9.5 }
        : { w: 360, h: 402, f: 11, cw: 6.6, nh: 46, tg: 8.5, pad: 22, ef: 8.5 }
      svg.replaceChildren()
      svg.setAttribute('viewBox', `0 0 ${S.w} ${S.h}`)
      const gE = mk('g', {}, svg),
        gM = mk('g', {}, svg),
        gL = mk('g', {}, svg),
        gP = mk('g', {}, svg),
        gN = mk('g', {}, svg)
      const G: Graph = { nodes: [], edges: [], mal: [], hl: [], off: [], ctx: [], pk: [] }
      const at: Record<string, Box> = {}
      for (const n of NODES) {
        const pos = desk ? n.d : n.m
        if (!pos) continue
        const tw = n.t.length * S.tg * 0.64 + 10,
          th = S.tg + 7
        const w = Math.max(n.l.length * S.cw, tw + 20) + S.pad,
          h = S.nh
        const o = mk('g', { transform: `translate(${pos[0]} ${pos[1]})` }, gN)
        const g = mk('g', {}, o)
        mk('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 10, class: 'mp-nb' }, g)
        const x0 = -w / 2 + S.pad / 2,
          ty = -h / 2 + (desk ? 10 : 8)
        mk('rect', { x: x0, y: ty, width: tw, height: th, rx: 3, class: 'mp-tg' }, g)
        mk(
          'text',
          {
            x: x0 + 5,
            y: ty + th / 2,
            'font-size': S.tg,
            'dominant-baseline': 'central',
            class: 'mp-tt',
          },
          g,
        ).textContent = n.t
        mk(
          'text',
          { x: x0, y: h / 2 - (desk ? 11 : 9), 'font-size': S.f, class: 'mp-lt' },
          g,
        ).textContent = n.l
        if (bad(n.k)) {
          const ring = mk(
            'rect',
            { x: -w / 2, y: -h / 2, width: w, height: h, rx: 10, class: 'mp-nh' },
            g,
          )
          ring.style.stroke = `var(--${n.k})`
          const dot = mk(
            'circle',
            { cx: w / 2 - S.pad / 2 - 2, cy: ty + th / 2, r: 3, class: 'mp-nd' },
            g,
          )
          dot.style.fill = `var(--${n.k})`
          G.hl.push(ring, dot)
        }
        at[n.id] = { x: pos[0], y: pos[1], w, h, k: n.k }
        G.nodes.push(g)
        if (n.k === 'off') G.off.push(g)
        if (n.k === 'ctx') G.ctx.push(g)
      }
      for (const [a, b, label, k] of EDGES) {
        if (!at[a] || !at[b]) continue
        const d = edgePath(at[a], at[b])
        const p = mk('path', { d, class: 'mp-e' }, gE) as SVGPathElement
        const len = dash(p)
        const mid = p.getPointAtLength(len / 2)
        const lab = mk('g', { class: 'mp-el' }, gL)
        const lw = label.length * S.ef * 0.6 + 10
        mk('rect', { x: mid.x - lw / 2, y: mid.y - 8, width: lw, height: 16, rx: 3 }, lab)
        mk(
          'text',
          {
            x: mid.x,
            y: mid.y,
            'font-size': S.ef,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
          },
          lab,
        ).textContent = label
        G.edges.push({ p, lab })
        if (k === 'off') G.off.push(p, lab)
        if (k === 'ctx') G.ctx.push(p, lab)
        if (bad(k)) {
          const o = mk('path', { d, class: 'mp-em' }, gM) as SVGPathElement
          o.style.stroke = `var(--${k})`
          dash(o)
          G.mal.push(o)
          const c = mk('circle', { r: desk ? 2.8 : 2.4, class: 'mp-pk' }, gP)
          c.style.fill = `var(--${k})`
          G.pk.push({ c, p: o, len })
        }
      }
      $('#mp-gcount').textContent = `노드 ${G.nodes.length} · 연결 ${G.edges.length}`
      return G
    }

    // 스크롤 장면: 모으기 -> 잇기 -> 판정
    function scene(G: Graph, desk: boolean) {
      // 좁은 화면은 단계 목록이 그래프와 함께 보이지 않으므로 목록은 그대로 둔다
      // 좁은 화면은 단계 목록을 움직이지 않으므로 값만 받는 빈 객체로 대신한다
      const dummy = () => Array.from({ length: 3 }, () => ({ opacity: 0, scaleX: 0 }))
      type Target = HTMLElement | { opacity: number; scaleX: number }
      const steps: Target[] = desk ? $$('.mp-steps li') : dummy()
      const bars: Target[] = desk ? $$('.mp-steps li').map((li) => li.querySelector('i')!) : dummy()
      const tl = gsap.timeline({ defaults: { ease: 'none' } })
      tl.set(steps, { opacity: 0.38 }, 0).set(bars, { scaleX: 0 }, 0)
      tl.to(steps[0], { opacity: 1, duration: 0.1 }, 0)
      const spread = desk ? 70 : 40
      tl.from(
        G.nodes,
        {
          x: (i) => (((i * 7) % 11) - 5) * spread * 0.4,
          y: (i) => (((i * 5) % 9) - 4) * spread * 0.45,
          opacity: 0,
          scale: 0.88,
          transformOrigin: '50% 50%',
          duration: 0.7,
          stagger: 0.03,
          ease: 'power2.out',
        },
        0,
      )
      tl.to(bars[0], { scaleX: 1, duration: 1 }, 0)

      tl.to(steps[0], { opacity: 0.38, duration: 0.1 }, 1).to(
        steps[1],
        { opacity: 1, duration: 0.1 },
        1,
      )
      G.edges.forEach((e, i) => {
        tl.to(e.p, { strokeDashoffset: 0, duration: 0.32 }, 1 + i * 0.13)
        tl.to(e.lab, { opacity: 1, duration: 0.12 }, 1.24 + i * 0.13)
      })
      tl.to(bars[1], { scaleX: 1, duration: 1.6 }, 1)

      const P = 2.85
      tl.to(steps[1], { opacity: 0.38, duration: 0.1 }, P).to(
        steps[2],
        { opacity: 1, duration: 0.1 },
        P,
      )
      // 좁은 화면에는 무관한 노드가 없다
      if (G.off.length) tl.to(G.off, { opacity: 0.14, duration: 0.4 }, P)
      tl.to(G.ctx, { opacity: 0.6, duration: 0.4 }, P)
      G.mal.forEach((o, i) =>
        tl.to(o, { strokeDashoffset: 0, duration: 0.3, ease: 'power1.inOut' }, P + 0.1 + i * 0.2),
      )
      tl.to(G.hl, { opacity: 1, duration: 0.25, stagger: 0.06 }, P + 0.1)
      tl.to(bars[2], { scaleX: 1, duration: 1.3 }, P)
      tl.fromTo(
        verdict,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
        P + 1.15,
      )
      tl.to({}, { duration: 0.35 })
      return tl
    }

    // 판정이 끝나면 악성 경로 위로 신호가 흐른다
    let G: Graph | null = null,
      relHi = false
    function drawPackets(t: number) {
      if (!G) return
      G.pk.forEach((k, i) => {
        if (!relHi) {
          k.c.style.opacity = '0'
          return
        }
        const e = (t / 1700 + i * 0.23) % 1
        const pt = k.p.getPointAtLength(e * k.len)
        k.c.setAttribute('transform', `translate(${pt.x} ${pt.y})`)
        k.c.style.opacity = String(Math.sin(e * Math.PI))
      })
    }

    /* ---------- 공통: 한 개의 rAF, 화면 밖이면 멈춤 ---------- */
    let clock = 0,
      last = 0,
      raf = 0,
      mapOn = false,
      relOn = false
    function frame(now: number) {
      clock += last ? Math.min(now - last, 50) : 16
      last = now
      if (mapOn) drawMap(clock)
      if (relOn) drawPackets(clock)
      raf = mapOn || relOn ? requestAnimationFrame(frame) : 0
      if (!raf) last = 0
    }
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }

    // 크기를 바꾸면 관찰 대상이 또 바뀌어 루프 오류가 나므로 다음 프레임에 처리한다
    let roRaf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(roRaf)
      roRaf = requestAnimationFrame(size)
    })
    ro.observe(box)
    // 테마가 바뀌면 색을 다시 읽고 점 지도 레이어를 새 색으로 다시 그린다 (스크롤 진행도는 그대로)
    const offTheme = onThemeChange(() => {
      readColors()
      if (W) size()
    })
    const cleanup = () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(roRaf)
      ro.disconnect()
      offTheme()
      mm.revert()
      gc.revert()
      ul.replaceChildren()
      svg.replaceChildren()
    }

    const mm = gsap.matchMedia(root)
    mm.add({ desk: '(min-width: 861px)', mob: '(max-width: 860px)' }, (c) => {
      const desk = !!c.conditions?.desk
      G = build(desk)
      relHi = false
      const tl = scene(G, desk)
      if (R) {
        tl.progress(1)
        return
      }
      ScrollTrigger.create(
        desk
          ? {
              trigger: relEl,
              pin: true,
              start: 'center center',
              end: '+=1700',
              scrub: 0.8,
              anticipatePin: 1,
              animation: tl,
              onUpdate: (s) => {
                relHi = s.progress > 0.92
              },
            }
          : {
              trigger: card,
              pin: true,
              start: 'center center',
              end: '+=1100',
              scrub: 0.6,
              anticipatePin: 1,
              animation: tl,
              onUpdate: (s) => {
                relHi = s.progress > 0.92
              },
            },
      )
    })

    if (R) return cleanup

    // 문장 등장
    gc.add(() => {
      gsap.from($$('.mp-up'), {
        y: 28,
        opacity: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: $('.mp-head'), start: 'top 82%' },
      })
      gsap.from($$('.mp-up2'), {
        y: 28,
        opacity: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: relEl, start: 'top 85%' },
      })
      gsap.from($('.mp-list'), {
        y: 24,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: box, start: 'top 80%' },
      })
      ScrollTrigger.create({
        trigger: box,
        start: 'top 78%',
        once: true,
        onEnter: () => {
          revealAt = clock
          nextSpawn = clock + 1100
          wake()
        },
      })
    })

    const ioMap = new IntersectionObserver(([e]) => {
      mapOn = e.isIntersecting
      if (mapOn) wake()
    })
    ioMap.observe(box)
    const ioRel = new IntersectionObserver(([e]) => {
      relOn = e.isIntersecting
      if (relOn) wake()
    })
    ioRel.observe(card)
    return () => {
      ioMap.disconnect()
      ioRel.disconnect()
      cleanup()
    }
  }, [])

  return (
    <section id="map" ref={rootRef} className="mp" aria-labelledby="mp-title">
      <div className="wrap">
        <div className="mp-head">
          <div>
            <p className="eyebrow mp-up">THREAT MAP</p>
            <h2 className="h2 mp-up" id="mp-title">
              어디서 들어오는지
              <br />
              한눈에
            </h2>
          </div>
          <p className="lead mp-up">
            에이전트가 수집한 외부 연결을 지도 위에 그립니다. 위험한 목적지는 색으로 떠오르고, 어느
            나라에서 몇 번 들어왔는지 바로 보입니다.
          </p>
        </div>

        <div className="mp-stage">
          <div className="mp-mapbox">
            <canvas
              id="mp-canvas"
              role="img"
              aria-label="서울 본사로 들어오는 외부 연결을 나라별로 보여주는 세계 지도"
            ></canvas>
            <div className="mp-legend">
              <span>
                <i style={{ background: 'var(--crit)' }}></i>심각
              </span>
              <span>
                <i style={{ background: 'var(--high)' }}></i>높음
              </span>
              <span>
                <i style={{ background: 'var(--accent)' }}></i>서울 본사
              </span>
              <span className="mp-coord">37.57N 126.98E</span>
            </div>
          </div>
          <aside className="card mp-list" aria-label="실시간 외부 연결 목록">
            <div className="mp-list-hd">
              <b>외부 연결</b>
              <small>최근 24시간</small>
              <span className="badge good">
                <i></i>LIVE
              </span>
            </div>
            <ul id="mp-rows"></ul>
            <div className="mp-list-ft">
              <span>오늘 차단한 연결</span>
              <b id="mp-total">1,284</b>
            </div>
          </aside>
        </div>

        <div className="mp-rel" id="mp-rel">
          <div className="mp-rel-text">
            <p className="eyebrow mp-up2">RELATION</p>
            <h2 className="h2 mp-up2">
              흩어진 흔적을
              <br />
              하나로 잇습니다
            </h2>
            <p className="lead mp-up2">
              프로세스, 파일, 레지스트리, 네트워크 기록을 사건 하나로 묶습니다. 공격이 어디서 시작해
              어디까지 갔는지 선을 따라 읽으면 됩니다.
            </p>
            <ol className="mp-steps mp-up2">
              <li>
                <span className="mono">01</span>
                <div>
                  <b>흔적 모으기</b>
                  <p>호스트 한 대에서 나온 실행, 파일, 통신 기록</p>
                </div>
                <i></i>
              </li>
              <li>
                <span className="mono">02</span>
                <div>
                  <b>관계 잇기</b>
                  <p>누가 무엇을 실행했고 어디로 나갔는지</p>
                </div>
                <i></i>
              </li>
              <li>
                <span className="mono">03</span>
                <div>
                  <b>경로 판정</b>
                  <p>악성 경로만 남기고 나머지는 흐리게</p>
                </div>
                <i></i>
              </li>
            </ol>
          </div>
          <div className="card mp-gcard">
            <div className="mp-g-hd mono">
              <span>
                <b>INC-2417</b>web-03 · 상관 분석
              </span>
              <span id="mp-gcount"></span>
            </div>
            <svg
              id="mp-graph"
              role="img"
              aria-label="web-03 사건 관계도. invoice.docm 문서를 연 winword.exe 가 powershell.exe 를 실행했고, powershell.exe 가 자동 실행 레지스트리 키를 쓰고 185.220.101.4 와 통신했습니다."
            ></svg>
            <div className="mp-verdict">
              <span className="badge crit">
                <i></i>심각
              </span>
              <b>악성 매크로 문서에서 시작된 외부 통신</b>
              <span className="mp-ttp mono">
                <span>T1566.001</span>
                <span>T1059.001</span>
                <span>T1547.001</span>
                <span>T1071</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ThreatMap
