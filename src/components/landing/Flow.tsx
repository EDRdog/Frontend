import { useEffect, useRef, type CSSProperties } from 'react'
import { gsap, ScrollTrigger, prefersReduced } from './utils'

// 동작 방식: 고정(pin)된 콘솔이 조사 → 대응으로 바뀐다.
function Flow() {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = rootRef.current!
    const q = <T extends HTMLElement = HTMLElement>(s: string, el: ParentNode = root) =>
      el.querySelector<T>(s)!
    const qa = (s: string, el: ParentNode = root) => [...el.querySelectorAll<HTMLElement>(s)]
    const REDUCE = prefersReduced()
    const pin = q('.fl-pin'),
      stage = q('.fl-stage'),
      tilt = q('.fl-tilt'),
      win = q('.fl-win')

    // 콘솔은 고정 크기로 그리고 칸 너비에 맞춰 줄이거나 키운 뒤 가운데 둔다
    const fit = () => {
      let s = Math.min(1.25, stage.clientWidth / win.offsetWidth)
      // 모바일은 단계 글 아래에 콘솔이 놓이므로 남은 높이에도 맞춘다(낮은 폰에서 잘리지 않게)
      if (window.matchMedia('(max-width: 860px)').matches) {
        const room = pin.clientHeight - 64 - q('.fl-side').offsetHeight - 26 - 8
        s = Math.min(s, room / win.offsetHeight)
      }
      win.style.transform = `scale(${s})`
      win.style.left = (stage.clientWidth - win.offsetWidth * s) / 2 + 'px'
      stage.style.height = win.offsetHeight * s + 'px'
    }
    fit()
    ScrollTrigger.addEventListener('refreshInit', fit)

    // 창 왼쪽 위 기준 레이아웃 좌표 (transform 은 무시된다)
    const off = (el: HTMLElement | null) => {
      let x = 0,
        y = 0
      for (; el && el !== win; el = el.offsetParent as HTMLElement | null) {
        x += el.offsetLeft
        y += el.offsetTop
      }
      return { x, y }
    }
    const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

    // 머리말은 들어올 때 한 번 떠오른다
    const gc = gsap.context(() => {
      if (REDUCE) return
      gsap.from(q('.fl-head').children, {
        y: 28,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: q('.fl-head'), start: 'top 85%' },
      })
    }, root)

    const mm = gsap.matchMedia(root)
    mm.add({ mob: '(max-width: 860px)', desk: '(min-width: 861px)' }, (ctx) => {
      const mob = !!ctx.conditions?.mob
      fit()
      const W = win.offsetWidth,
        H = win.offsetHeight
      const tl = gsap.timeline({ paused: true, defaults: { duration: 0.4, ease: 'power2.inOut' } })

      // 자주 쓰는 동작
      const swap = (sel: string, a: number, b: number, t: number) => {
        const k = q(sel).children
        tl.to(k[a], { autoAlpha: 0, y: -6, duration: 0.2 }, t)
        tl.fromTo(k[b], { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.25 }, t + 0.1)
      }
      const cur = q('.fl-cur'),
        rip = q('.fl-rip')
      const press = (btn: HTMLElement, t: number) => {
        tl.to(cur, { scale: 0.82, duration: 0.06, ease: 'power1.out' }, t)
        tl.to(cur, { scale: 1, duration: 0.14, ease: 'power1.out' }, t + 0.06)
        tl.fromTo(
          rip,
          { scale: 0.2, autoAlpha: 0.9 },
          { scale: 1.5, autoAlpha: 0, duration: 0.45, ease: 'power2.out', immediateRender: false },
          t,
        )
        tl.to(btn, { scale: 0.96, duration: 0.06 }, t).to(
          btn,
          { scale: 1, duration: 0.14 },
          t + 0.06,
        )
      }
      const aim = (el: HTMLElement, fx: number, fy: number) => ({
        x: () => off(el).x + el.offsetWidth * fx,
        y: () => off(el).y + el.offsetHeight * fy,
      })

      // 왼쪽 단계와 진행선
      const steps = qa('.fl-step'),
        list = q('.fl-steps'),
        fill = q('.fl-rail i')
      const axis = mob ? 'scaleX' : 'scaleY'
      const mark = (i: number) => () =>
        mob
          ? (steps[i].offsetLeft + 30) / list.offsetWidth
          : (steps[i].offsetTop + list.offsetTop + 10) / q('.fl-side').offsetHeight
      const step = (i: number, on: boolean, t: number) => {
        const s = steps[i]
        tl.to([q('.fl-sn', s), q('h3', s)], { opacity: on ? 1 : 0.26, duration: 0.35 }, t)
        tl.to(q('p', s), { opacity: on ? 1 : mob ? 0 : 0.26, duration: 0.35 }, t)
      }
      tl.fromTo(fill, { [axis]: mark(0) }, { [axis]: mark(1), duration: 4.9, ease: 'none' }, 0)
      tl.to(fill, { [axis]: 1, duration: 4.1, ease: 'none' }, 4.9)

      // 시작: 대시보드, 수집 수치는 계속 오른다
      const ev = q('.fl-ev'),
        evo = { v: +ev.dataset.from! }
      tl.to(
        evo,
        {
          v: evo.v + 38,
          duration: 1.4,
          ease: 'none',
          onUpdate: () => {
            ev.textContent = fmt(evo.v)
          },
        },
        0,
      )

      // 커서가 경보 행을 누른다
      const hero = q('.fl-hero'),
        heroRow = q('.fl-row', hero)
      tl.fromTo(
        cur,
        { x: W * 0.72, y: H + 24, autoAlpha: 0 },
        { ...aim(q('.fl-t b', hero), 0.62, 0.6), autoAlpha: 1, duration: 0.7, ease: 'power3.out' },
        0.25,
      )
      tl.to(q('.fl-hl', hero), { opacity: 1, duration: 0.2 }, 0.8)
      press(heroRow, 1.0)

      // 조사: 경보 행이 머리 카드로 올라가고 대시보드는 물러난다
      const T2 = 1.2
      swap('.fl-sw-crumb', 0, 1, T2)
      swap('.fl-sw-title', 0, 1, T2)
      const items = qa('.fl-menu a')
      tl.to(
        q('.fl-pill'),
        { y: () => items[1].offsetTop - items[0].offsetTop, duration: 0.45, ease: 'power3.inOut' },
        T2,
      )
      tl.set(q('.fl-menu'), { attr: { 'data-on': 1 } }, T2 + 0.2)
      tl.to(cur, { x: '+=36', y: '+=80', autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, T2)
      tl.to(q('.fl-strip'), { y: -16, autoAlpha: 0, duration: 0.4 }, T2)
      tl.to(q('.fl-tbl'), { y: 28, autoAlpha: 0, duration: 0.45 }, T2 + 0.05)
      tl.to(
        hero,
        { y: () => q('.fl-dash').offsetTop - hero.offsetTop, duration: 0.7, ease: 'power3.inOut' },
        T2 + 0.05,
      )
      tl.to(q('.fl-hbg'), { autoAlpha: 1, duration: 0.4 }, T2 + 0.2)
      tl.to(q('.fl-hl', hero), { opacity: 0, duration: 0.3 }, T2 + 0.1)
      tl.to(q('.fl-new'), { autoAlpha: 0, scale: 0.8, duration: 0.2 }, T2)

      // 증거 체인: 아래 선이 왼쪽부터 이어지며 칸이 하나씩 열린다
      tl.fromTo(
        q('.fl-chain'),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' },
        1.75,
      )
      qa('.fl-c').forEach((c, i) => {
        const t = 1.95 + i * 0.3
        if (i < 4) {
          tl.fromTo(
            q('.fl-cc', c),
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' },
            t,
          )
          tl.fromTo(q('.fl-cb', c), { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'none' }, t)
          tl.fromTo(q('.fl-chev', c), { opacity: 0 }, { opacity: 1, duration: 0.15 }, t + 0.26)
        } else
          tl.fromTo(
            q('.fl-cc', c),
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 0.5, y: 0, duration: 0.3, ease: 'power2.out' },
            t,
          )
      })

      // 프로세스 트리: 줄이 차례로 나오고 악성 노드가 표시된다
      const tree = q('.fl-tree'),
        bad = q('.fl-bad')
      tl.fromTo(
        tree,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' },
        3.05,
      )
      tl.fromTo(
        qa('.fl-tree li'),
        { autoAlpha: 0, x: -10 },
        { autoAlpha: 1, x: 0, duration: 0.25, stagger: 0.13, ease: 'power2.out' },
        3.2,
      )
      tl.to(q('.fl-hl', bad), { opacity: 1, duration: 0.25 }, 3.7)
      tl.to(q('.fl-sev', bad), { scaleY: 1, duration: 0.25 }, 3.7)
      tl.fromTo(
        q('.badge', bad),
        { opacity: 0, scale: 0.7 },
        { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' },
        3.8,
      )

      // 권고 박스: 트리 아래에 붙는다 (자리는 대응 장면 위치, 지금은 아래로 내려 둔다)
      const adv = q('.fl-adv'),
        advDY = () => tree.offsetHeight + 12
      tl.fromTo(
        adv,
        { autoAlpha: 0, y: () => advDY() + 14 },
        { autoAlpha: 1, y: advDY, duration: 0.4, ease: 'power3.out' },
        4.0,
      )

      // 대응: 트리가 빠지고 권고 박스가 올라와 조치 패널이 된다
      const T3 = 4.9
      step(0, false, T3)
      step(1, true, T3)
      swap('.fl-sw-crumb', 1, 2, T3)
      swap('.fl-sw-title', 1, 2, T3)
      tl.to(tree, { autoAlpha: 0, y: -14, scale: 0.98, duration: 0.3, ease: 'power2.in' }, T3)
      tl.to(adv, { y: 0, duration: 0.55, ease: 'power3.inOut' }, T3 + 0.15)
      tl.fromTo(
        q('.fl-host'),
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' },
        T3 + 0.6,
      )
      tl.fromTo(
        q('.fl-tl'),
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' },
        T3 + 0.7,
      )
      const dots = qa('.fl-ts em'),
        trk = q('.fl-trk i')
      tl.to(dots[0], { opacity: 1, duration: 0.15 }, T3 + 0.85)
      tl.to(trk, { scaleX: 1 / 3, duration: 0.3, ease: 'none' }, T3 + 0.9)
      tl.to(dots[1], { opacity: 1, duration: 0.15 }, T3 + 1.15)

      // 프로세스 종료: 누름 → 요청 중 → 종료 완료
      const kill = q('.fl-sw-kill .fl-btn'),
        iso = q('.fl-sw-iso .fl-btn')
      tl.set(cur, { x: W * 0.62, y: H + 24 }, 5.5)
      tl.to(
        cur,
        { ...aim(kill, 0.55, 0.6), autoAlpha: 1, duration: 0.55, ease: 'power3.out' },
        5.55,
      )
      press(kill, 6.1)
      swap('.fl-sw-kill', 0, 1, 6.15)
      swap('.fl-sw-kill', 1, 2, 6.75)
      swap('.fl-sw-ps', 0, 1, 6.8)
      tl.to(trk, { scaleX: 2 / 3, duration: 0.3, ease: 'none' }, 6.8)
      tl.to(dots[2], { opacity: 1, duration: 0.15 }, 7.05)

      // 호스트 격리: 누름 → 격리됨, 체인 05 가 초록으로 닫힌다
      tl.to(cur, { ...aim(iso, 0.5, 0.6), duration: 0.35, ease: 'power2.inOut' }, 6.95)
      press(iso, 7.35)
      swap('.fl-sw-iso', 0, 1, 7.4)
      swap('.fl-sw-host', 0, 1, 7.45)
      swap('.fl-sw-net', 0, 1, 7.45)
      const c5 = q('.fl-c5')
      tl.to(q('.fl-cc', c5), { autoAlpha: 1, duration: 0.25 }, 7.5)
      swap('.fl-sw-c5', 0, 1, 7.5)
      tl.fromTo(
        q('.fl-cb', c5),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.3, ease: 'power2.out' },
        7.55,
      )
      tl.to(trk, { scaleX: 1, duration: 0.3, ease: 'none' }, 7.5)
      tl.to(dots[3], { opacity: 1, duration: 0.15 }, 7.75)

      // 마무리: 처리 시간 도장, 경보는 해결됨
      tl.fromTo(
        q('.fl-stamp'),
        { opacity: 0, x: 12 },
        { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' },
        7.85,
      )
      swap('.fl-sw-res', 0, 1, 7.95)
      const cnt = q('.fl-cnt'),
        cno = { v: +cnt.dataset.from! }
      tl.to(
        cno,
        {
          v: cno.v - 1,
          duration: 0.1,
          ease: 'none',
          onUpdate: () => {
            cnt.textContent = String(Math.round(cno.v))
          },
        },
        8,
      )
      tl.to(cur, { x: '+=40', y: '+=50', autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 7.9)
      tl.to({}, { duration: 0.6 }, 8.4)

      // 동작 줄이기: 고정 없이 마지막 장면을 보여 준다
      if (REDUCE) {
        root.classList.add('fl-static')
        tl.progress(1)
        gsap.set(qa('.fl-step > *'), { opacity: 1 })
        return () => root.classList.remove('fl-static')
      }

      // 콘솔이 기울어진 채로 올라와 바로 선다
      gsap.fromTo(
        tilt,
        { y: 90, rotateX: 14, scale: 0.94, autoAlpha: 0.25 },
        {
          y: 0,
          rotateX: 0,
          scale: 1,
          autoAlpha: 1,
          ease: 'none',
          scrollTrigger: { trigger: pin, start: 'top bottom', end: 'top 8%', scrub: 0.6 },
        },
      )
      gsap.fromTo(
        q('.fl-side'),
        { y: 40, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          ease: 'none',
          scrollTrigger: { trigger: pin, start: 'top 85%', end: 'top 20%', scrub: 0.6 },
        },
      )

      ScrollTrigger.create({
        trigger: pin,
        start: 'top top',
        end: '+=280%',
        pin: true,
        scrub: 0.6,
        animation: tl,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      })
    })
    // 언마운트: 리스너, matchMedia, 머리말 연출을 치운다
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', fit)
      mm.revert()
      gc.revert()
    }
  }, [])

  return (
    <section id="flow" ref={rootRef} className="fl" aria-labelledby="fl-title">
      <div className="wrap fl-head">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2 className="h2" id="fl-title">
          클릭 한 번으로
          <br />
          원인부터 조치까지
        </h2>
        <p className="lead">경보를 누르면 공격 경로가 그려지고, 같은 화면에서 바로 막습니다.</p>
      </div>

      <div className="fl-pin">
        <div className="wrap fl-grid">
          <div className="fl-side">
            <div className="fl-rail">
              <i></i>
            </div>
            <p className="fl-done">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
              탐지 완료 · web-03 경보
            </p>
            <ol className="fl-steps">
              <li className="fl-step">
                <span className="fl-sn">01</span>
                <h3>조사</h3>
                <p>경보를 누르면 공격이 어떻게 이어졌는지 순서대로 그려집니다.</p>
              </li>
              <li className="fl-step">
                <span className="fl-sn">02</span>
                <h3>대응</h3>
                <p>프로세스 종료와 호스트 격리까지 그 자리에서 끝냅니다.</p>
              </li>
            </ol>
          </div>

          <div
            className="fl-stage"
            role="img"
            aria-label="EDRdog 콘솔에서 web-03 경보를 열어 공격 경로를 확인하고, 악성 프로세스를 종료한 뒤 호스트를 격리하는 화면"
          >
            <div className="fl-tilt">
              <div className="fl-win" aria-hidden="true">
                <div className="fl-bar">
                  <i></i>
                  <i></i>
                  <i></i>
                  <span>EDRdog Console</span>
                </div>
                <div className="fl-body">
                  <aside className="fl-nav">
                    <div className="fl-brand">
                      <img src="/logo.png" alt="" />
                      <b>EDRdog</b>
                    </div>
                    <div className="fl-menu">
                      <span className="fl-pill"></span>
                      <a>
                        <svg viewBox="0 0 24 24">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                        대시보드
                      </a>
                      <h6>TRIAGE</h6>
                      <a>
                        <svg viewBox="0 0 24 24">
                          <path d="M12 3 2 20h20L12 3z" />
                          <path d="M12 10v4M12 17h.01" />
                        </svg>
                        위협
                        <span className="fl-cnt" data-from="5">
                          5
                        </span>
                      </a>
                      <a>
                        <svg viewBox="0 0 24 24">
                          <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />
                        </svg>
                        사건
                      </a>
                      <h6>EVIDENCE</h6>
                      <a>
                        <svg viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="12" rx="1" />
                          <path d="M8 20h8M12 16v4" />
                        </svg>
                        엔드포인트
                      </a>
                      <a>
                        <svg viewBox="0 0 24 24">
                          <path d="M3 12h4l3-7 4 14 3-7h4" />
                        </svg>
                        수집 로그
                      </a>
                      <h6>ANALYSIS</h6>
                      <a>
                        <svg viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
                        </svg>
                        위협 지도
                      </a>
                      <a>
                        <svg viewBox="0 0 24 24">
                          <circle cx="6" cy="6" r="2.5" />
                          <circle cx="18" cy="6" r="2.5" />
                          <circle cx="12" cy="18" r="2.5" />
                          <path d="M7.5 8 11 16M16.5 8 13 16" />
                        </svg>
                        관계 분석
                      </a>
                    </div>
                    <div className="fl-navfoot">
                      <span className="fl-live"></span>8대 수집 중
                    </div>
                  </aside>

                  <div className="fl-main">
                    <header className="fl-top">
                      <div>
                        <div className="fl-sw fl-crumb fl-sw-crumb">
                          <span>EDRDOG / OVERVIEW</span>
                          <span>EDRDOG / THREATS / TH-2041</span>
                          <span>EDRDOG / THREATS / TH-2041 / RESPONSE</span>
                        </div>
                        <div className="fl-sw fl-title fl-sw-title">
                          <span>대시보드</span>
                          <span>인코딩된 PowerShell 실행</span>
                          <span>대응 조치</span>
                        </div>
                      </div>
                      <div className="fl-search">
                        <svg viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="7" />
                          <path d="m20 20-4-4" />
                        </svg>
                        호스트·위협 검색<kbd>/</kbd>
                      </div>
                    </header>

                    <div className="fl-content">
                      <div className="fl-dash">
                        <div className="fl-strip fl-panel">
                          <div className="fl-lv">
                            <span className="fl-live"></span>
                            <div>
                              <b>LIVE SIGNAL</b>
                              <small>마지막 수집 2초 전</small>
                            </div>
                          </div>
                          <div>
                            <small>24시간 수집 이벤트</small>
                            <b className="fl-ev" data-from="18447">
                              18,447
                            </b>
                          </div>
                          <div>
                            <small>탐지 규칙 적중</small>
                            <b>10</b>
                          </div>
                          <div>
                            <small>온라인 엔드포인트</small>
                            <b>
                              8 <span>/ 8</span>
                            </b>
                          </div>
                          <div className="fl-m4">
                            <small>위험 호스트</small>
                            <b>2</b>
                          </div>
                        </div>
                        <div className="fl-tbl fl-panel">
                          <div className="fl-ph">
                            <h4>최근 탐지된 위협</h4>
                            <span>실시간</span>
                            <em>전체 보기</em>
                          </div>
                          <div className="fl-row fl-hr">
                            <span>위협</span>
                            <span>호스트</span>
                            <span>심각도</span>
                            <span style={{ textAlign: 'right' }}>탐지 시각</span>
                          </div>
                          <div className="fl-rows">
                            <div className="fl-slot"></div>
                            <div className="fl-row" data-s="high">
                              <div className="fl-t">
                                <b>외부 C2 서버 반복 연결</b>
                                <code>c2_beacon</code>
                              </div>
                              <span className="fl-h">fin-02</span>
                              <span>
                                <span className="badge high">
                                  <i></i>높음
                                </span>
                              </span>
                              <span className="fl-d">02:11:40</span>
                            </div>
                            <div className="fl-row" data-s="high">
                              <div className="fl-t">
                                <b>LSASS 메모리 접근</b>
                                <code>lsass_memory_access</code>
                              </div>
                              <span className="fl-h">dev-01</span>
                              <span>
                                <span className="badge high">
                                  <i></i>높음
                                </span>
                              </span>
                              <span className="fl-d">02:03:12</span>
                            </div>
                            <div className="fl-row" data-s="med">
                              <div className="fl-t">
                                <b>비정상 시간대 로그인</b>
                                <code>off_hours_logon</code>
                              </div>
                              <span className="fl-h">hr-04</span>
                              <span>
                                <span className="badge med">
                                  <i></i>보통
                                </span>
                              </span>
                              <span className="fl-d">01:52:07</span>
                            </div>
                            <div className="fl-row" data-s="good">
                              <div className="fl-t">
                                <b>원격 관리 도구 실행</b>
                                <code>remote_admin_tool</code>
                              </div>
                              <span className="fl-h">it-02</span>
                              <span>
                                <span className="badge good">
                                  <i></i>정상
                                </span>
                              </span>
                              <span className="fl-d">01:40:55</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="fl-hero">
                        <span className="fl-hbg"></span>
                        <span className="fl-hl"></span>
                        <span className="fl-sev"></span>
                        <div className="fl-row">
                          <div className="fl-t">
                            <b>
                              인코딩된 PowerShell 실행<span className="fl-new">NEW</span>
                            </b>
                            <code>powershell_encoded · T1059.001</code>
                          </div>
                          <span className="fl-h">web-03</span>
                          <span>
                            <span className="badge crit">
                              <i></i>심각
                            </span>
                          </span>
                          <span className="fl-sw fl-d fl-sw-res">
                            <span>02:14:06</span>
                            <span>
                              <span className="badge good">
                                <i></i>해결됨
                              </span>
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="fl-inc">
                        <div className="fl-chain fl-panel">
                          <div className="fl-c">
                            <div className="fl-cc">
                              <span>01</span>
                              <small>첨부파일 열람</small>
                              <b>견적서.docm</b>
                            </div>
                            <i className="fl-cb"></i>
                            <i className="fl-chev"></i>
                          </div>
                          <div className="fl-c">
                            <div className="fl-cc">
                              <span>02</span>
                              <small>매크로가 셸 실행</small>
                              <b>winword.exe</b>
                            </div>
                            <i className="fl-cb"></i>
                            <i className="fl-chev"></i>
                          </div>
                          <div className="fl-c">
                            <div className="fl-cc">
                              <span>03</span>
                              <small>자동 실행 등록</small>
                              <b>HKCU\…\Run</b>
                            </div>
                            <i className="fl-cb warn"></i>
                            <i className="fl-chev"></i>
                          </div>
                          <div className="fl-c">
                            <div className="fl-cc">
                              <span>04</span>
                              <small>C2 서버 연결</small>
                              <b>185.220.101.4</b>
                            </div>
                            <i className="fl-cb hit"></i>
                            <i className="fl-chev"></i>
                          </div>
                          <div className="fl-c fl-c5">
                            <div className="fl-cc">
                              <span>05</span>
                              <small>대응</small>
                              <b className="fl-sw fl-sw-c5">
                                <span>조치 대기</span>
                                <span>종료 · 격리</span>
                              </b>
                            </div>
                            <i className="fl-cb ok"></i>
                          </div>
                        </div>

                        <div className="fl-tree fl-panel">
                          <div className="fl-ph">
                            <h4>프로세스 트리</h4>
                            <span>web-03 · 10.0.4.23</span>
                          </div>
                          <ul>
                            <li style={{ '--d': 0 } as CSSProperties}>
                              <span className="fl-pn">outlook.exe</span>
                              <span className="fl-arg">메일 첨부파일 열기</span>
                              <span className="fl-pid">PID 2210</span>
                            </li>
                            <li style={{ '--d': 1 } as CSSProperties}>
                              <span className="fl-g">└─</span>
                              <span className="fl-pn">winword.exe</span>
                              <span className="fl-arg">견적서.docm</span>
                              <span className="fl-pid">PID 3376</span>
                            </li>
                            <li style={{ '--d': 2 } as CSSProperties} className="fl-bad">
                              <span className="fl-hl"></span>
                              <span className="fl-sev"></span>
                              <span className="fl-g">└─</span>
                              <span className="fl-pn">powershell.exe</span>
                              <span className="fl-arg">
                                -enc JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0
                              </span>
                              <span className="fl-pid">PID 4182</span>
                              <span className="badge crit">
                                <i></i>악성
                              </span>
                            </li>
                            <li style={{ '--d': 3 } as CSSProperties}>
                              <span className="fl-g">└─</span>
                              <span className="fl-pn">tcp</span>
                              <span className="fl-arg">185.220.101.4:443</span>
                              <span className="fl-pid">연결 12회</span>
                            </li>
                          </ul>
                        </div>

                        <div className="fl-adv">
                          <div>
                            <small>RECOMMENDED</small>
                            <p>
                              <b>web-03</b> 의 악성 프로세스를 종료하고 격리하세요
                            </p>
                          </div>
                          <div className="fl-acts">
                            <span className="fl-sw fl-sw-kill">
                              <span className="fl-btn primary">프로세스 종료</span>
                              <span className="fl-btn primary">
                                <svg
                                  className="fl-spin"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                >
                                  <path d="M21 12a9 9 0 1 1-9-9" />
                                </svg>
                                종료 요청 중
                              </span>
                              <span className="badge good">
                                <i></i>종료 완료 · PID 4182
                              </span>
                            </span>
                            <span className="fl-sw fl-sw-iso">
                              <span className="fl-btn">호스트 격리</span>
                              <span className="badge low">
                                <i></i>격리됨
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="fl-host fl-panel">
                          <div>
                            <b>web-03</b>
                            <small>Windows Server 2022</small>
                          </div>
                          <dl>
                            <div>
                              <dt>네트워크</dt>
                              <dd className="fl-sw fl-sw-net">
                                <span>연결됨</span>
                                <span>차단됨</span>
                              </dd>
                            </div>
                            <div>
                              <dt>powershell.exe</dt>
                              <dd className="fl-sw fl-sw-ps">
                                <span>실행 중</span>
                                <span>종료됨</span>
                              </dd>
                            </div>
                            <div>
                              <dt>에이전트</dt>
                              <dd>정상 수집</dd>
                            </div>
                          </dl>
                          <span className="fl-sw fl-sw-host">
                            <span className="badge crit">
                              <i></i>위험
                            </span>
                            <span className="badge low">
                              <i></i>격리됨
                            </span>
                          </span>
                        </div>

                        <div className="fl-tl fl-panel">
                          <div className="fl-tlx">
                            <span className="fl-trk">
                              <i></i>
                            </span>
                            <div className="fl-ts">
                              <i></i>
                              <em></em>
                              <b>탐지</b>
                              <small>T+00:00</small>
                            </div>
                            <div className="fl-ts">
                              <i></i>
                              <em></em>
                              <b>조사</b>
                              <small>T+00:09</small>
                            </div>
                            <div className="fl-ts">
                              <i></i>
                              <em></em>
                              <b>종료</b>
                              <small>T+00:38</small>
                            </div>
                            <div className="fl-ts">
                              <i></i>
                              <em></em>
                              <b>격리</b>
                              <small>T+00:47</small>
                            </div>
                          </div>
                          <div className="fl-stamp">
                            <small>탐지부터 해결까지</small>
                            <b>T+00:47</b>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="fl-cur">
                  <span className="fl-rip"></span>
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <path
                      d="M3 2l13 7.6-5.7 1.3 3.3 6.1-2.4 1.2-3.2-6.2L3.6 16z"
                      fill="var(--ink)"
                      stroke="var(--bg)"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Flow
