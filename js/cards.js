/* ============================================================
   cards.js — deck, shuffle, rendering, poker evaluation
   ============================================================ */
import { el } from './ui.js';

export const SUITS = [
  { s: '♠', k: 'black' },
  { s: '♥', k: 'red' },
  { s: '♦', k: 'red' },
  { s: '♣', k: 'black' }
];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
// numeric value of a rank for poker (A high = 14)
const RANK_VAL = { A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

export function freshDeck(decks = 1) {
  const cards = [];
  for (let d = 0; d < decks; d++) {
    for (const su of SUITS) {
      for (const r of RANKS) {
        cards.push({ r, s: su.s, k: su.k });
      }
    }
  }
  return cards;
}

export function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Build a DOM element for a card. faceUp=false => back */
export function cardEl(card, faceUp = true, deal = false) {
  if (!faceUp || !card) {
    const b = el('div', 'card back' + (deal ? ' dealing' : ''));
    return b;
  }
  const e = el('div', `card ${card.k}` + (deal ? ' dealing' : ''));
  e.innerHTML =
    `<div class="corner tl">${card.r}<span>${card.s}</span></div>` +
    `<div class="pip">${card.s}</div>` +
    `<div class="corner br">${card.r}<span>${card.s}</span></div>`;
  return e;
}

export const rankVal = (card) => RANK_VAL[card.r];

/* ============================================================
   5-card poker evaluation (for Video Poker)
   returns { rank, name } where higher rank is better
   ============================================================ */
export const HAND = {
  ROYAL: 9, STRAIGHT_FLUSH: 8, FOUR: 7, FULL_HOUSE: 6, FLUSH: 5,
  STRAIGHT: 4, THREE: 3, TWO_PAIR: 2, JACKS: 1, NOTHING: 0
};

export function evalFive(cards) {
  const vals = cards.map(rankVal).sort((a, b) => a - b);
  const suits = cards.map((c) => c.s);
  const flush = suits.every((s) => s === suits[0]);

  // straight (incl. wheel A-2-3-4-5)
  const uniq = [...new Set(vals)];
  let straight = false;
  let highStraight = 0;
  if (uniq.length === 5) {
    if (vals[4] - vals[0] === 4) { straight = true; highStraight = vals[4]; }
    else if (vals.join() === '2,3,4,5,14') { straight = true; highStraight = 5; }
  }

  // counts
  const counts = {};
  vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ v: +v, c }))
    .sort((a, b) => b.c - a.c || b.v - a.v);
  const pattern = groups.map((g) => g.c).join('');

  if (straight && flush && highStraight === 14) return { rank: HAND.ROYAL, name: 'Royal Flush' };
  if (straight && flush) return { rank: HAND.STRAIGHT_FLUSH, name: 'Straight Flush' };
  if (pattern[0] === '4') return { rank: HAND.FOUR, name: 'Four of a Kind' };
  if (pattern === '32') return { rank: HAND.FULL_HOUSE, name: 'Full House' };
  if (flush) return { rank: HAND.FLUSH, name: 'Flush' };
  if (straight) return { rank: HAND.STRAIGHT, name: 'Straight' };
  if (pattern[0] === '3') return { rank: HAND.THREE, name: 'Three of a Kind' };
  if (pattern === '221') return { rank: HAND.TWO_PAIR, name: 'Two Pair' };
  if (pattern[0] === '2') {
    // pair — only pays if Jacks or better
    if (groups[0].v >= 11) return { rank: HAND.JACKS, name: 'Jacks or Better' };
    return { rank: HAND.NOTHING, name: 'Low Pair' };
  }
  return { rank: HAND.NOTHING, name: 'Nothing' };
}
