/* ============================================================
   poker.js — Video Poker, "Jacks or Better" (8/5 paytable)
   ============================================================ */
import { Bank } from './bank.js';
import { fmt, el, toast, Sound, sleep, coinBurst, modal } from './ui.js';
import { freshDeck, shuffle, cardEl, evalFive, HAND } from './cards.js';

// payout multiplier of the bet (total returned). 1 = push.
const PAYS = [
  { rank: HAND.ROYAL, name: 'Royal Flush', mult: 250 },
  { rank: HAND.STRAIGHT_FLUSH, name: 'Straight Flush', mult: 50 },
  { rank: HAND.FOUR, name: 'Four of a Kind', mult: 25 },
  { rank: HAND.FULL_HOUSE, name: 'Full House', mult: 8 },
  { rank: HAND.FLUSH, name: 'Flush', mult: 5 },
  { rank: HAND.STRAIGHT, name: 'Straight', mult: 4 },
  { rank: HAND.THREE, name: 'Three of a Kind', mult: 3 },
  { rank: HAND.TWO_PAIR, name: 'Two Pair', mult: 2 },
  { rank: HAND.JACKS, name: 'Jacks or Better', mult: 1 }
];
const multFor = (rank) => (PAYS.find((p) => p.rank === rank) || { mult: 0 }).mult;
const BETS = [10, 25, 50, 100, 250];

export function mountPoker(root, { go }) {
  let deck = [];
  let hand = [];
  let held = [false, false, false, false, false];
  let bet = 50;
  let phase = 'bet'; // bet | draw

  const screen = el('div', 'game');
  screen.innerHTML = `
    <div class="game-head">
      <div><div class="game-title">Video Poker</div><div class="game-sub">Jacks or Better · hold &amp; draw once</div></div>
    </div>
    <div class="felt" style="justify-content:flex-start;padding-top:14px;overflow-y:auto">
      <div class="vp-paytable" id="paytable"></div>
      <div class="vp-table">
        <div class="vp-hand" id="vpHand"></div>
      </div>
    </div>
    <div class="dock">
      <div class="msg-banner" id="vpMsg">Pick a bet, then deal</div>
      <div class="stat-strip">
        <span class="pill">Bet <b id="betVal">${bet}</b></span>
        <span class="pill">Last win <b id="lastWin">0</b></span>
      </div>
      <div class="row" id="betRow"></div>
      <div class="row" id="actionRow"></div>
    </div>`;

  const paytable = screen.querySelector('#paytable');
  const vpHand = screen.querySelector('#vpHand');
  const msg = screen.querySelector('#vpMsg');
  const betVal = screen.querySelector('#betVal');
  const lastWin = screen.querySelector('#lastWin');
  const betRow = screen.querySelector('#betRow');
  const actionRow = screen.querySelector('#actionRow');

  const setMsg = (t, cls = '') => { msg.textContent = t; msg.className = 'msg-banner ' + cls; };

  function renderPaytable(hotRank) {
    paytable.innerHTML = '';
    PAYS.forEach((p) => {
      const r = el('div', 'ptr' + (p.rank === hotRank ? ' hot' : ''));
      r.innerHTML = `<span>${p.name}</span><span>${p.mult === 1 ? 'push' : p.mult + '×'}</span>`;
      paytable.appendChild(r);
    });
  }

  function renderHand(faceUp = true) {
    vpHand.innerHTML = '';
    hand.forEach((card, i) => {
      const wrap = el('div', 'vp-card-wrap');
      wrap.appendChild(cardEl(card, faceUp, true));
      const hb = el('button', 'hold-btn' + (held[i] ? ' held' : ''), held[i] ? 'HELD' : 'HOLD');
      hb.onclick = () => {
        if (phase !== 'draw') return;
        held[i] = !held[i];
        hb.className = 'hold-btn' + (held[i] ? ' held' : '');
        hb.textContent = held[i] ? 'HELD' : 'HOLD';
        Sound.chip();
      };
      if (phase !== 'draw') hb.style.visibility = 'hidden';
      wrap.appendChild(hb);
      vpHand.appendChild(wrap);
    });
  }

  function renderBetRow() {
    betRow.innerHTML = '';
    BETS.forEach((b) => {
      const btn = el('button', 'btn ghost small' + (b === bet ? ' primary' : ''), fmt(b));
      btn.onclick = () => {
        if (phase !== 'bet') return;
        bet = b; betVal.textContent = fmt(b); Sound.chip();
        [...betRow.children].forEach((c, i) => c.className = 'btn ghost small' + (BETS[i] === bet ? ' primary' : ''));
      };
      betRow.appendChild(btn);
    });
  }

  function renderDealBtn() {
    actionRow.innerHTML = '';
    const deal = el('button', 'btn primary', 'Deal ▸');
    deal.onclick = deal_;
    actionRow.appendChild(deal);
  }

  async function deal_() {
    if (!Bank.wager(bet)) { toast('Not enough coins', 'bad'); return; }
    Bank.bumpSpins();
    deck = shuffle(freshDeck(1));
    hand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
    held = [false, false, false, false, false];
    phase = 'draw';
    renderPaytable(); renderHand(true);
    Sound.deal(); await sleep(120); Sound.deal();

    // hint the currently-made hand
    const made = evalFive(hand);
    renderPaytable(made.rank);
    setMsg(made.rank > 0 ? `${made.name} — hold &amp; draw` : 'Choose cards to hold, then draw');

    actionRow.innerHTML = '';
    const draw = el('button', 'btn primary', '🔁 Draw');
    draw.onclick = drawPhase;
    const holdAll = el('button', 'btn ghost small', 'Hold all');
    holdAll.onclick = () => { held = [true, true, true, true, true]; renderHand(true); Sound.chip(); };
    actionRow.append(holdAll, draw);
  }

  async function drawPhase() {
    phase = 'resolving';
    for (let i = 0; i < 5; i++) {
      if (!held[i]) { hand[i] = deck.pop(); }
    }
    renderHand(true);
    Sound.deal(); await sleep(250);

    const result = evalFive(hand);
    const mult = multFor(result.rank);
    renderPaytable(result.rank);
    const payout = mult * bet;

    if (mult >= 2) {
      Bank.payout(payout);
      lastWin.textContent = fmt(payout);
      const big = result.rank >= HAND.FOUR;
      setMsg(`${result.name}! +${fmt(payout - bet)} net`, big ? 'gold' : 'win');
      coinBurst(vpHand);
      big ? Sound.bigwin() : Sound.win();
      if (result.rank === HAND.ROYAL) {
        await sleep(300);
        modal({ emoji: '👑', title: 'ROYAL FLUSH!', body: `The dream hand! You win <b style="color:#f7e7a3">${fmt(payout)}</b> coins.`, actions: [{ label: 'Incredible', value: true, primary: true }] });
      }
    } else if (mult === 1) {
      Bank.payout(payout);
      lastWin.textContent = '0';
      setMsg(`${result.name} — bet returned (push)`, 'gold');
      Sound.chip();
    } else {
      lastWin.textContent = '0';
      setMsg('No paying hand — deal again', 'lose');
      Sound.lose();
    }

    phase = 'bet';
    renderHand(true); // hide hold buttons
    renderDealBtn();
  }

  renderPaytable();
  renderBetRow();
  renderDealBtn();
  // placeholder hand backs
  hand = [null, null, null, null, null];
  renderHand(false);
  root.appendChild(screen);
  return () => {};
}
