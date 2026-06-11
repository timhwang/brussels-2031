/* Brussels 2031 — chart engine.
   Mechanic inspired by europe2031.ai's compute panels (sticky icon grids driven by
   a scroll listener) and ai-2027.com's timeline chart (a line that extends
   continuously as you read), reimplemented from scratch. All figures after
   May 2026 are invented satire; pre-2026 anchors are rough but real
   (AI Act = 144 OJ pages, etc.). */

(() => {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = new Intl.NumberFormat("en-IE");

  /* ================= DATA =================
     t = months since January 2025; the charts' x-axis and the scroll
     interpolation both run on it.

     Prologue (real-ish): cumulative pages of EU AI rules & guidance vs GW of AI
     compute built. Pages: AI Act (144, OJ 2024/1689) + prohibited-practices
     guidelines (~140) + GPAI Code of Practice/guidelines/template/FAQ + omnibus
     etc., loosely summed. GW: deliberately small numbers; the flat line is the
     joke. May 2026 goes DOWN 0.8 → 0.6 (an audit finds one counted facility was a
     rendering, another was counted twice) — a bolt icon leaves, the counter drops,
     and on the shared-axis chart the dip is, fittingly, invisible. */
  const PROLOGUE = [
    { date: "2025-01", label: "January 2025",  pages: 232,  gw: 0.5 },
    { date: "2025-04", label: "April 2025",    pages: 511,  gw: 0.55 },
    { date: "2025-08", label: "August 2025",   pages: 702,  gw: 0.65 },
    { date: "2025-11", label: "November 2025", pages: 894,  gw: 0.7 },
    { date: "2026-02", label: "February 2026", pages: 1163, gw: 0.8 },
    { date: "2026-05", label: "May 2026",      pages: 1327, gw: 0.6 },
  ];

  /* Scenario (wholly invented): cumulative strategy documents / consultations /
     expert groups vs datacentres energised. Jun 2029 dips by one on purpose —
     Aurelia-1 is de-energised and an icon (and the gold line) must go down. */
  const SCENARIO = [
    { date: "2026-08", label: "August 2026",   papers: 96,  dc: 7 },
    { date: "2027-03", label: "March 2027",    papers: 168, dc: 7 },
    { date: "2027-10", label: "October 2027",  papers: 241, dc: 8 },
    { date: "2028-04", label: "April 2028",    papers: 312, dc: 8 },
    { date: "2028-11", label: "November 2028", papers: 405, dc: 9 },
    { date: "2029-06", label: "June 2029",     papers: 466, dc: 8 },
    { date: "2030-01", label: "January 2030",  papers: 531, dc: 9 },
    { date: "2030-08", label: "August 2030",   papers: 612, dc: 10 },
    { date: "2031-03", label: "March 2031",    papers: 704, dc: 11 },
  ];

  const monthIndex = (date) => {
    const [y, m] = date.split("-").map(Number);
    return (y - 2025) * 12 + (m - 1);
  };
  PROLOGUE.forEach((d) => (d.t = monthIndex(d.date)));
  SCENARIO.forEach((d) => (d.t = monthIndex(d.date)));

  const pts = (data, key) => data.map((d) => ({ t: d.t, v: d[key] }));
  const PAGES_PTS = pts(PROLOGUE, "pages");
  const GW_PTS = pts(PROLOGUE, "gw");
  const PAPERS_PTS = pts(SCENARIO, "papers");
  const DC_PTS = pts(SCENARIO, "dc");

  const PAGES_PER_ICON = 100;
  const GW_PER_ICON = 0.25;
  const PAPERS_PER_ICON = 25;

  function valueAt(points, t) {
    if (t <= points[0].t) return points[0].v;
    const last = points[points.length - 1];
    if (t >= last.t) return last.v;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      if (t < b.t) return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
    }
    return last.v;
  }

  /* ================= LINE CHARTS =================
     ai-2027-style: the x-axis is narrative time; update(tNow) redraws each line
     up to tNow (with an interpolated head point), moves the head dots and the
     dashed "now" cursor, and switches milestone dots on as they are passed. */

  const SVG_NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function makeChart(svgId, cfg) {
    const svg = document.getElementById(svgId);
    if (!svg) return null;
    const W = 272, H = 132, L = 6, R = 6, T = 8, B = 16;
    const { t0, t1, years, series } = cfg;
    const X = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);

    el("line", { x1: L, y1: H - B, x2: W - R, y2: H - B, class: "chart-axis" }, svg);
    for (const y of years) {
      el("line", { x1: X(y.t), y1: H - B, x2: X(y.t), y2: H - B + 3, class: "chart-axis" }, svg);
      el("text", { x: X(y.t), y: H - 4, class: "chart-year", "text-anchor": "middle" }, svg)
        .textContent = y.label;
    }
    const nowLine = el("line", { x1: X(t0), y1: T, x2: X(t0), y2: H - B, class: "chart-now" }, svg);

    const built = series.map((s) => {
      // Each series may share the primary's yMax ("one harmonised axis") or carry
      // its own cropped range via vMin/yMax ("rescaled until both were visible") —
      // different chart crimes, one per panel.
      const lo = s.vMin || 0;
      const Y = (v) => H - B - ((v - lo) / (s.yMax - lo)) * (H - T - B - 4);
      const path = el("path", { class: `chart-line ${s.cls}` }, svg);
      const dots = s.points.map((p) =>
        el("circle", { cx: X(p.t), cy: Y(p.v), r: 2.4, class: `chart-dot ${s.cls}` }, svg));
      const head = el("circle", { r: 3.4, class: `chart-head ${s.cls}` }, svg);
      return { s, Y, path, dots, head };
    });

    function update(tNow) {
      tNow = Math.max(t0, Math.min(t1, tNow));
      const xNow = X(tNow).toFixed(1);
      nowLine.setAttribute("x1", xNow);
      nowLine.setAttribute("x2", xNow);
      for (const b of built) {
        const P = b.s.points;
        const seg = [];
        for (const p of P) { if (p.t <= tNow) seg.push(p); else break; }
        const headV = valueAt(P, tNow);
        seg.push({ t: tNow, v: headV });
        b.path.setAttribute("d",
          seg.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)} ${b.Y(p.v).toFixed(1)}`).join(" "));
        b.head.setAttribute("cx", xNow);
        b.head.setAttribute("cy", b.Y(headV).toFixed(1));
        b.dots.forEach((d, i) => d.classList.toggle("on", P[i].t <= tNow));
      }
    }
    return { update };
  }

  const chart1 = makeChart("p1-chart", {
    t0: PROLOGUE[0].t,
    t1: PROLOGUE[PROLOGUE.length - 1].t,
    years: [{ t: 0, label: "2025" }, { t: 12, label: "2026" }],
    series: [
      { points: PAGES_PTS, yMax: 1400, cls: "s-blue" },
      { points: GW_PTS, yMax: 1400, cls: "s-gold" }, // same axis; that's the joke
    ],
  });

  const chart2 = makeChart("p2-chart", {
    t0: SCENARIO[0].t,
    t1: SCENARIO[SCENARIO.length - 1].t,
    years: [24, 36, 48, 60, 72].map((t) => ({ t, label: "’" + (25 + Math.floor(t / 12)) })),
    series: [
      { points: PAPERS_PTS, yMax: 750, cls: "s-blue" },
      // Cropped axis (starts at 6.5 datacentres): keeps the gold line honestly
      // below the blue one while leaving the Jun 2029 dip plainly visible.
      { points: DC_PTS, vMin: 6.5, yMax: 14, cls: "s-gold" },
    ],
  });

  /* ================= ICON GRID =================
     Diff target count vs current cells; stagger entries ~26ms (≤520ms total) and
     exits ~20ms (≤320ms total), like the original's feel. Leaving cells can be
     reclaimed if the user scrolls back up mid-animation. */

  const tpl = document.getElementById("tpl-cell");
  const removeTimers = new WeakMap();

  function makeCell(iconId) {
    const cell = tpl.content.firstElementChild.cloneNode(true);
    cell.querySelector("use").setAttribute("href", "#" + iconId);
    return cell;
  }

  function setCount(grid, iconId, target) {
    target = Math.max(0, Math.round(target));
    const cells = Array.from(grid.children);
    const leaving = cells.filter((c) => c.classList.contains("is-leaving"));
    let live = cells.length - leaving.length;

    if (target > live) {
      // First reclaim cells that are mid-exit.
      for (const cell of leaving) {
        if (live >= target) break;
        const t = removeTimers.get(cell);
        if (t !== undefined) { clearTimeout(t); removeTimers.delete(cell); }
        cell.style.transitionDelay = "0ms";
        cell.classList.remove("is-leaving");
        live++;
      }
      const toAdd = target - live;
      if (toAdd > 0) {
        const step = Math.min(26, 520 / toAdd);
        const frag = document.createDocumentFragment();
        const fresh = [];
        for (let i = 0; i < toAdd; i++) {
          const cell = makeCell(iconId);
          cell.classList.add("is-entering");
          frag.appendChild(cell);
          fresh.push(cell);
        }
        grid.appendChild(frag);
        fresh.forEach((cell, i) => {
          cell.style.transitionDelay = REDUCED ? "0ms" : `${Math.round(i * step)}ms`;
          void cell.offsetWidth; // commit starting state before transitioning
          cell.classList.remove("is-entering");
        });
      }
    } else if (target < live) {
      const settled = cells.filter((c) => !c.classList.contains("is-leaving"));
      const victims = settled.slice(target).reverse();
      const step = Math.min(20, 320 / victims.length);
      victims.forEach((cell, i) => {
        const delay = REDUCED ? 0 : Math.round(i * step);
        cell.style.transitionDelay = `${delay}ms`;
        cell.classList.add("is-leaving");
        const t = setTimeout(() => {
          if (cell.parentNode === grid) grid.removeChild(cell);
          removeTimers.delete(cell);
        }, delay + 410); // transition 360ms + slack; timeout also covers hidden tabs
        removeTimers.set(cell, t);
      });
    }
  }

  function setText(el, text) {
    if (!el || el.textContent === text) return;
    el.textContent = text;
    if (!REDUCED) {
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
    }
  }

  // Continuous counters update every frame while scrolling — no bump animation,
  // the spinning digits are the effect.
  function setPlain(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  /* ================= PANELS =================
     Stepped per chapter: icon grids and the period label (batch cascades read
     better than a one-by-one trickle). Continuous with scroll: line charts,
     counters and ratio stats. */

  const $ = (id) => document.getElementById(id);

  function stepPrologue(i) {
    const d = PROLOGUE[i];
    setCount($("p1-grid-pages"), "icon-doc", d.pages / PAGES_PER_ICON);
    setCount($("p1-grid-gw"), "icon-bolt", d.gw / GW_PER_ICON);
    setText($("p1-period"), d.label);
  }

  function stepScenario(i) {
    const d = SCENARIO[i];
    setCount($("p2-grid-papers"), "icon-clipboard", d.papers / PAPERS_PER_ICON);
    setCount($("p2-grid-dc"), "icon-building", d.dc);
    setText($("p2-period"), d.label);
  }

  function flowPrologue(t) {
    const pages = valueAt(PAGES_PTS, t);
    const gw = valueAt(GW_PTS, t);
    setPlain($("p1-val-pages"), fmt.format(Math.round(pages)));
    setPlain($("p1-val-gw"), `${gw.toFixed(1)} GW`);
    setPlain($("p1-stat"), fmt.format(Math.round(pages / gw)));
    if (chart1) chart1.update(t);
  }

  function flowScenario(t) {
    const papers = valueAt(PAPERS_PTS, t);
    const dc = valueAt(DC_PTS, t);
    setPlain($("p2-val-papers"), fmt.format(Math.round(papers)));
    setPlain($("p2-val-dc"), String(Math.round(dc)));
    setPlain($("p2-stat"), fmt.format(Math.round(papers / dc)));
    if (chart2) chart2.update(t);
  }

  /* ================= SCROLL DRIVER =================
     Active chapter = last one whose top has crossed 30% of viewport height;
     narrative time tNow interpolates between adjacent chapters' trigger points,
     so the chart line extends smoothly while you read (ai-2027 style). */

  const prologueChapters = Array.from(document.querySelectorAll("#prologue .chapter"));
  const scenarioChapters = Array.from(document.querySelectorAll("#scenario .chapter"));
  const navLinks = Array.from(document.querySelectorAll(".chapter-nav a"));
  const navById = new Map(navLinks.map((a) => [a.getAttribute("href").slice(1), a]));

  let lastP = -1, lastS = -1, lastNav = null;

  function measure(chapters, data, line) {
    const tops = chapters.map((c) => c.getBoundingClientRect().top);
    let i = -1;
    for (let k = 0; k < tops.length; k++) {
      if (tops[k] <= line) i = k;
      else break;
    }
    const idx = Math.max(0, i);
    let t;
    if (i < 0) t = data[0].t;
    else if (i >= data.length - 1) t = data[data.length - 1].t;
    else {
      const span = tops[i + 1] - tops[i];
      const frac = span > 0 ? Math.min(1, Math.max(0, (line - tops[i]) / span)) : 0;
      t = data[i].t + (data[i + 1].t - data[i].t) * frac;
    }
    return { idx, t, active: i >= 0 ? chapters[i].id : null };
  }

  function onScroll() {
    const line = window.innerHeight * 0.3;

    const p = measure(prologueChapters, PROLOGUE, line);
    if (p.idx !== lastP) { lastP = p.idx; stepPrologue(p.idx); }
    flowPrologue(p.t);

    const s = measure(scenarioChapters, SCENARIO, line);
    if (s.idx !== lastS) { lastS = s.idx; stepScenario(s.idx); }
    flowScenario(s.t);

    // Nav highlight follows whichever chapter is current across the whole essay.
    const id = s.active ?? p.active;
    if (id !== lastNav) {
      lastNav = id;
      navLinks.forEach((a) => a.classList.remove("active"));
      const link = navById.get(id);
      if (link) {
        link.classList.add("active");
        link.scrollIntoView({ block: "nearest", inline: "center", behavior: REDUCED ? "auto" : "smooth" });
      }
    }
  }

  let scheduled = false;
  function runUpdate() {
    if (!scheduled) return;
    scheduled = false;
    onScroll();
  }
  function requestUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(runUpdate);
    setTimeout(runUpdate, 120); // rAF can starve in background/hidden tabs
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  onScroll();

  /* ================= COOKIE TICKERS =================
     Napkin math: ~449 million EU residents × ~6 consent interactions per person
     per day ÷ 86,400 s/day ≈ 31,180 banner clicks per second, EU-wide. The false
     precision is part of the joke. */

  const CLICKS_PER_SECOND = 31_183;
  const GDPR_EPOCH = Date.UTC(2018, 4, 25); // 25 May 2018, the day the banners came
  const pageLoad = Date.now();

  const liveEl = $("ticker-live");
  const sinceEl = $("ticker-2018");

  function tick() {
    const now = Date.now();
    liveEl.textContent = fmt.format(Math.floor(((now - pageLoad) / 1000) * CLICKS_PER_SECOND));
    if (sinceEl) sinceEl.textContent = fmt.format(Math.floor(((now - GDPR_EPOCH) / 1000) * CLICKS_PER_SECOND));
  }
  tick();
  setInterval(tick, REDUCED ? 1000 : 250);
})();
