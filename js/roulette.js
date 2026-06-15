/* ============================================================
   roulette.js — European (single zero) roulette
   Real wheel pocket order, ball that orbits opposite the wheel,
   spirals in, clatters and settles. True payouts & uniform odds.
   straight 35:1 · even money 1:1 · dozens/columns 2:1
   ============================================================ */
import { Bank } from './bank.js';
import { fmt, el, toast, Sound, sleep, coinBurst, rnd } from './ui.js';

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');

// real European single-zero wheel order (clockwise from 0)
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const SEG = 360 / WHEEL.length;

const CHIPS = [
  { v: 10, c1: '#ffffff', c2: '#2b6cff' },
  { v: 25, c1: '#ffffff', c2: '#19a463' },
  { v: 50, c1: '#ffffff', c2: '#c8392b' },
  { v: 100, c1: '#f7e7a3', c2: '#1a1a1a' }
];

const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- build the wheel SVG ---------- */
function buildWheel() {
  const cx = 150, cy = 150;
  const rOut = 144, rIn = 99, rNum = 121;
  const pol = (r, a) => {
    const rad = (a * Math.PI) / 180;
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
  };
  let segs = '';
  let nums = '';
  WHEEL.forEach((n, i) => {
    const c = i * SEG;
    const a0 = c - SEG / 2, a1 = c + SEG / 2;
    const [ix0, iy0] = pol(rIn, a0), [ox0, oy0] = pol(rOut, a0);
    const [ox1, oy1] = pol(rOut, a1), [ix1, iy1] = pol(rIn, a1);
    const fill = n === 0 ? '#0a7a3f' : RED.has(n) ? '#c5281d' : '#141414';
    segs += `<path d="M${ix0.toFixed(2)} ${iy0.toFixed(2)} L${ox0.toFixed(2)} ${oy0.toFixed(2)} A${rOut} ${rOut} 0 0 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)} L${ix1.toFixed(2)} ${iy1.toFixed(2)} A${rIn} ${rIn} 0 0 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)} Z" fill="${fill}" stroke="#caa64a" stroke-width="0.7"/>`;
    nums += `<text x="${cx}" y="${cy - rNum}" transform="rotate(${c.toFixed(3)} ${cx} ${cy})" fill="#fff" font-size="9.5" font-weight="700" font-family="Inter,sans-serif" text-anchor="middle" dominant-baseline="central">${n}</text>`;
  });
  // turret spokes
  let spokes = '';
  for (let k = 0; k < 8; k++) {
    const a = k * 45;
    const [x, y] = pol(58, a);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#caa64a" stroke-width="2.2" stroke-linecap="round"/>`;
    const [dx, dy] = pol(86, a + 22.5);
    spokes += `<circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="3" fill="#e9d9a3"/>`;
  }
  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="148" fill="none" stroke="#7a5a1e" stroke-width="6"/>
    <circle cx="${cx}" cy="${cy}" r="146" fill="none" stroke="#e9cf8c" stroke-width="1.5"/>
    ${segs}
    <circle cx="${cx}" cy="${cy}" r="99" fill="none" stroke="#caa64a" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="96" fill="url(#cone)"/>
    ${spokes}
    <circle cx="${cx}" cy="${cy}" r="40" fill="#15100a" stroke="#caa64a" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="url(#hub)" stroke="#7a5a1e" stroke-width="1.5"/>
    ${nums}
    <defs>
      <radialGradient id="cone" cx="50%" cy="38%" r="65%">
        <stop offset="0%" stop-color="#26190d"/><stop offset="60%" stop-color="#15100a"/><stop offset="100%" stop-color="#0a0805"/>
      </radialGradient>
      <radialGradient id="hub" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stop-color="#f4e3ab"/><stop offset="55%" stop-color="#c9a14e"/><stop offset="100%" stop-color="#8a6a22"/>
      </radialGradient>
    </defs>
  </svg>`;
}

export function mountRoulette(root, { go }) {
  let chip = 25;
  let bets = {};
  let staked = 0;
  let busy = false;
  let wheelBase = 0; // accumulated wheel rotation
  const history = [];

  const screen = el('div', 'game');
  screen.innerHTML = `
    <div class="game-head">
      <div><div class="game-title">Roulette</div><div class="game-sub">European · single zero · 35:1 straight up</div></div>
    </div>
    <div class="felt" style="overflow-y:auto;justify-content:flex-start;padding:10px 6px">
      <div class="roulette-wrap">
        <div class="rwheel-stage">
          <div class="r-pointer"></div>
          <div class="rwheel" id="rwheel"></div>
          <div class="rball" id="rball"></div>
        </div>
        <div id="resultArea" style="height:28px;display:flex;align-items:center;gap:8px"></div>
        <div class="result-history" id="history"></div>
        <div class="rtable" id="rtable"></div>
      </div>
    </div>
    <div class="dock">
      <div class="msg-banner" id="rMsg">Pick a chip, tap the layout, then spin</div>
      <div class="stat-strip">
        <span class="pill">On table <b id="staked">0</b></span>
      </div>
      <div class="chips" id="chips"></div>
      <div class="row">
        <button class="btn ghost small" id="clearBtn">Clear</button>
        <button class="btn primary" id="spinBtn">SPIN ▸</button>
      </div>
    </div>`;

  const rtable = screen.querySelector('#rtable');
  const chipsEl = screen.querySelector('#chips');
  const stakedEl = screen.querySelector('#staked');
  const msg = screen.querySelector('#rMsg');
  const wheelEl = screen.querySelector('#rwheel');
  const ballEl = screen.querySelector('#rball');
  const stage = screen.querySelector('.rwheel-stage');
  const resultArea = screen.querySelector('#resultArea');
  const historyEl = screen.querySelector('#history');
  const spinBtn = screen.querySelector('#spinBtn');
  const clearBtn = screen.querySelector('#clearBtn');

  wheelEl.innerHTML = buildWheel();
  // park the ball on the resting ring (visible) once the stage has a measured size
  requestAnimationFrame(() => {
    const half = (stage.offsetWidth || 280) / 2;
    ballEl.style.transform = `translate(-50%,-50%) translateY(${-half * 0.785}px)`;
  });

  const setMsg = (t, cls = '') => { msg.textContent = t; msg.className = 'msg-banner ' + cls; };

  /* ---------- chip selector ---------- */
  CHIPS.forEach((c) => {
    const d = el('div', 'chip' + (c.v === chip ? ' sel' : ''));
    d.style.setProperty('--c1', c.c1); d.style.setProperty('--c2', c.c2);
    d.innerHTML = `<span>${c.v}</span>`;
    d.onclick = () => {
      chip = c.v; Sound.chip();
      [...chipsEl.children].forEach((x, i) => x.classList.toggle('sel', CHIPS[i].v === chip));
    };
    chipsEl.appendChild(d);
  });

  /* ---------- place a bet ---------- */
  function place(id, cell) {
    if (busy) return;
    if (!Bank.wager(chip)) { toast('Not enough coins', 'bad'); return; }
    bets[id] = (bets[id] || 0) + chip;
    staked += chip;
    stakedEl.textContent = fmt(staked);
    Sound.chip();
    let badge = cell.querySelector('.stake');
    if (!badge) { badge = el('span', 'stake'); cell.appendChild(badge); }
    badge.textContent = bets[id] >= 1000 ? (bets[id] / 1000).toFixed(1) + 'k' : bets[id];
  }

  /* ---------- build the layout (cloth) ---------- */
  // zero
  const zero = el('div', 'rcell rzero', '0');
  zero.onclick = () => place('n0', zero);
  rtable.appendChild(zero);
  // numbers 1..36 in standard table order
  for (let j = 1; j <= 12; j++) {
    [3 * j, 3 * j - 1, 3 * j - 2].forEach((num, rowIdx) => {
      const cell = el('div', `rcell ${colorOf(num)}`, String(num));
      cell.style.gridColumn = String(j + 1);
      cell.style.gridRow = String(rowIdx + 1);
      cell.onclick = () => place('n' + num, cell);
      rtable.appendChild(cell);
    });
  }
  // 2:1 column bets (right edge): top row -> col3, mid -> col2, bottom -> col1
  [['c3', 1], ['c2', 2], ['c1', 3]].forEach(([id, row]) => {
    const cell = el('div', 'rcell rcol21', '2:1');
    cell.style.gridColumn = '14'; cell.style.gridRow = String(row);
    cell.onclick = () => place(id, cell);
    rtable.appendChild(cell);
  });
  // dozens (row 4)
  [['d1', '1st 12', '2 / 6'], ['d2', '2nd 12', '6 / 10'], ['d3', '3rd 12', '10 / 14']].forEach(([id, label, col]) => {
    const cell = el('div', 'rcell rband', label);
    cell.style.gridRow = '4'; cell.style.gridColumn = col;
    cell.onclick = () => place(id, cell);
    rtable.appendChild(cell);
  });
  // even-money (row 5)
  const EVEN = [
    ['low', '1–18', ''], ['even', 'EVEN', ''],
    ['red', '<span class="dia">◆</span>', 'red'], ['black', '<span class="dia">◆</span>', 'black'],
    ['odd', 'ODD', ''], ['high', '19–36', '']
  ];
  EVEN.forEach(([id, label, extra], i) => {
    const cell = el('div', 'rcell rband ' + extra, label);
    cell.style.gridRow = '5';
    cell.style.gridColumn = `${2 + i * 2} / ${4 + i * 2}`;
    cell.onclick = () => place(id, cell);
    rtable.appendChild(cell);
  });

  /* ---------- clear ---------- */
  clearBtn.onclick = () => {
    if (busy || staked === 0) return;
    Bank.payout(staked);
    bets = {}; staked = 0; stakedEl.textContent = '0';
    screen.querySelectorAll('.rtable .stake').forEach((s) => s.remove());
    setMsg('Bets cleared'); Sound.click();
  };

  /* ---------- payouts ---------- */
  function payoutFor(id, stake, res) {
    if (id[0] === 'n') return +id.slice(1) === res ? stake * 36 : 0;
    if (res === 0) return 0;
    const m = {
      red: () => RED.has(res), black: () => !RED.has(res),
      even: () => res % 2 === 0, odd: () => res % 2 === 1,
      low: () => res <= 18, high: () => res >= 19,
      d1: () => res <= 12, d2: () => res >= 13 && res <= 24, d3: () => res >= 25,
      c1: () => res % 3 === 1, c2: () => res % 3 === 2, c3: () => res % 3 === 0
    };
    const evenMoney = ['red', 'black', 'even', 'odd', 'low', 'high'];
    if (m[id] && m[id]()) return evenMoney.includes(id) ? stake * 2 : stake * 3;
    return 0;
  }

  /* ---------- wheel + ball animation ---------- */
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);
  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  function animateSpin(result) {
    return new Promise((resolve) => {
      const idx = WHEEL.indexOf(result);
      const pocketAngle = idx * SEG;                 // pocket position on wheel from top
      const size = stage.offsetWidth || 280;
      const half = size / 2;
      const trackR = half * 0.90;                    // outer ball track
      const pocketR = half * 0.785;                  // resting ring (over numbers)

      // wheel: spin clockwise so winning pocket ends at top (under pointer)
      const wheelSpins = 4;
      const targetMod = ((-pocketAngle) % 360 + 360) % 360;
      const curMod = ((wheelBase % 360) + 360) % 360;
      const delta = wheelSpins * 360 + (((targetMod - curMod) % 360) + 360) % 360;
      const wheelTo = wheelBase + delta;

      // ball: counter-clockwise, integer revolutions so it lands at top (0)
      const ballSpins = 14;
      const ballSweep = -(ballSpins * 360);

      const T = reduced ? 1200 : 8200;
      const start = performance.now();
      let tickAcc = 0, lastBall = 0, lastTick = 0;

      function frame(now) {
        let p = (now - start) / T;
        if (p > 1) p = 1;

        // wheel
        const wAng = wheelBase + delta * easeOutCubic(p);
        wheelEl.style.transform = `rotate(${wAng}deg)`;

        // ball angle (decelerating)
        const bAng = ballSweep * easeOutQuart(p);

        // radius: stay on track, then spiral in, then a couple of settle bounces
        let d;
        if (p < 0.5) d = trackR;
        else if (p < 0.86) d = trackR + (pocketR - trackR) * easeInOut((p - 0.5) / 0.36);
        else {
          const t = (p - 0.86) / 0.14;
          const bounce = Math.sin(t * Math.PI * 3) * (1 - t) * half * 0.045;
          d = pocketR + Math.abs(bounce);
        }
        ballEl.style.transform = `translate(-50%,-50%) rotate(${bAng}deg) translateY(${-d}px)`;

        // clatter ticks tied to how many pockets the ball passes (slows naturally)
        tickAcc += Math.abs(bAng - lastBall);
        lastBall = bAng;
        if (tickAcc >= SEG && now - lastTick > 35 && p < 0.99) {
          tickAcc = 0; lastTick = now; Sound.tick();
        }

        if (p < 1) requestAnimationFrame(frame);
        else { wheelBase = wheelTo; resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------- spin orchestration ---------- */
  async function spin() {
    if (busy) return;
    if (staked === 0) { toast('Place a bet first', 'bad'); return; }
    busy = true; spinBtn.disabled = true; clearBtn.disabled = true;
    Bank.bumpSpins();
    setMsg('No more bets…'); resultArea.innerHTML = '';
    Sound.spin();

    const res = rnd(37);
    await animateSpin(res);

    // reveal
    const col = colorOf(res);
    const badge = el('div', `result-num ${col}`, String(res));
    resultArea.appendChild(badge);
    resultArea.appendChild(el('div', 'pill', col.toUpperCase()));

    history.unshift(res);
    historyEl.innerHTML = '';
    history.slice(0, 14).forEach((n) => historyEl.appendChild(el('div', 'rh ' + colorOf(n), String(n))));

    let totalReturn = 0;
    for (const [id, stake] of Object.entries(bets)) totalReturn += payoutFor(id, stake, res);
    const net = totalReturn - staked;

    await sleep(220);
    if (totalReturn > 0) {
      Bank.payout(totalReturn);
      coinBurst(badge);
      if (net >= 0) { setMsg(`${res} ${col} — you win +${fmt(net)}!`, net > 0 ? 'win' : 'gold'); net > 200 ? Sound.bigwin() : Sound.win(); }
      else { setMsg(`${res} ${col} — back ${fmt(totalReturn)} (net ${fmt(net)})`, 'gold'); Sound.win(); }
    } else {
      setMsg(`${res} ${col} — no win this time`, 'lose');
      Sound.lose();
    }

    // clear table for next round
    bets = {}; staked = 0; stakedEl.textContent = '0';
    screen.querySelectorAll('.rtable .stake').forEach((s) => s.remove());
    busy = false; spinBtn.disabled = false; clearBtn.disabled = false;
  }

  spinBtn.onclick = spin;
  root.appendChild(screen);
  return () => { if (staked > 0) Bank.payout(staked); };
}
