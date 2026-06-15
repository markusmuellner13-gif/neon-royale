/* ============================================================
   slots.js — "Lucky Sevens" 3-reel slot, weighted reels (~93% RTP)
   ============================================================ */
import { Bank } from './bank.js';
import { fmt, el, toast, Sound, sleep, coinBurst, modal } from './ui.js';

// reel composition (32 stops). Same strip on every reel.
const STRIP = [
  ...Array(7).fill('🍒'),
  ...Array(7).fill('🍋'),
  ...Array(6).fill('🔔'),
  ...Array(5).fill('⭐'),
  ...Array(4).fill('💎'),
  ...Array(3).fill('7️⃣')
];

const THREE_PAY = { '7️⃣': 60, '💎': 30, '⭐': 14, '🔔': 8, '🍋': 5, '🍒': 4 };
const BETS = [10, 25, 50, 100, 250];
const SYM_H = 56;

function spinReel() { return STRIP[Math.floor(Math.random() * STRIP.length)]; }

/** payout multiplier for the 3 center symbols */
function evaluate([a, b, c]) {
  const cherries = [a, b, c].filter((s) => s === '🍒').length;
  if (a === b && b === c) {
    return { mult: THREE_PAY[a] || 0, label: `Triple ${a}` };
  }
  if (cherries === 2) return { mult: 2, label: 'Two Cherries' };
  if (cherries === 1) return { mult: 1, label: 'Cherry' };
  return { mult: 0, label: '' };
}

export function mountSlots(root, { go }) {
  let bet = 50;
  let busy = false;

  const screen = el('div', 'game');
  screen.innerHTML = `
    <div class="game-head">
      <div><div class="game-title">Lucky Sevens</div><div class="game-sub">3 reels · single payline · max win 60×</div></div>
    </div>
    <div class="felt" style="padding:14px 10px;justify-content:flex-start;overflow-y:auto">
      <div class="slot-machine">
        <div class="slot-top">★ LUCKY SEVENS ★</div>
        <div class="reels">
          <div class="reel"><div class="reel-strip" data-r="0"></div></div>
          <div class="reel"><div class="reel-strip" data-r="1"></div></div>
          <div class="reel"><div class="reel-strip" data-r="2"></div></div>
          <div class="reel-line"></div>
          <div class="slot-glass"></div>
        </div>
        <div class="paytable">
          <div class="pt"><span>7️⃣7️⃣7️⃣</span><b>60×</b></div>
          <div class="pt"><span>💎💎💎</span><b>30×</b></div>
          <div class="pt"><span>⭐⭐⭐</span><b>14×</b></div>
          <div class="pt"><span>🔔🔔🔔</span><b>8×</b></div>
          <div class="pt"><span>🍋🍋🍋</span><b>5×</b></div>
          <div class="pt"><span>🍒🍒🍒</span><b>4×</b></div>
          <div class="pt"><span>🍒🍒 any</span><b>2×</b></div>
          <div class="pt"><span>🍒 any</span><b>1×</b></div>
        </div>
      </div>
    </div>
    <div class="dock">
      <div class="msg-banner" id="slotMsg">Set your bet and pull!</div>
      <div class="stat-strip">
        <span class="pill">Bet <b id="betVal">${bet}</b></span>
        <span class="pill">Last win <b id="lastWin">0</b></span>
      </div>
      <div class="row" id="betRow"></div>
      <div class="row">
        <button class="btn primary" id="spinBtn">SPIN 🎰</button>
      </div>
    </div>`;

  const strips = [...screen.querySelectorAll('.reel-strip')];
  const msg = screen.querySelector('#slotMsg');
  const betVal = screen.querySelector('#betVal');
  const lastWin = screen.querySelector('#lastWin');
  const spinBtn = screen.querySelector('#spinBtn');
  const betRow = screen.querySelector('#betRow');

  // init reels with random symbols
  function fillStrip(strip, symbols) {
    strip.innerHTML = '';
    symbols.forEach((s) => strip.appendChild(el('div', 'sym', s)));
  }
  const current = [spinReel(), spinReel(), spinReel()];
  strips.forEach((st, i) => {
    fillStrip(st, [spinReel(), current[i], spinReel()]);
    st.style.transform = `translateY(${-0}px)`;
  });

  // bet buttons
  BETS.forEach((b) => {
    const btn = el('button', 'btn ghost small' + (b === bet ? ' primary' : ''), fmt(b));
    btn.onclick = () => {
      if (busy) return;
      bet = b; betVal.textContent = fmt(b); Sound.chip();
      [...betRow.children].forEach((c, i) => c.className = 'btn ghost small' + (BETS[i] === bet ? ' primary' : ''));
    };
    betRow.appendChild(btn);
  });

  async function spin() {
    if (busy) return;
    if (!Bank.canBet(bet)) { toast('Not enough coins for that bet', 'bad'); return; }
    busy = true; spinBtn.disabled = true;
    Bank.wager(bet); Bank.bumpSpins();
    msg.textContent = 'Spinning…'; msg.className = 'msg-banner';
    Sound.spin();

    const results = [spinReel(), spinReel(), spinReel()];

    // build long strips that end on the result (center)
    const promises = strips.map((st, i) => animateReel(st, results[i], i));
    await Promise.all(promises);

    const { mult, label } = evaluate(results);
    const win = mult * bet;
    if (win > 0) {
      Bank.payout(win);
      lastWin.textContent = fmt(win);
      const big = mult >= 14;
      msg.textContent = `${label} — +${fmt(win)} coins!`;
      msg.className = 'msg-banner ' + (big ? 'gold' : 'win');
      coinBurst(screen.querySelector('.reels'));
      big ? Sound.bigwin() : Sound.win();
      if (results.every((s) => s === '7️⃣')) {
        await sleep(300);
        modal({ emoji: '🎉', title: 'JACKPOT! 7-7-7', body: `You hit the Lucky Sevens jackpot for <b style="color:#f7e7a3">${fmt(win)}</b> coins!`, actions: [{ label: 'Cash in', value: true, primary: true }] });
      }
    } else {
      lastWin.textContent = '0';
      msg.textContent = 'No win — spin again!';
      msg.className = 'msg-banner lose';
      Sound.lose();
    }

    busy = false; spinBtn.disabled = false;
  }

  // animate a single reel to land on `result` in the center row
  async function animateReel(strip, result, idx) {
    const N = 22 + idx * 6;               // stagger length so reels stop left→right
    const seq = [];
    for (let k = 0; k < N; k++) seq.push(spinReel());
    seq.push(spinReel());                 // top filler
    seq.push(result);                     // center (payline)
    seq.push(spinReel());                 // bottom filler
    fillStrip(strip, seq);

    // start high, transition down to land with result centered
    const resultIndex = seq.length - 2;   // center symbol index
    const endY = -((resultIndex - 1) * SYM_H); // -1 so result is middle of 3 visible
    strip.style.transition = 'none';
    strip.style.transform = `translateY(${SYM_H}px)`;
    void strip.offsetWidth;
    const dur = 1.1 + idx * 0.45;
    strip.style.transition = `transform ${dur}s cubic-bezier(.18,.7,.16,1)`;
    strip.style.transform = `translateY(${endY}px)`;

    // tick sounds while spinning
    const ticks = setInterval(() => Sound.tick(), 90);
    await sleep(dur * 1000 + 60);
    clearInterval(ticks);
  }

  spinBtn.onclick = spin;
  root.appendChild(screen);
  return () => {};
}
