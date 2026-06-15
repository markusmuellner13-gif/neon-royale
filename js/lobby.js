/* ============================================================
   lobby.js — the casino floor: pick a table
   ============================================================ */
import { Bank } from './bank.js';
import { fmt, el, Sound } from './ui.js';

const TABLES = [
  { id: 'roulette',  emoji: '🎡', name: 'Roulette',  tag: 'European', tc: '#1c5f43',
    desc: 'Single-zero wheel. Straight up pays 35:1.' },
  { id: 'blackjack', emoji: '🂡', name: 'Blackjack', tag: '3:2 pays', tc: '#5e2a2a',
    desc: 'Beat the dealer to 21. 6-deck shoe.' },
  { id: 'poker',     emoji: '🃏', name: 'Video Poker', tag: 'Jacks+', tc: '#274a6b',
    desc: 'Jacks or Better. Hold & draw for the Royal.' },
  { id: 'slots',     emoji: '🎰', name: 'Lucky Sevens', tag: 'Slots', tc: '#6b4a1c',
    desc: 'Spin the reels. Triple 7s hit the jackpot.' }
];

export function renderLobby(root, { go, openWallet }) {
  const lobby = el('div', 'lobby');

  const dailyReady = Bank.dailyReady();

  lobby.innerHTML = `
    <div class="lobby-hero">
      <div class="eyebrow">Private Casino Club</div>
      <h1>Neon Royale</h1>
      <p>Take a seat at any table on the floor. The chips are on the house — play your hunch.</p>
      <div class="welcome-pill">🪙 <b style="color:#f7e7a3">${fmt(Bank.balance)}</b> coins in your stack</div>
    </div>
    <div class="section-label">Choose your table</div>
    <div class="tables"></div>
    <div class="lobby-actions"></div>
    <div class="lobby-foot">
      <div>Neon Royale · for entertainment only</div>
      <div class="disclaimer">
        This app is 100% free play. Coins have <b>no real-world value</b>, cannot be purchased,
        cannot be cashed out, and are not gambling. It only simulates the look &amp; feel of a casino.
      </div>
    </div>`;

  const grid = lobby.querySelector('.tables');
  TABLES.forEach((t) => {
    const c = el('button', 'table-card');
    c.style.setProperty('--tc', t.tc);
    c.innerHTML =
      `<span class="tc-tag">${t.tag}</span>` +
      `<div class="tc-emoji">${t.emoji}</div>` +
      `<h3>${t.name}</h3>` +
      `<div class="tc-desc">${t.desc}</div>`;
    c.onclick = () => { Sound.chip(); go(t.id); };
    grid.appendChild(c);
  });

  const actions = lobby.querySelector('.lobby-actions');
  const walletBtn = el('button', 'btn ghost small', '💰 Wallet & Bonus');
  walletBtn.onclick = () => openWallet();
  actions.appendChild(walletBtn);
  if (dailyReady) {
    const bonus = el('button', 'btn primary small', '🎁 Daily bonus ready');
    bonus.onclick = () => openWallet();
    actions.appendChild(bonus);
  }

  root.appendChild(lobby);
  return () => {};
}
