/* ============================================================
   app.js — boot, router, top bar, wallet panel
   ============================================================ */
import { Bank } from './bank.js';
import { fmt, modal, toast, Sound, sleep } from './ui.js';
import { renderLobby } from './lobby.js';
import { mountRoulette } from './roulette.js';
import { mountBlackjack } from './blackjack.js';
import { mountPoker } from './poker.js';
import { mountSlots } from './slots.js';

const view = document.getElementById('view');
const topbar = document.getElementById('topbar');
const balanceVal = document.getElementById('balanceVal');
const bankBtn = document.getElementById('bankBtn');
const homeBtn = document.getElementById('homeBtn');

let teardown = null; // current screen cleanup fn

const GAMES = {
  roulette: mountRoulette,
  blackjack: mountBlackjack,
  poker: mountPoker,
  slots: mountSlots
};

/* ---------- balance binding ---------- */
let lastBal = Bank.balance;
Bank.subscribe((bal) => {
  balanceVal.textContent = fmt(bal);
  if (bal !== lastBal) {
    bankBtn.classList.remove('flash');
    void bankBtn.offsetWidth;
    bankBtn.classList.add('flash');
    lastBal = bal;
  }
});

/* ---------- router ---------- */
export function go(screen, arg) {
  if (typeof teardown === 'function') { try { teardown(); } catch (_) {} teardown = null; }
  view.innerHTML = '';
  Sound.click();
  if (screen === 'lobby') {
    teardown = renderLobby(view, { go, openWallet });
  } else if (GAMES[screen]) {
    teardown = GAMES[screen](view, { go, openWallet });
  } else {
    teardown = renderLobby(view, { go, openWallet });
  }
  view.scrollTop = 0;
}

homeBtn.onclick = () => go('lobby');
bankBtn.onclick = () => openWallet();

/* ---------- wallet / settings panel ---------- */
async function openWallet() {
  Sound.click();
  const s = Bank.stats;
  const ready = Bank.dailyReady();
  const remain = Bank.dailyRemainingMs();
  const hrs = Math.floor(remain / 3600000);
  const mins = Math.floor((remain % 3600000) / 60000);

  const body =
    `<div style="text-align:left;font-size:13px;line-height:1.9;color:#cfe3d8">` +
    `<div style="display:flex;justify-content:space-between"><span>Balance</span><b style="color:#f7e7a3">🪙 ${fmt(s.balance)}</b></div>` +
    `<div style="display:flex;justify-content:space-between"><span>Total wagered</span><b>${fmt(s.totalWagered)}</b></div>` +
    `<div style="display:flex;justify-content:space-between"><span>Biggest win</span><b style="color:#37d39a">${fmt(s.biggestWin)}</b></div>` +
    `<div style="display:flex;justify-content:space-between"><span>Rounds played</span><b>${fmt(s.spins)}</b></div>` +
    `</div>`;

  const actions = [];
  actions.push(ready
    ? { label: '🎁 Claim 1,000', value: 'daily', primary: true }
    : { label: `Bonus in ${hrs}h ${mins}m`, value: 'wait' });
  actions.push({ label: Sound.muted ? '🔇 Sound off' : '🔊 Sound on', value: 'sound' });
  actions.push({ label: 'Close', value: 'close' });
  actions.push({ label: 'Reset wallet', value: 'reset', danger: true });

  const choice = await modal({ emoji: '💰', title: 'Your Wallet', body, actions });

  if (choice === 'daily') {
    const got = Bank.claimDaily();
    if (got) { Sound.win(); toast(`Daily bonus: +${fmt(got)} coins!`, 'gold'); }
  } else if (choice === 'sound') {
    const m = Sound.toggle();
    toast(m ? 'Sound muted' : 'Sound on');
    if (!m) Sound.chip();
    openWallet();
  } else if (choice === 'reset') {
    const sure = await modal({
      emoji: '⚠️', title: 'Reset everything?',
      body: 'This wipes your coins and stats back to the starting 2,500. This cannot be undone.',
      actions: [{ label: 'Reset', value: true, danger: true }, { label: 'Cancel', value: false }]
    });
    if (sure) { Bank.reset(); toast('Wallet reset to 2,500', 'gold'); }
  }
}

/* ---------- broke watcher (offer rescue chips) ---------- */
Bank.subscribe(async (bal) => {
  if (bal < 10 && document.querySelector('.modal-host') == null) {
    await sleep(400);
    if (Bank.balance >= 10) return;
    const r = await modal({
      emoji: '🆘', title: 'Out of chips!',
      body: 'The house doesn’t want you to leave just yet. Here are some chips on us — good luck!',
      actions: [{ label: `Take +${fmt(500)} free`, value: true, primary: true }]
    });
    if (r) { Bank.rescue(); Sound.win(); toast('+500 rescue chips', 'gold'); }
  }
});

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  const boot = document.getElementById('boot');
  // minimum splash time so it feels intentional + lets fonts/bg load
  const minWait = sleep(1700);
  await minWait;

  topbar.classList.remove('hidden');
  go('lobby');

  // welcome gift message for first-time players
  if (Bank.isFresh()) {
    Bank.clearFresh();
    setTimeout(async () => {
      await modal({
        emoji: '🎩',
        title: 'Welcome to Neon Royale',
        body: `You’ve been staked with <b style="color:#f7e7a3">2,500 free coins</b>. These are play-money chips — they can’t be bought and have no cash value. Pull up a chair and enjoy the floor.`,
        actions: [{ label: 'Let’s play', value: true, primary: true }]
      });
    }, 500);
  }

  boot.classList.add('hide');
  setTimeout(() => boot.remove(), 700);
}

boot();
