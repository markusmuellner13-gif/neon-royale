/* ============================================================
   blackjack.js — 6-deck, dealer stands on 17, blackjack pays 3:2
   ============================================================ */
import { Bank } from './bank.js';
import { fmt, el, toast, Sound, sleep, coinBurst } from './ui.js';
import { freshDeck, shuffle, cardEl, rankVal } from './cards.js';

const CHIPS = [
  { v: 10, c1: '#ffffff', c2: '#2b6cff' },
  { v: 25, c1: '#ffffff', c2: '#19a463' },
  { v: 50, c1: '#ffffff', c2: '#c8392b' },
  { v: 100, c1: '#f7e7a3', c2: '#1a1a1a' }
];

function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    let v = rankVal(c);
    if (c.r === 'A') { aces++; v = 11; }
    else if (v > 10) v = 10;
    total += v;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  const soft = aces > 0 && total <= 21;
  return { total, soft };
}
const isBJ = (cards) => cards.length === 2 && handValue(cards).total === 21;

export function mountBlackjack(root, { go }) {
  let shoe = shuffle(freshDeck(6));
  let bet = 0;
  let player = [], dealer = [];
  let state = 'betting'; // betting | player | done
  let doubled = false;

  const screen = el('div', 'game');
  screen.innerHTML = `
    <div class="game-head">
      <div><div class="game-title">Blackjack</div><div class="game-sub">Dealer stands on 17 · Blackjack pays 3:2</div></div>
    </div>
    <div class="felt">
      <div class="felt-arc"></div>
      <div class="felt-brand">BLACKJACK<br><span style="font-size:.5em;letter-spacing:.3em">PAYS 3 TO 2</span></div>
      <div style="position:relative;z-index:2;width:100%;display:flex;flex-direction:column;justify-content:space-between;height:100%;padding:16px 10px">
        <div style="text-align:center">
          <div class="hand-label">Dealer <span id="dTotal"></span></div>
          <div class="hand" id="dealerHand"></div>
        </div>
        <div style="text-align:center">
          <div class="hand" id="playerHand"></div>
          <div class="hand-label" style="margin-top:7px">You <span id="pTotal"></span></div>
        </div>
      </div>
    </div>
    <div class="dock">
      <div class="msg-banner" id="bjMsg">Place your bet to deal</div>
      <div class="stat-strip">
        <span class="pill">Bet <b id="betVal">0</b></span>
        <span class="pill" id="shoePill">Shoe <b id="shoeCt">${shoe.length}</b></span>
      </div>
      <div id="controls"></div>
    </div>`;

  const dealerHand = screen.querySelector('#dealerHand');
  const playerHand = screen.querySelector('#playerHand');
  const dTotal = screen.querySelector('#dTotal');
  const pTotal = screen.querySelector('#pTotal');
  const msg = screen.querySelector('#bjMsg');
  const betVal = screen.querySelector('#betVal');
  const shoeCt = screen.querySelector('#shoeCt');
  const controls = screen.querySelector('#controls');

  const setMsg = (t, cls = '') => { msg.textContent = t; msg.className = 'msg-banner ' + cls; };
  const draw = () => { if (shoe.length < 20) shoe = shuffle(freshDeck(6)); return shoe.pop(); };

  function renderHands(hideHole) {
    dealerHand.innerHTML = '';
    dealer.forEach((c, i) => dealerHand.appendChild(cardEl(c, !(hideHole && i === 1))));
    playerHand.innerHTML = '';
    player.forEach((c) => playerHand.appendChild(cardEl(c, true)));
    pTotal.textContent = player.length ? `· ${handValue(player).total}${handValue(player).soft ? ' (soft)' : ''}` : '';
    dTotal.textContent = dealer.length ? (hideHole ? `· ${valOfUp()}+` : `· ${handValue(dealer).total}`) : '';
    shoeCt.textContent = shoe.length;
  }
  function valOfUp() { let v = rankVal(dealer[0]); if (dealer[0].r === 'A') return 'A'; return v > 10 ? 10 : v; }

  /* ---------------- betting controls ---------------- */
  function renderBetting() {
    state = 'betting';
    controls.innerHTML = '';
    const chips = el('div', 'chips');
    CHIPS.forEach((ch) => {
      const c = el('div', 'chip');
      c.style.setProperty('--c1', ch.c1); c.style.setProperty('--c2', ch.c2);
      c.innerHTML = `<span>${ch.v}</span>`;
      c.onclick = () => {
        if (!Bank.canBet(bet + ch.v)) { toast('Not enough coins', 'bad'); return; }
        bet += ch.v; betVal.textContent = fmt(bet); Sound.chip();
      };
      chips.appendChild(c);
    });
    controls.appendChild(chips);

    const row = el('div', 'row');
    const clear = el('button', 'btn ghost small', 'Clear');
    clear.onclick = () => { bet = 0; betVal.textContent = '0'; Sound.click(); };
    const deal = el('button', 'btn primary', 'Deal ▸');
    deal.onclick = startDeal;
    row.append(clear, deal);
    controls.appendChild(row);
  }

  /* ---------------- deal ---------------- */
  async function startDeal() {
    if (bet < 10) { toast('Minimum bet is 10', 'bad'); return; }
    if (!Bank.wager(bet)) { toast('Not enough coins', 'bad'); return; }
    Bank.bumpSpins();
    doubled = false;
    player = []; dealer = [];
    controls.innerHTML = '';
    setMsg('Dealing…');

    player.push(draw()); renderHands(true); Sound.deal(); await sleep(280);
    dealer.push(draw()); renderHands(true); Sound.deal(); await sleep(280);
    player.push(draw()); renderHands(true); Sound.deal(); await sleep(280);
    dealer.push(draw()); renderHands(true); Sound.deal(); await sleep(200);

    const pBJ = isBJ(player), dBJ = isBJ(dealer);
    if (pBJ || dBJ) return resolveNaturals(pBJ, dBJ);

    state = 'player';
    renderPlayerControls();
    setMsg('Hit, stand or double?');
  }

  function resolveNaturals(pBJ, dBJ) {
    renderHands(false);
    if (pBJ && dBJ) { setMsg('Both Blackjack — push.', 'gold'); Bank.payout(bet); }
    else if (pBJ) {
      const win = Math.floor(bet * 2.5); // stake back + 3:2
      Bank.payout(win); coinBurst(playerHand); Sound.bigwin();
      setMsg(`Blackjack! +${fmt(win - bet)} (3:2)`, 'win');
    } else {
      Sound.lose(); setMsg('Dealer has Blackjack. You lose.', 'lose');
    }
    finishRound();
  }

  /* ---------------- player actions ---------------- */
  function renderPlayerControls() {
    controls.innerHTML = '';
    const row = el('div', 'row');
    const hit = el('button', 'btn', '➕ Hit');
    const stand = el('button', 'btn primary', '✋ Stand');
    hit.onclick = onHit;
    stand.onclick = onStand;
    row.append(hit, stand);

    // double only on first decision & if affordable
    if (player.length === 2 && Bank.canBet(bet)) {
      const dbl = el('button', 'btn ghost', '✕2 Double');
      dbl.onclick = onDouble;
      row.appendChild(dbl);
    }
    controls.appendChild(row);
  }

  async function onHit() {
    if (state !== 'player') return;
    Sound.deal();
    player.push(draw()); renderHands(true);
    const { total } = handValue(player);
    if (total > 21) { setMsg('Bust!', 'lose'); Sound.lose(); state = 'done'; return finishLoss(); }
    if (total === 21) return onStand();
    renderPlayerControls();
  }

  async function onDouble() {
    if (state !== 'player') return;
    if (!Bank.wager(bet)) { toast('Not enough coins', 'bad'); return; }
    bet *= 2; doubled = true; betVal.textContent = fmt(bet);
    Sound.chip();
    controls.innerHTML = '';
    Sound.deal(); player.push(draw()); renderHands(true); await sleep(300);
    const { total } = handValue(player);
    if (total > 21) { setMsg('Bust on double!', 'lose'); Sound.lose(); state = 'done'; return finishLoss(); }
    onStand();
  }

  async function onStand() {
    if (state !== 'player') return;
    state = 'dealer';
    controls.innerHTML = '';
    renderHands(false);
    setMsg('Dealer plays…');
    await sleep(450);
    while (handValue(dealer).total < 17) {
      dealer.push(draw()); renderHands(false); Sound.deal(); await sleep(550);
    }
    settle();
  }

  /* ---------------- settle ---------------- */
  function settle() {
    const p = handValue(player).total;
    const d = handValue(dealer).total;
    if (d > 21) { win(`Dealer busts — you win!`); }
    else if (p > d) { win(`You win ${p} to ${d}!`); }
    else if (p < d) { lose(`Dealer wins ${d} to ${p}.`); }
    else { setMsg(`Push on ${p}.`, 'gold'); Bank.payout(bet); finishRound(); }
  }
  function win(text) {
    const payout = bet * 2;
    Bank.payout(payout); coinBurst(playerHand); Sound.win();
    setMsg(`${text} +${fmt(bet)}`, 'win');
    finishRound();
  }
  function lose(text) { Sound.lose(); setMsg(text, 'lose'); finishRound(); }
  function finishLoss() { renderHands(false); finishRound(); }

  function finishRound() {
    state = 'done';
    const row = el('div', 'row');
    const again = el('button', 'btn primary', '♻️ Same bet');
    again.onclick = () => { betVal.textContent = fmt(bet); startDeal(); };
    if (!Bank.canBet(bet)) again.disabled = true;
    const rebet = el('button', 'btn ghost', 'Change bet');
    rebet.onclick = () => { bet = 0; betVal.textContent = '0'; renderBetting(); };
    row.append(rebet, again);
    controls.innerHTML = '';
    controls.appendChild(row);
  }

  renderBetting();
  root.appendChild(screen);
  return () => {};
}
