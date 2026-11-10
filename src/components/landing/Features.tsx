import { useEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { gsap, ScrollTrigger, prefersReduced, cssVar, onThemeChange } from './utils'

// 기능 요약 벤토 + 마지막 CTA. 타일마다 작은 실제 동작이 보이는 동안만 돈다.
function Features() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const offList: (() => void)[] = []
    const gc = gsap.context(() => {
      const root = rootRef.current!
      const R = prefersReduced()
      const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = root) =>
        r.querySelector<T>(s)!
      const $$ = (s: string, r: ParentNode = root) => [...r.querySelectorAll<HTMLElement>(s)]
      const offs = offList
      const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
      const rand = (a: number, b: number) => a + Math.random() * (b - a)

      // 줄을 단어 span 으로 나눈다 (문구는 이 파일의 고정 텍스트)
      const split = (line: HTMLElement) => {
        line.innerHTML = line
          .textContent!.trim()
          .split(/\s+/)
          .map((w) => `<span class="ft-w"><span>${w}</span></span>`)
          .join(' ')
        return $$('.ft-w > span', line)
      }

      // 보이기 시작하면 intro 한 번, 보이는 동안만 play
      const live = (
        el: HTMLElement,
        {
          intro,
          play,
          pause,
        }: { intro?: (() => void) | null; play?: () => void; pause?: () => void },
      ) =>
        ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          end: 'bottom top',
          onToggle: (s) => {
            if (s.isActive) {
              if (intro) {
                gc.add(intro)
                intro = null
              }
              play?.()
            } else pause?.()
          },
        })
      const ticker = (fn: () => void, ms: number) => {
        let id = 0
        return {
          play: () => {
            id ||= window.setInterval(fn, ms)
          },
          pause: () => {
            clearInterval(id)
            id = 0
          },
        }
      }

      const totalEnd = +$('#ft-total').textContent!
      // ----- 01 실시간 수집: 카운터 + 초당 막대 -----
      const count = $('#ft-count'),
        rate = $('#ft-rate'),
        spark = $('#ft-spark'),
        N = 60
      let total = 2481936,
        v = 0.5
      const nextV = () => {
        v = Math.min(0.9, Math.max(0.2, v + rand(-0.16, 0.16)))
        return Math.random() < 0.07 ? rand(0.88, 1) : v
      }
      spark.innerHTML = '<i></i>'.repeat(N + 1)
      const bars = $$('i', spark)
      bars.forEach((b) => gsap.set(b, { scaleY: nextV() }))
      const scroll = gsap.to(spark, {
        xPercent: -100 / (N + 1),
        duration: 1,
        ease: 'none',
        repeat: -1,
        paused: true,
        onRepeat() {
          const b = spark.firstElementChild!,
            val = nextV()
          spark.appendChild(b)
          gsap.set(b, { scaleY: val })
          rate.textContent = fmt(val * 1800)
        },
      })
      const tick = ticker(() => {
        total += rand(40, 190)
        count.textContent = fmt(total)
      }, 140)
      let tickTimer = 0

      // ----- 02 탐지 규칙: 무작위 규칙이 매칭된다 -----
      const rules = $$('.ft-rules li'),
        hits = $('#ft-hits')
      const hit = ticker(
        () =>
          gc.add(() => {
            const li = rules[Math.floor(Math.random() * rules.length)],
              n = $('b', li)
            if (getComputedStyle(li).display === 'none') return
            n.textContent = String(+n.textContent! + 1)
            hits.textContent = String(+hits.textContent! + 1)
            gsap
              .timeline()
              .fromTo(
                $('.ft-flash', li),
                { opacity: 1 },
                { opacity: 0, duration: 1.6, ease: 'power2.out' },
                0,
              )
              .fromTo(
                $('.ft-bar', li),
                { opacity: 1, scaleY: 1.6 },
                { opacity: 0.35, scaleY: 1, duration: 1.8, ease: 'power2.out' },
                0,
              )
              .fromTo($('.ft-rid', li), { opacity: 1 }, { opacity: 0.7, duration: 1.8 }, 0)
              .fromTo(
                n,
                { yPercent: -70, opacity: 0 },
                { yPercent: 0, opacity: 1, duration: 0.45, ease: 'back.out(2.4)' },
                0,
              )
          }),
        1100,
      )

      // ----- 03 위협 추이: 심각도 스택 막대 -----
      const days = [
        [2, 4, 7],
        [1, 5, 9],
        [3, 4, 6],
        [2, 7, 10],
        [4, 6, 8],
        [3, 8, 11],
        [5, 10, 12],
      ]
      const cols = $('#ft-cols')
      cols.innerHTML = days
        .map(([c, h, m]) => {
          const seg = (k: string, x: number) =>
            `<i style="height:${x * 4}px;background:var(--${k})"></i>`
          return `<div class="ft-stack">${seg('med', m)}${seg('high', h)}${seg('crit', c)}</div>`
        })
        .join('')

      // ----- 04 원격 조치: 종료 요청 → 요청 중 → 종료 완료 반복 -----
      const [sRun, sReq, sDone] = $$('.ft-st'),
        logs = $$('.ft-log li')
      const prog = $('.ft-prog i'),
        strike = $('.ft-strike'),
        pname = $('.ft-pname')
      const act = gsap
        .timeline({ repeat: -1, paused: true, defaults: { duration: 0.35, ease: 'power2.out' } })
        .set([sReq, sDone], { opacity: 0, y: 6 }, 0)
        .set(sRun, { opacity: 1, y: 0 }, 0)
        .set(logs, { opacity: 0, y: 4 }, 0)
        .set(prog, { scaleX: 0, opacity: 1 }, 0)
        .set(strike, { scaleX: 0, opacity: 1 }, 0)
        .set(pname, { opacity: 1 }, 0)
        .to('.ft-kill', { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, 0.9)
        .to(sRun, { opacity: 0, y: -6 }, 1.15)
        .to(sReq, { opacity: 1, y: 0 }, 1.15)
        .to(logs[0], { opacity: 1, y: 0 }, 1.15)
        .to(prog, { scaleX: 1, duration: 1.4, ease: 'power1.inOut' }, 1.15)
        .to(logs[1], { opacity: 1, y: 0 }, 1.9)
        .to(sReq, { opacity: 0, y: -6 }, 2.6)
        .to(sDone, { opacity: 1, y: 0 }, 2.6)
        .to(logs[2], { opacity: 1, y: 0 }, 2.6)
        .to(strike, { scaleX: 1, duration: 0.5, ease: 'power3.inOut' }, 2.6)
        .to(pname, { opacity: 0.45 }, 2.7)
        .to([...logs, prog, strike], { opacity: 0, duration: 0.4 }, 5.4)
        .to(sDone, { opacity: 0, y: -6 }, 5.4)
        .to(sRun, { opacity: 1, y: 0 }, 5.6)
        .to(pname, { opacity: 1 }, 5.6)
        .set({}, {}, 6.2)

      // ----- 05 IP 조회: 입력 → 결과 카드 반복 -----
      const q = $('#ft-q'),
        ip = q.textContent!,
        res = $('.ft-res'),
        typed = { n: 0 }
      const draw = () => {
        q.textContent = ip.slice(0, typed.n)
      }
      const look = gsap
        .timeline({ repeat: -1, paused: true })
        .call(
          () => {
            typed.n = 0
            draw()
          },
          undefined,
          0,
        )
        .set(res, { opacity: 0, y: 10 }, 0)
        .to(
          typed,
          { n: ip.length, duration: 1.1, ease: 'none', snap: { n: 1 }, onUpdate: draw },
          0.4,
        )
        .to(res, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, 1.8)
        .from(
          '.ft-facts > div',
          { opacity: 0, y: 8, stagger: 0.08, duration: 0.4, ease: 'power2.out' },
          1.95,
        )
        .fromTo('.ft-meter i', { scaleX: 0 }, { scaleX: 0.92, duration: 1, ease: 'power3.out' }, 2)
        .to(res, { opacity: 0, y: -6, duration: 0.4 }, 6)
        .to(typed, { n: 0, duration: 0.4, ease: 'none', snap: { n: 1 }, onUpdate: draw }, 6)
        .set({}, {}, 6.8)

      // ----- 06 알림 연동: 메시지가 아래에서 쌓인다 -----
      const box = $('#ft-msgs')
      const msgs = [
        ['crit', '심각', 'WIN-FIN-02 에서 LSASS 메모리 덤프 탐지'],
        ['high', '높음', 'DEV-07 에서 인코딩된 PowerShell 실행'],
        ['med', '보통', 'VPN-GW 로그인 실패 38회'],
        ['good', '조치', 'WIN-FIN-02 프로세스 종료 완료'],
      ]
      let mi = 0,
        mt = 14 * 60 + 2
      const push = (animate: boolean) => {
        const [k, label, text] = msgs[mi++ % msgs.length]
        mt += 1 + (mi % 3)
        const el = document.createElement('div')
        el.className = 'ft-msg'
        el.innerHTML = `<img src="/logo.png" alt="" /><div><p>EDRdog<span>${String(Math.floor(mt / 60) % 24).padStart(2, '0')}:${String(mt % 60).padStart(2, '0')}</span></p><p><span class="badge ${k}"><i></i>${label}</span>${text}</p></div>`
        box.appendChild(el)
        while (box.children.length > 4) box.firstElementChild!.remove()
        if (animate)
          gc.add(() => {
            gsap.fromTo(
              box,
              { y: el.offsetHeight + 12 },
              { y: 0, duration: 0.7, ease: 'power3.out' },
            )
            gsap.from(el, { opacity: 0, duration: 0.5, delay: 0.15 })
          })
      }
      const chat = ticker(() => push(true), 2600)

      // ----- 마지막 CTA 뒤 점 필드: 점 하나가 엔드포인트, 가끔 퍼지며 켜진다 -----
      const cv = $<HTMLCanvasElement>('.ft-dots'),
        ctx = cv.getContext('2d')!,
        G = 28
      // 점 색: .landing 의 CSS 변수에서 읽고, 테마가 바뀌면 다시 읽는다
      const landing = root.closest('.landing') || root
      let cBase = '',
        cLit = ''
      const readColors = () => {
        cBase = cssVar(landing, '--line-strong')
        cLit = cssVar(landing, '--accent-ink')
      }
      readColors()
      let W = 0,
        H = 0,
        lit: { x: number; y: number; t: number; a: number }[] = [],
        raf = 0,
        nextRipple = 0
      const size = () => {
        const d = Math.min(devicePixelRatio || 1, 2),
          r = cv.getBoundingClientRect()
        W = r.width
        H = r.height
        cv.width = W * d
        cv.height = H * d
        ctx.setTransform(d, 0, 0, d, 0, 0)
      }
      const base = () => {
        ctx.clearRect(0, 0, W, H)
        ctx.fillStyle = cBase
        for (let y = G / 2; y < H; y += G)
          for (let x = G / 2; x < W; x += G) ctx.fillRect(x - 1, y - 1, 2, 2)
      }
      const ripple = (now: number) => {
        const cx = Math.floor(rand(0, W / G)),
          cy = Math.floor(rand(0, H / G))
        for (let dx = -4; dx <= 4; dx++)
          for (let dy = -4; dy <= 4; dy++) {
            const dist = Math.hypot(dx, dy)
            if (dist <= 4)
              lit.push({
                x: (cx + dx) * G + G / 2,
                y: (cy + dy) * G + G / 2,
                t: now + dist * 120,
                a: 1 - dist / 5,
              })
          }
      }
      const frame = (now: number) => {
        base()
        if (now > nextRipple) {
          ripple(now)
          nextRipple = now + rand(700, 1300)
        }
        if (Math.random() < 0.12)
          lit.push({
            x: Math.floor(rand(0, W / G)) * G + G / 2,
            y: Math.floor(rand(0, H / G)) * G + G / 2,
            t: now,
            a: 0.8,
          })
        ctx.fillStyle = cLit
        lit = lit.filter((p) => {
          const k = (now - p.t) / 1800
          if (k < 0) return true
          if (k > 1) return false
          ctx.globalAlpha = Math.sin(Math.PI * k) * p.a
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2)
          ctx.fill()
          return true
        })
        ctx.globalAlpha = 1
        raf = requestAnimationFrame(frame)
      }
      size()
      base()
      const onResize = () => {
        size()
        base()
      }
      addEventListener('resize', onResize)
      offs.push(() => {
        removeEventListener('resize', onResize)
        cancelAnimationFrame(raf)
        clearTimeout(tickTimer)
        tick.pause()
        hit.pause()
        chat.pause()
      })
      // 테마가 바뀌면 점 색을 다시 읽는다 (돌고 있으면 다음 프레임부터 새 색)
      offs.push(
        onThemeChange(() => {
          readColors()
          if (!raf) base()
        }),
      )

      // ----- 움직임 줄이기: 최종 상태만 보여준다 -----
      if (R) {
        push(false)
        push(false)
        push(false)
        act.seek(3.4, false)
        look.seek(3.6, false)
        return
      }

      // 제목: 단어가 아래에서 올라온다
      const head = $$('.ft-head .ft-line').flatMap(split)
      gsap.from(head, {
        yPercent: 110,
        duration: 1,
        ease: 'power4.out',
        stagger: 0.07,
        scrollTrigger: { trigger: $('.ft-head'), start: 'top 82%' },
      })
      gsap.from($$('.ft-head .eyebrow, .ft-head .lead'), {
        opacity: 0,
        y: 16,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.15,
        scrollTrigger: { trigger: $('.ft-head'), start: 'top 82%' },
      })
      gsap.from($('.ft-grid'), {
        y: 64,
        opacity: 0,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: $('.ft-grid'), start: 'top 92%' },
      })

      // 타일: 내용이 차례로 떠오르고 미니 화면이 돈다
      const reveal = (t: HTMLElement) =>
        gsap.fromTo(
          t.children,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 },
        )
      $$('.ft-tile').forEach((t) => gsap.set(t.children, { opacity: 0 }))
      live($('.ft-a'), {
        intro() {
          reveal($('.ft-a'))
          const from = { n: total - 64000 }
          gsap.to(from, {
            n: total,
            duration: 1.6,
            ease: 'power3.out',
            onUpdate: () => {
              count.textContent = fmt(from.n)
            },
          })
          gsap.from(bars, { scaleY: 0, duration: 0.9, ease: 'power3.out', stagger: 0.012 })
        },
        play: () => {
          scroll.play()
          tickTimer = window.setTimeout(tick.play, 1600)
        },
        pause: () => {
          scroll.pause()
          clearTimeout(tickTimer)
          tick.pause()
        },
      })
      live($('.ft-b'), {
        intro() {
          reveal($('.ft-b'))
          gsap.from(rules, {
            opacity: 0,
            x: -10,
            duration: 0.5,
            ease: 'power2.out',
            stagger: 0.05,
            delay: 0.2,
          })
        },
        play: hit.play,
        pause: hit.pause,
      })
      live($('.ft-c'), {
        intro() {
          reveal($('.ft-c'))
          gsap.from($$('.ft-stack'), {
            scaleY: 0,
            duration: 1,
            ease: 'power4.out',
            stagger: 0.08,
            delay: 0.15,
          })
          const o = { n: 0 },
            el = $('#ft-total'),
            end = totalEnd
          gsap.to(o, {
            n: end,
            duration: 1.4,
            ease: 'power3.out',
            delay: 0.15,
            onUpdate: () => {
              el.textContent = String(Math.round(o.n))
            },
          })
        },
      })
      live($('.ft-d'), {
        intro: () => reveal($('.ft-d')),
        play: () => act.play(),
        pause: () => act.pause(),
      })
      live($('.ft-e'), {
        intro: () => reveal($('.ft-e')),
        play: () => look.play(),
        pause: () => look.pause(),
      })
      live($('.ft-f'), {
        intro() {
          reveal($('.ft-f'))
          push(false)
          push(false)
        },
        play: chat.play,
        pause: chat.pause,
      })

      // CTA: 스크롤에 맞춰 단어가 차례로 올라온다
      const big = $$('.ft-big .ft-line').flatMap(split)
      gsap.fromTo(
        big,
        { yPercent: 105, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: $('.ft-big'), start: 'top 88%', end: 'top 42%', scrub: 0.7 },
        },
      )
      gsap.from($$('.ft-cta .lead, .ft-btns'), {
        opacity: 0,
        y: 20,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: $('.ft-cta .lead'), start: 'top 90%' },
      })
      gsap.fromTo(
        cv,
        { scale: 1.14 },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: $('#start'),
            start: 'top bottom',
            end: 'center center',
            scrub: true,
          },
        },
      )
      ScrollTrigger.create({
        trigger: $('#start'),
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (s) => {
          cancelAnimationFrame(raf)
          if (s.isActive) raf = requestAnimationFrame(frame)
          else {
            raf = 0
            base()
          }
        },
      })
    }, rootRef.current!)
    return () => {
      offList.forEach((f) => f())
      gc.revert()
    }
  }, [])

  return (
    <div ref={rootRef}>
      <section id="features" className="ft">
        <div className="wrap">
          <div className="ft-head">
            <div>
              <p className="eyebrow">FEATURES</p>
              <h2 className="h2">
                <span className="ft-line">관제에 필요한 건</span>
                <span className="ft-line">다 있어요</span>
              </h2>
            </div>
            <p className="lead">
              수집, 탐지, 조치, 알림까지. 여러 도구를 오가지 않고 콘솔 하나에서 끝나요.
            </p>
          </div>

          <div className="ft-grid card">
            {/* 01 실시간 수집 */}
            <article className="ft-tile ft-a">
              <div className="ft-th">
                <h3>모든 이벤트를 실시간으로 모아요</h3>
                <span className="ft-tag">LIVE</span>
              </div>
              <p className="ft-td">프로세스, 네트워크, 로그인 기록이 에이전트에서 바로 들어와요.</p>
              <div className="ft-viz" aria-hidden="true">
                <div className="ft-live-top">
                  <span className="badge good ft-sig">
                    <i></i>LIVE SIGNAL
                  </span>
                  <span className="ft-dim">
                    에이전트 <b className="mono">128</b>대 연결
                  </span>
                </div>
                <div className="ft-count">
                  <div>
                    <b className="mono" id="ft-count">
                      2,481,936
                    </b>
                    <small>오늘 수집한 이벤트</small>
                  </div>
                  <div className="ft-rate">
                    초당 이벤트<b id="ft-rate">1,240</b>
                  </div>
                </div>
                <div className="ft-spark">
                  <div className="ft-spark-track" id="ft-spark"></div>
                </div>
                <div className="ft-axis">
                  <span>60초 전</span>
                  <span>지금</span>
                </div>
              </div>
            </article>

            {/* 02 탐지 규칙 */}
            <article className="ft-tile ft-b">
              <div className="ft-th">
                <h3>공격 기법마다 규칙이 있어요</h3>
                <span className="ft-tag">ATT&amp;CK</span>
              </div>
              <p className="ft-td">MITRE ATT&amp;CK 기준 규칙에 걸리면 바로 표시돼요.</p>
              <div className="ft-viz" aria-hidden="true">
                <div className="ft-rstat">
                  <div>
                    활성 규칙<b className="mono">312</b>
                  </div>
                  <div>
                    오늘 매칭
                    <b className="mono" id="ft-hits">
                      47
                    </b>
                  </div>
                </div>
                <ul className="ft-rules">
                  <li data-sev="crit">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1003.001</span>
                    <span className="ft-rname">LSASS 메모리 덤프</span>
                    <b className="mono">4</b>
                  </li>
                  <li data-sev="high">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1059.001</span>
                    <span className="ft-rname">PowerShell 인코딩 실행</span>
                    <b className="mono">9</b>
                  </li>
                  <li data-sev="high">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1547.001</span>
                    <span className="ft-rname">레지스트리 자동 실행</span>
                    <b className="mono">6</b>
                  </li>
                  <li data-sev="crit">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1078</span>
                    <span className="ft-rname">정상 계정 악용</span>
                    <b className="mono">3</b>
                  </li>
                  <li data-sev="med">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1110</span>
                    <span className="ft-rname">무차별 대입 로그인</span>
                    <b className="mono">11</b>
                  </li>
                  <li data-sev="high">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1055</span>
                    <span className="ft-rname">프로세스 인젝션</span>
                    <b className="mono">2</b>
                  </li>
                  <li data-sev="crit">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1486</span>
                    <span className="ft-rname">파일 대량 암호화</span>
                    <b className="mono">1</b>
                  </li>
                  <li data-sev="med">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1021.001</span>
                    <span className="ft-rname">원격 데스크톱 접속</span>
                    <b className="mono">5</b>
                  </li>
                  <li data-sev="high">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1566.001</span>
                    <span className="ft-rname">피싱 첨부파일 실행</span>
                    <b className="mono">2</b>
                  </li>
                  <li data-sev="med">
                    <i className="ft-bar"></i>
                    <em className="ft-flash"></em>
                    <span className="ft-rid">T1105</span>
                    <span className="ft-rname">외부 도구 내려받기</span>
                    <b className="mono">4</b>
                  </li>
                </ul>
              </div>
            </article>

            {/* 03 위협 추이 */}
            <article className="ft-tile ft-c">
              <div className="ft-th">
                <h3>위협 흐름을 한눈에</h3>
                <span className="ft-tag">7D</span>
              </div>
              <p className="ft-td">날짜별 탐지를 심각도로 쌓아 보여줘요.</p>
              <div className="ft-viz" aria-hidden="true">
                <div className="ft-ctop">
                  <div>
                    <b id="ft-total">127</b>
                    <small>이번 주 탐지</small>
                  </div>
                  <div className="ft-legend">
                    <span style={{ '--c': 'var(--crit)' } as CSSProperties}>심각</span>
                    <span style={{ '--c': 'var(--high)' } as CSSProperties}>높음</span>
                    <span style={{ '--c': 'var(--med)' } as CSSProperties}>보통</span>
                  </div>
                </div>
                <div className="ft-cols" id="ft-cols"></div>
                <div className="ft-days mono">
                  <span>11.05</span>
                  <span>11.06</span>
                  <span>11.07</span>
                  <span>11.08</span>
                  <span>11.09</span>
                  <span>11.10</span>
                  <span>오늘</span>
                </div>
              </div>
            </article>

            {/* 04 원격 조치 */}
            <article className="ft-tile ft-d">
              <div className="ft-th">
                <h3>버튼 하나로 원격 조치</h3>
                <span className="ft-tag">ACTION</span>
              </div>
              <p className="ft-td">의심 프로세스를 콘솔에서 바로 종료해요.</p>
              <div className="ft-viz ft-act" aria-hidden="true">
                <div className="ft-proc">
                  <div>
                    <span className="ft-pname">
                      powershell.exe<i className="ft-strike"></i>
                    </span>
                    <small>PID 4128 · WIN-FIN-02</small>
                  </div>
                  <div className="ft-sts">
                    <span className="badge high ft-st">
                      <i></i>실행 중
                    </span>
                    <span className="badge low ft-st">
                      <i></i>요청 중
                    </span>
                    <span className="badge good ft-st">
                      <i></i>종료 완료
                    </span>
                  </div>
                </div>
                <div className="ft-kill-row">
                  <span className="ft-kill">프로세스 종료</span>
                  <div className="ft-prog">
                    <i></i>
                  </div>
                </div>
                <ol className="ft-log">
                  <li>
                    <span>14:02:11</span>종료 요청 전송
                  </li>
                  <li>
                    <span>14:02:12</span>에이전트 수신
                  </li>
                  <li>
                    <span>14:02:13</span>PID 4128 종료 확인
                  </li>
                </ol>
              </div>
            </article>

            {/* 05 IP·도메인 조회 */}
            <article className="ft-tile ft-e">
              <div className="ft-th">
                <h3>수상한 IP는 바로 조회</h3>
                <span className="ft-tag">INTEL</span>
              </div>
              <p className="ft-td">
                IP나 도메인을 넣으면 평판, 국가, 처음 본 날까지 한 번에 보여줘요.
              </p>
              <div className="ft-viz" aria-hidden="true">
                <div className="ft-q">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="var(--faint)"
                    strokeWidth="1.6"
                  >
                    <circle cx="7" cy="7" r="5" />
                    <path d="m11 11 3.5 3.5" strokeLinecap="round" />
                  </svg>
                  <span id="ft-q">185.220.101.4</span>
                  <i className="ft-caret"></i>
                  <kbd>Enter</kbd>
                </div>
                <div className="ft-res">
                  <div className="ft-res-h">
                    <b>185.220.101.4</b>
                    <span className="badge crit">
                      <i></i>악성
                    </span>
                    <em>
                      위험 점수<b>92</b>
                      <span className="mono">/100</span>
                    </em>
                  </div>
                  <dl className="ft-facts">
                    <div>
                      <dt>국가</dt>
                      <dd>독일 DE</dd>
                    </div>
                    <div>
                      <dt>처음 본 날</dt>
                      <dd className="mono">2026.03.14</dd>
                    </div>
                    <div>
                      <dt>신고</dt>
                      <dd>
                        <span className="mono">1,203</span>건
                      </dd>
                    </div>
                    <div>
                      <dt>분류</dt>
                      <dd>Tor 출구 노드</dd>
                    </div>
                  </dl>
                  <div className="ft-meter">
                    <i></i>
                  </div>
                </div>
              </div>
            </article>

            {/* 06 알림 연동 */}
            <article className="ft-tile ft-f">
              <div className="ft-th">
                <h3>알림은 쓰던 메신저로</h3>
                <span className="ft-tag">WEBHOOK</span>
              </div>
              <p className="ft-td">심각한 탐지는 웹훅으로 팀 채널에 바로 보내요.</p>
              <div className="ft-viz" aria-hidden="true">
                <div className="ft-chat">
                  <div className="ft-chat-h">
                    # 보안-알림
                    <span className="badge good">
                      <i></i>연결됨
                    </span>
                  </div>
                  <div className="ft-msgs">
                    <div className="ft-msgs-in" id="ft-msgs"></div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="start" className="ft-cta">
        <canvas className="ft-dots" aria-hidden="true"></canvas>
        <div className="wrap ft-cta-in">
          <h2 className="ft-big">
            <span className="ft-line">오늘 들어온 위협,</span>
            <span className="ft-line">지금 바로 확인하세요</span>
          </h2>
          <p className="lead">데모 화면에서 탐지부터 조치까지 직접 눌러보세요.</p>
          <div className="ft-btns">
            <Link className="btn primary" to="/dashboard">
              데모 보기
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <Link className="btn" to="/login">
              로그인
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Features
