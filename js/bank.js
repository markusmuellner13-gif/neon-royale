/* ============================================================
   bank.js — virtual coin wallet (no real money, ever)
   ============================================================ */
const KEY = 'neon-royale-save-v1';
const START_BALANCE = 2500;
const DAILY_BONUS = 1000;
const DAILY_MS = 8 * 60 * 60 * 1000; // 8 hours
const RESCUE = 500;                  // free chips if you go broke

const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

let state = load() || {
  balance: START_BALANCE,
  lastDaily: 0,
  totalWagered: 0,
  biggestWin: 0,
  spins: 0,
  fresh: true
};

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  listeners.forEach((fn) => fn(state.balance));
}

export const Bank = {
  get balance() { return state.balance; },
  get stats() { return { ...state }; },
  isFresh() { return !!state.fresh; },
  clearFresh() { state.fresh = false; persist(); },

  subscribe(fn) { listeners.add(fn); fn(state.balance); return () => listeners.delete(fn); },

  canBet(amount) { return amount > 0 && state.balance >= amount; },

  /** remove a wager from the balance. returns true if successful */
  wager(amount) {
    amount = Math.floor(amount);
    if (amount <= 0 || state.balance < amount) return false;
    state.balance -= amount;
    state.totalWagered += amount;
    persist();
    return true;
  },

  /** pay winnings back to the balance */
  payout(amount) {
    amount = Math.floor(amount);
    if (amount <= 0) return;
    state.balance += amount;
    if (amount > state.biggestWin) state.biggestWin = amount;
    persist();
  },

  /** direct add (bonuses / rescue) */
  add(amount) { state.balance += Math.floor(amount); persist(); },

  bumpSpins() { state.spins++; persist(); },

  /* ----- daily bonus ----- */
  dailyReady() { return Date.now() - state.lastDaily >= DAILY_MS; },
  dailyRemainingMs() { return Math.max(0, DAILY_MS - (Date.now() - state.lastDaily)); },
  claimDaily() {
    if (!this.dailyReady()) return 0;
    state.lastDaily = Date.now();
    state.balance += DAILY_BONUS;
    persist();
    return DAILY_BONUS;
  },

  /* ----- broke rescue ----- */
  needsRescue(minBet) { return state.balance < (minBet || 1); },
  rescue() { state.balance += RESCUE; persist(); return RESCUE; },

  reset() {
    state = { balance: START_BALANCE, lastDaily: 0, totalWagered: 0, biggestWin: 0, spins: 0, fresh: true };
    persist();
  }
};

export const CONFIG = { START_BALANCE, DAILY_BONUS, DAILY_MS, RESCUE };
