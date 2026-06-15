# 🎰 Neon Royale

A luxury **pocket casino** PWA. Roulette, Blackjack, Video Poker and Slots — played entirely with
**virtual coins that have no real-world value** and cannot be bought or cashed out. It only simulates
the *look and feel* of a casino for entertainment.

> ⚠️ **Not gambling.** No real money is involved anywhere in this app. Coins are free play-money,
> cannot be purchased, transferred, or redeemed.

## ✨ Features

- **Casino lobby** — a neon Monte-Carlo floor where you pick a table.
- **Four authentic games**, all with realistic casino odds:
  - **Roulette** — European single-zero wheel. Straight up pays 35:1, even-money 1:1, dozens/columns 2:1. Full betting board.
  - **Blackjack** — 6-deck shoe, dealer stands on 17, Blackjack pays 3:2, with Hit / Stand / Double.
  - **Video Poker** — Jacks or Better (8/5 paytable, ~97% RTP). Hold & draw for the Royal Flush.
  - **Lucky Sevens Slots** — weighted 3-reel machine (~93% RTP) with a 7-7-7 jackpot.
- **Coin wallet** — start with 2,500 coins, an 8-hour **daily bonus** of 1,000, and free **rescue chips** if you go broke. Progress is saved in `localStorage`.
- **Installable PWA** — add to your home screen and play offline (service-worker cached app shell).
- **Fully responsive** — adapts to any phone, tablet or desktop, with safe-area insets for notched devices.
- **Built-in sound** — synthesized with the Web Audio API (no audio files), toggle in the wallet.
- **Loading splash** + custom AI-generated artwork (Higgsfield).

## 🕹️ How to play

1. Open the app — you start with **2,500 free coins**.
2. From the **lobby**, tap a table.
3. Place your bet (chips / bet buttons), then play the round.
4. Tap the **coin balance** (top-right) anytime to open your **Wallet** — claim the daily bonus, toggle sound, or reset.
5. Tap the **home icon** (top-left) to return to the lobby.

## 🧱 Tech

Pure, dependency-free **vanilla JS (ES modules) + CSS** — no build step. Deployed as a static PWA on **Vercel**,
auto-deploying on every push to `main`.

```
index.html            app shell + loading splash
manifest.webmanifest  PWA manifest
sw.js                 service worker (offline cache)
css/styles.css        all styling
js/
  app.js              boot + router + wallet
  lobby.js            casino floor
  bank.js             virtual coin wallet (localStorage)
  ui.js               toasts, modals, sound, helpers
  cards.js            deck + poker hand evaluation
  roulette.js  blackjack.js  poker.js  slots.js
assets/               AI-generated background + icons
```

## 🚀 Local dev

It’s static — serve the folder with any static server:

```bash
npx serve .
# then open the printed URL
```

(Service workers and ES modules require `http(s)://`, not `file://`.)

---

Made for fun. Please gamble responsibly in real life — and remember, here it’s only ever play money. 🃏
