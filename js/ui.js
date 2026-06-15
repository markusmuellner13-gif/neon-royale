/* ============================================================
   ui.js — shared helpers: formatting, toasts, modals, sound, dom
   ============================================================ */

export const fmt = (n) => Math.floor(n).toLocaleString('en-US');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const rnd = (n) => Math.floor(Math.random() * n);

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/* ---------- toast ---------- */
const toastHost = () => document.getElementById('toast-host');
export function toast(msg, kind = '') {
  const host = toastHost();
  const t = el('div', `toast ${kind}`, msg);
  host.appendChild(t);
  setTimeout(() => t.remove(), 2300);
}

/* ---------- modal ---------- */
export function modal({ emoji, title, body, actions }) {
  return new Promise((resolve) => {
    const host = el('div', 'modal-host');
    const box = el('div', 'modal');
    box.innerHTML =
      (emoji ? `<div class="modal-emoji">${emoji}</div>` : '') +
      (title ? `<h2>${title}</h2>` : '') +
      (body ? `<p>${body}</p>` : '');
    const row = el('div', 'row');
    (actions || [{ label: 'OK', value: true, primary: true }]).forEach((a) => {
      const b = el('button', `btn ${a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'}`, a.label);
      b.onclick = () => { host.remove(); resolve(a.value); };
      row.appendChild(b);
    });
    box.appendChild(row);
    host.appendChild(box);
    host.addEventListener('click', (e) => { if (e.target === host && actions == null) { host.remove(); resolve(false); } });
    document.body.appendChild(host);
  });
}

/* ---------- coin burst over an element ---------- */
export function coinBurst(target) {
  const r = (target || document.body).getBoundingClientRect();
  for (let i = 0; i < 8; i++) {
    const c = el('div', 'burst', '🪙');
    c.style.left = (r.left + r.width / 2 + (Math.random() * 80 - 40)) + 'px';
    c.style.top = (r.top + r.height / 2) + 'px';
    c.style.animationDelay = (Math.random() * 0.2) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1200);
  }
}

/* ============================================================
   Sound — tiny WebAudio synth, no asset files needed
   ============================================================ */
let actx = null;
let muted = false;
try { muted = localStorage.getItem('nr-muted') === '1'; } catch (_) {}

function ctx() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, dur = 0.12, type = 'sine', gain = 0.08, when = 0) {
  const a = ctx();
  if (!a || muted) return;
  const t = a.currentTime + when;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const Sound = {
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('nr-muted', muted ? '1' : '0'); } catch (_) {} return muted; },
  chip() { tone(660, 0.06, 'triangle', 0.06); },
  click() { tone(420, 0.05, 'square', 0.04); },
  deal() { tone(300, 0.05, 'triangle', 0.05); },
  tick() { tone(900, 0.02, 'square', 0.03); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.09, i * 0.09)); },
  bigwin() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.08, i * 0.1)); },
  lose() { tone(200, 0.25, 'sine', 0.06); tone(150, 0.3, 'sine', 0.05, 0.08); },
  spin() { tone(180, 0.3, 'sawtooth', 0.03); }
};

/* unlock audio on first interaction */
window.addEventListener('pointerdown', () => ctx(), { once: true });
