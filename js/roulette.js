/* ============================================================
   roulette.js — European (single zero) roulette, true payouts
   straight 35:1 · even money 1:1 · dozens/columns 2:1
   ============================================================ */
import { Bank } from './bank.js';
import { fmt, el, toast, Sound, sleep, coinBurst, rnd } from './ui.js';

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
const CHIPS = [
  { v: 10, c1: '#ffffff', c2: '#2b6cff' },
  { v: 25, c1: '#ffffff', c2: '#19a463' },
  { v: 50, c1: '#ffffff', c2: '#c8392b' },
  { v: 100, c1: '#f7e7a3', c2: '#1a1a1a' }
];

export function mountRoulette(root, { go }) {
  let chip = 25;
  let bets = {};          // id -> stake
  let staked = 0;         // total currently on the table
  let busy = false;
  const history = [];

  const screen = el('div', 'game');
  screen.innerHTML = `
    <div class="game-head">
      <div><div class="game-title">Roulette</div><div class="game-sub">European · single zero · 35:1 straight up</div></div>
    </div>
    <div class="felt" style="overflow-y:auto;justify-content:flex-start;padding:12px 8px">
      <div class="roulette-wrap">
        <div class="wheel-stage">
          <div class="wheel-pointer"></div>
          <div class="wheel" id="wheel"><div class="wheel-ball" id="ball"></div><div class="wheel-hub">NR</div></div>
        </div>
        <div id="resultArea" style="height:30px;display:flex;align-items:center;gap:8px"></div>
        <div class="result-history" id="history"></div>
        <div class="bet-grid" id="grid"></div>
        <div class="bet-outside" id="outside"></div>
      </div>
    </div>
    <div class="dock">
      <div class="msg-banner" id="rMsg">Pick a chip, tap the board, then spin</div>
      <div class="stat-strip">
        <span class="pill">On table <b id="staked">0</b></span>
      </div>
      <div class="chips" id="chips"></div>
      <div class="row">
        <button class="btn ghost small" id="clearBtn">Clear</button>
        <button class="btn primary" id="spinBtn">SPIN ▸</button>
      </div>
    </div>`;

  const grid = screen.querySelector('#grid');
  const outside = screen.querySelector('#outside');
  const chipsEl = screen.querySelector('#chips');
  const stakedEl = screen.querySelector('#staked');
  const msg = screen.querySelector('#rMsg');
  const wheel = screen.querySelector('#wheel');
  const ball = screen.querySelector('#ball');
  const resultArea = screen.querySelector('#resultArea');
  const historyEl = screen.querySelector('#history');
  const spinBtn = screen.querySelector('#spinBtn');
  const clearBtn = screen.querySelector('#clearBtn');

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

  /* ---------- place / refresh a bet ---------- */
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

  /* ---------- numbers grid ---------- */
  // zero
  const zero = el('div', 'bet-cell green bet-zero', '0');
  zero.style.gridColumn = '1'; zero.style.gridRow = '1 / span 3';
  zero.onclick = () => place('n0', zero);
  grid.appendChild(zero);
  // 1..36
  for (let j = 1; j <= 12; j++) {
    const col = [3 * j, 3 * j - 1, 3 * j - 2]; // top, mid, bottom
    col.forEach((num, rowIdx) => {
      const cell = el('div', `bet-cell ${colorOf(num)}`, String(num));
      cell.style.gridColumn = String(j + 1);
      cell.style.gridRow = String(rowIdx + 1);
      cell.onclick = () => place('n' + num, cell);
      grid.appendChild(cell);
    });
  }

  /* ---------- outside bets ---------- */
  const OUT = [
    { id: 'd1', label: '1st 12', cls: 'bet-out' },
    { id: 'd2', label: '2nd 12', cls: 'bet-out' },
    { id: 'd3', label: '3rd 12', cls: 'bet-out' },
    { id: 'low', label: '1–18', cls: 'bet-out' },
    { id: 'even', label: 'EVEN', cls: 'bet-out' },
    { id: 'red', label: '◆ RED', cls: 'bet-out r1' },
    { id: 'black', label: '◆ BLACK', cls: 'bet-out b1' },
    { id: 'odd', label: 'ODD', cls: 'bet-out' },
    { id: 'high', label: '19–36', cls: 'bet-out' },
    { id: 'c1', label: 'Col 1', cls: 'bet-out' },
    { id: 'c2', label: 'Col 2', cls: 'bet-out' },
    { id: 'c3', label: 'Col 3', cls: 'bet-out' }
  ];
  OUT.forEach((o) => {
    const b = el('div', o.cls, `${o.label}<span class="tiny"></span>`);
    b.onclick = () => place(o.id, b);
    outside.appendChild(b);
  });

  /* ---------- clear ---------- */
  clearBtn.onclick = () => {
    if (busy || staked === 0) return;
    Bank.payout(staked);             // refund
    bets = {}; staked = 0;
    stakedEl.textContent = '0';
    screen.querySelectorAll('.stake').forEach((s) => s.remove());
    setMsg('Bets cleared');
    Sound.click();
  };

  /* ---------- win check ---------- */
  function payoutFor(id, stake, res) {
    if (id[0] === 'n') {                         // straight up
      return +id.slice(1) === res ? stake * 36 : 0;
    }
    if (res === 0) return 0;                      // all outside lose on zero
    const map = {
      red: () => RED.has(res), black: () => !RED.has(res),
      even: () => res % 2 === 0, odd: () => res % 2 === 1,
      low: () => res >= 1 && res <= 18, high: () => res >= 19 && res <= 36,
      d1: () => res <= 12, d2: () => res >= 13 && res <= 24, d3: () => res >= 25,
      c1: () => res % 3 === 1, c2: () => res % 3 === 2, c3: () => res % 3 === 0
    };
    const evenMoney = ['red', 'black', 'even', 'odd', 'low', 'high'];
    if (map[id] && map[id]()) return evenMoney.includes(id) ? stake * 2 : stake * 3;
    return 0;
  }

  /* ---------- spin ---------- */
  async function spin() {
    if (busy) return;
    if (staked === 0) { toast('Place a bet first', 'bad'); return; }
    busy = true; spinBtn.disabled = true; clearBtn.disabled = true;
    Bank.bumpSpins();
    setMsg('No more bets…'); resultArea.innerHTML = '';
    Sound.spin();

    const res = rnd(37);
    // spin wheel for show: several rotations + random offset
    const turns = 5 + rnd(4);
    const deg = turns * 360 + rnd(360);
    wheel.style.transform = `rotate(${deg}deg)`;
    ball.style.transition = 'transform 4.6s cubic-bezier(.2,.7,.1,1)';
    ball.style.transform = `translateX(-50%) rotate(${-deg}deg)`;

    const ticks = setInterval(() => Sound.tick(), 130);
    await sleep(4700);
    clearInterval(ticks);

    // show result
    const col = colorOf(res);
    const badge = el('div', `result-num ${col}`, String(res));
    resultArea.appendChild(badge);
    resultArea.appendChild(el('div', 'pill', `${col.toUpperCase()}`));

    history.unshift(res);
    historyEl.innerHTML = '';
    history.slice(0, 14).forEach((n) => historyEl.appendChild(el('div', 'rh ' + colorOf(n), String(n))));

    // settle
    let totalReturn = 0;
    for (const [id, stake] of Object.entries(bets)) totalReturn += payoutFor(id, stake, res);
    const net = totalReturn - staked;

    await sleep(250);
    if (totalReturn > 0) {
      Bank.payout(totalReturn);
      coinBurst(badge);
      if (net >= 0) { setMsg(`${res} ${col} — you win +${fmt(net)}!`, net > 0 ? 'win' : 'gold'); net > 200 ? Sound.bigwin() : Sound.win(); }
      else { setMsg(`${res} ${col} — back ${fmt(totalReturn)} (net ${fmt(net)})`, 'gold'); Sound.win(); }
    } else {
      setMsg(`${res} ${col} — no win this time`, 'lose');
      Sound.lose();
    }

    // reset table for next round
    bets = {}; staked = 0; stakedEl.textContent = '0';
    screen.querySelectorAll('.stake').forEach((s) => s.remove());
    wheel.style.transition = 'none';
    wheel.style.transform = `rotate(${deg % 360}deg)`;
    requestAnimationFrame(() => { wheel.style.transition = ''; });
    busy = false; spinBtn.disabled = false; clearBtn.disabled = false;
  }

  spinBtn.onclick = spin;
  root.appendChild(screen);
  // refund any unspun bets if the player leaves mid-bet
  return () => { if (staked > 0) Bank.payout(staked); };
}
