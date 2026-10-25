// Input, sound effects, menus and the main loop.
'use strict';

// ------------------------------------------------------------------ keyboard / gamepad (remappable)
const ACTIONS = [['u', 'Up / jump'], ['d', 'Down / crouch'], ['l', 'Left'], ['r', 'Right'], ['L', 'Light (L)'], ['M', 'Medium (M)'], ['H', 'Heavy (H)'],
  ['S', 'Skill (S)'], ['THROW', 'Throw (L+M)'], ['SUPER', 'Super (S+H)'], ['TAUNT', 'Taunt (L+H)'], ['DASH', 'Dash (→→)']];
const DEFAULT_KEYS = [
  { u: ['KeyW'], d: ['KeyS'], l: ['KeyA'], r: ['KeyD'], L: ['KeyF'], M: ['KeyG'], H: ['KeyH'], S: ['KeyT'], THROW: ['KeyR'], SUPER: ['KeyY'], TAUNT: ['KeyE'], DASH: [] },
  { u: ['ArrowUp'], d: ['ArrowDown'], l: ['ArrowLeft'], r: ['ArrowRight'], L: ['KeyJ', 'Numpad1'], M: ['KeyK', 'Numpad2'], H: ['KeyL', 'Numpad3'], S: ['KeyI', 'Numpad5', 'Numpad0'], THROW: ['KeyU', 'Numpad4'], SUPER: ['KeyO', 'Numpad6'], TAUNT: ['KeyP', 'Numpad7'], DASH: [] },
];
// gamepad buttons (standard layout). Directions are always d-pad + left stick.
const DEFAULT_PAD = { u: [12], d: [13], l: [14], r: [15], L: [2], M: [3], H: [1], S: [0], THROW: [4], SUPER: [5], TAUNT: [8], DASH: [] };   // the dash button is unbound until you set it
let KEYMAP, PADMAP;
function resetControls(save = true) {
  KEYMAP = JSON.parse(JSON.stringify(DEFAULT_KEYS)); PADMAP = JSON.parse(JSON.stringify(DEFAULT_PAD));
  if (save) saveControls();
}
function saveControls() { try { localStorage.setItem('umavs.controls', JSON.stringify({ v: 1, keys: KEYMAP, pad: PADMAP })); } catch (e) { } }
function loadControls() {
  resetControls(false);
  try {
    const st = JSON.parse(localStorage.getItem('umavs.controls') || 'null');
    if (st && st.v === 1) for (const [a] of ACTIONS) {
      for (const i of [0, 1]) if (st.keys && st.keys[i] && Array.isArray(st.keys[i][a])) KEYMAP[i][a] = st.keys[i][a];
      if (st.pad && Array.isArray(st.pad[a])) PADMAP[a] = st.pad[a];
    }
  } catch (e) { }
}
loadControls();
const KEYNAMES = { Space: 'Space', Enter: 'Enter', Backspace: 'Bksp', Tab: 'Tab', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
  AltLeft: 'L-Alt', AltRight: 'R-Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`' };
const keyName = c => KEYNAMES[c] || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num');
const PADNAMES = ['A / ✕', 'B / ○', 'X / □', 'Y / △', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L-Stick', 'R-Stick', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];

const keys = new Set();
const keyEdges = [];
for (const ev of ['pointerdown', 'touchend', 'mousedown']) addEventListener(ev, () => { Sfx.unlock(); Music.unlock(); });
function socialAt(e) {   // which title-screen link button is under the pointer, or -1
  if (UI.screen !== 'title' || typeof socialRects !== 'function') return -1;
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * HGT / r.height;
  return socialRects().findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}
cv.addEventListener('click', e => { const i = socialAt(e); if (i >= 0) openSocial(i); });
cv.addEventListener('pointermove', e => { const i = socialAt(e); UI.socialHover = i; cv.style.cursor = i >= 0 ? 'pointer' : ''; });
addEventListener('keydown', e => {
  Sfx.unlock(); Music.unlock();
  if (UI.ctl && UI.ctl.wait && UI.ctl.wait.kind === 'key') {   // capturing a new binding
    e.preventDefault();
    if (e.code !== 'Escape') bindKey(UI.ctl.wait.player, UI.ctl.wait.action, e.code);
    UI.ctl.wait = null; UI.ctl.cool = 12; return;
  }
  if (!keys.has(e.code)) keyEdges.push(e.code);
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function bindKey(player, action, code) {
  for (const i of [0, 1]) for (const [a] of ACTIONS) KEYMAP[i][a] = KEYMAP[i][a].filter(c => c !== code);   // one key, one job
  KEYMAP[player][action] = [code]; saveControls(); Sfx.play('ok');
}
function bindPad(action, btn) {
  for (const [a] of ACTIONS) PADMAP[a] = PADMAP[a].filter(b => b !== btn);
  PADMAP[action] = [btn]; saveControls(); Sfx.play('ok');
}

function kbInput(i, edges) {
  const m = KEYMAP[i], o = {}, on = c => keys.has(c) || edges.includes(c);
  for (const k of ['u', 'd', 'l', 'r', 'L', 'M', 'H', 'S']) o[k] = m[k].some(on) ? 1 : 0;
  if (m.THROW.some(on)) o.L = o.M = 1;
  if (m.SUPER.some(on)) o.S = o.H = 1;
  if (m.TAUNT.some(on)) o.L = o.H = 1;
  o.DASH = (m.DASH || []).some(on) ? 1 : 0;
  return o;
}
let padPrevStart = [false, false];
// Some embeds (sandboxed iframes, previews) block the Gamepad API and throw a
// SecurityError. Try once; if it's blocked, fall back to keyboard-only.
let padsAllowed = !!navigator.getGamepads;
function rawPads() {
  if (!padsAllowed) return [];
  try { return [...navigator.getGamepads()].filter(Boolean); }
  catch (e) { padsAllowed = false; console.warn('Gamepads unavailable here, keyboard only:', e.message); return []; }
}
// D-pads that browsers report as one "hat" axis instead of four buttons (non-standard layouts: the Switch Pro
// Controller in some browsers, many DirectInput pads). Returns [up, down, left, right] or null.
const HAT_DIRS = [[1, 0, 0, 0], [1, 0, 0, 1], [0, 0, 0, 1], [0, 1, 0, 1], [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0], [1, 0, 1, 0]];
function hatDir(gp) {
  if (gp.mapping === 'standard' || gp.axes.length < 10) return null;
  const v = gp.axes[9]; if (typeof v !== 'number' || Math.abs(v) > 1.05) return null;   // above 1 = centred
  const f = (v + 1) * 3.5, k = Math.round(f);
  return Math.abs(f - k) < 0.2 && k >= 0 && k < 8 ? HAT_DIRS[k] : null;
}
function padTouched(gp) { return gp.buttons.some(b => b.pressed) || Math.abs(gp.axes[0] || 0) > 0.5 || Math.abs(gp.axes[1] || 0) > 0.5 || !!hatDir(gp); }
// Players get controllers in the order they're first USED, not the browser's slot order: a virtual or phantom
// device (Steam Input, DS4Windows, some headsets and wheels) sitting in slot 1 no longer steals Player 1.
const PAD_ORDER = [];
function getPads() {
  const pads = rawPads(), idx = pads.map(g => g.index);
  for (let k = PAD_ORDER.length - 1; k >= 0; k--) if (!idx.includes(PAD_ORDER[k])) PAD_ORDER.splice(k, 1);   // unplugged
  for (const g of pads) if (!PAD_ORDER.includes(g.index) && padTouched(g)) PAD_ORDER.push(g.index);
  return [...PAD_ORDER.map(i => pads.find(g => g.index === i)), ...pads.filter(g => !PAD_ORDER.includes(g.index))];
}
function padInput(i) {
  const pads = getPads();
  const gp = pads[i]; const o = { ...NEUTRAL }; if (!gp) return { o, start: false };
  const b = k => gp.buttons[k] && gp.buttons[k].pressed;
  const on = a => PADMAP[a].some(b);
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  const hat = hatDir(gp) || [0, 0, 0, 0];
  o.l = on('l') || ax < -0.5 || hat[2] ? 1 : 0; o.r = on('r') || ax > 0.5 || hat[3] ? 1 : 0;
  o.u = on('u') || ay < -0.5 || hat[0] ? 1 : 0; o.d = on('d') || ay > 0.5 || hat[1] ? 1 : 0;
  for (const k of ['L', 'M', 'H', 'S']) o[k] = on(k) ? 1 : 0;
  if (on('THROW')) o.L = o.M = 1;
  if (on('SUPER')) o.S = o.H = 1;
  if (on('TAUNT')) o.L = o.H = 1;
  o.DASH = (PADMAP.DASH || []).some(b) ? 1 : 0;
  return { o, start: b(9), any: gp.buttons.some(x => x.pressed) };
}
const orIn = (a, b) => { const o = {}; for (const k in NEUTRAL) o[k] = a[k] || b[k] ? 1 : 0; return o; };

// Dash button: a macro that types →→ for you (← + Dash types ←←), so the game, replays and online only ever
// see ordinary directions. Buttons pressed while it plays come out with the second tap: a dash attack.
const DM = [{ q: [], held: false }, { q: [], held: false }];
function dashFighter(i) {
  if (UI.screen !== 'game' || UI.paused || !G.p.length) return null;
  if (G.mode === 'online') return i === 0 ? G.p[Net.side] : null;
  if (G.mode === 'versus' || (G.mode === 'training' && G.training.dummy === 'player 2')) return G.p[i];
  return G.p[0];
}
function applyDash(raw) {
  for (const i of [0, 1]) {
    const o = raw[i], M = DM[i], dash = !!o.DASH, p = dashFighter(i);
    delete o.DASH;
    if (!p) { M.q = []; M.held = dash; continue; }
    const fwd = p.facing === 1 ? 'r' : 'l', back = fwd === 'r' ? 'l' : 'r';
    // a new press only (holding Dash never repeats it). If that direction is already held (walking), let go of it
    // for a frame first, so the game sees a clean double tap
    if (dash && !M.held && !M.q.length) { M.dir = o[back] ? back : fwd; M.q = o[M.dir] ? [0, 1, 0, 1] : [1, 0, 1]; M.btn = {}; }
    M.held = dash;
    if (M.q.length) {
      const on = M.q.shift();
      o.l = o.r = 0; if (on) o[M.dir] = 1;
      for (const b of ['L', 'M', 'H', 'S']) { if (o[b]) M.btn[b] = 1; o[b] = M.q.length ? 0 : (M.btn[b] || 0); }
    } else if (dash && M.dir === fwd) o[fwd] = 1;   // keep running while it's held
  }
}

// ------------------------------------------------------------------ CPU

// ------------------------------------------------------------------ audio (tiny synth)
const Sfx = {
  ac: null, vol: 0.5, muted: false,
  unlock() { if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (this.ac && this.ac.state === 'suspended') this.ac.resume(); },
  noise(dur, f0, f1, gain, type = 'bandpass', delay = 0) {
    const ac = this.ac, n = ac.createBufferSource(), len = Math.floor(ac.sampleRate * dur), t0 = ac.currentTime + delay;
    let buf = (this.nbuf || (this.nbuf = {}))[len];
    if (!buf) { buf = this.nbuf[len] = ac.createBuffer(1, len, ac.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); }
    n.buffer = buf; const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ac.createGain(); g.gain.value = gain * this.vol; n.connect(f).connect(g).connect(ac.destination); n.start(t0);
  },
  tone(f0, f1, dur, gain, type = 'square', delay = 0) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain * this.vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
  },
  play(name) {
    if (!this.ac || this.muted) return;
    switch (name) {
      case 'hit': this.noise(0.08, 2400, 600, 0.6); this.tone(180, 60, 0.08, 0.3, 'sine'); break;
      case 'heavy': this.noise(0.18, 1800, 200, 0.9); this.tone(120, 40, 0.2, 0.6, 'sine'); break;
      case 'block': this.noise(0.05, 5000, 3000, 0.4, 'highpass'); this.tone(900, 700, 0.05, 0.15); break;
      case 'armor': this.tone(500, 300, 0.15, 0.2, 'triangle'); this.noise(0.1, 3000, 1000, 0.4); break;
      case 'whoosh': this.noise(0.15, 600, 2500, 0.35); break;
      case 'wind': this.noise(0.3, 400, 3000, 0.35); break;
      case 'thud': this.tone(90, 40, 0.15, 0.4, 'sine'); this.noise(0.1, 400, 100, 0.3, 'lowpass'); break;
      case 'grab': this.tone(300, 200, 0.08, 0.2); break;
      case 'power': [0, .08, .16].forEach((d, i) => this.tone(440 * (1 + i * .25), 660 * (1 + i * .25), 0.12, 0.15, 'square', d)); break;
      case 'super': this.tone(200, 1600, 0.5, 0.2, 'sawtooth'); this.noise(0.5, 300, 4000, 0.3); break;
      case 'ko': this.tone(300, 50, 0.8, 0.3, 'sawtooth'); this.noise(0.6, 2000, 100, 0.8); break;
      case 'round': this.tone(660, 660, 0.12, 0.2); this.tone(880, 880, 0.2, 0.2, 'square', 0.13); break;
      case 'go': this.tone(523, 1046, 0.35, 0.25); break;
      case 'menu': case 'move': this.tone(1400, 1650, 0.03, 0.06, 'triangle'); break;
      case 'ok': this.tone(880, 880, 0.05, 0.1); this.tone(1320, 1320, 0.09, 0.1, 'square', 0.05); break;
      case 'back': this.tone(760, 420, 0.09, 0.09, 'triangle'); break;
      case 'deny': this.tone(220, 180, 0.1, 0.12); this.tone(207, 170, 0.12, 0.12, 'square', 0.07); break;
      case 'page': this.tone(1000, 1350, 0.05, 0.07, 'triangle'); this.noise(0.05, 4000, 2000, 0.12, 'highpass'); break;
      case 'stamp': this.noise(0.08, 900, 200, 0.7, 'lowpass'); this.tone(170, 60, 0.14, 0.45, 'sine'); this.tone(1200, 900, 0.04, 0.06, 'square', 0.02); break;
      case 'vs': this.noise(0.45, 300, 3200, 0.45); this.tone(110, 55, 0.6, 0.35, 'sawtooth', 0.12); this.noise(0.3, 2500, 400, 0.5, 'bandpass', 0.12); break;
      case 'bell': [0, 0.28].forEach(d => { this.tone(1568, 1560, 0.5, 0.12, 'sine', d); this.tone(2352, 2340, 0.35, 0.06, 'sine', d); this.tone(3136, 3120, 0.2, 0.04, 'sine', d); }); break;
      case 'ready': this.tone(520, 520, 0.06, 0.1, 'square'); break;
      case 'gate': this.noise(0.25, 3200, 500, 0.8); this.tone(330, 290, 0.3, 0.25, 'square'); this.tone(165, 140, 0.4, 0.3, 'sawtooth'); this.noise(1.3, 700, 1100, 0.22, 'bandpass', 0.05); break;
      case 'crowd': this.noise(1.6, 650, 950, 0.32, 'bandpass'); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, i === 3 ? 0.45 : 0.12, 0.13, 'square', i * 0.09)); this.tone(523, 523, 0.5, 0.08, 'triangle', 0.27); break;
    }
  },
};

// ------------------------------------------------------------------ menus
const UI = { screen: 'title', modeIdx: 0, sel: [0, 1], pal: [0, 0], selDone: [false, false], pauseIdx: 0, paused: false, movesChar: 0, t: 0, back: 'mode' };
const MODES = [['ARCADE', 'arcade', 'Eight races against the CPU, a rival at the end, and an ending for every runner'], ['VERSUS', 'versus', 'Two players, one keyboard or two gamepads'], ['ONLINE', 'online', 'Play a friend over the internet with a room code'], ['VS CPU', 'cpu', 'Fight the computer'], ['TRAINING', 'training', 'Hitboxes, frame advantage, dummy settings'], ['TUTORIAL', 'tutorial', 'Learn the basics step by step, from walking to supers'], ['REPLAYS', 'replays', 'Watch your recent matches or load a replay file'], ['COMBO TRIALS', 'trials', 'Learn each runner\'s combos, with demos'], ['MOVE LIST', 'moves', 'Every move for every runner'], ['CONTROLS', 'controls', 'Keyboard and gamepad layout'], ['OPTIONS', 'sound', 'Volume and display settings'], ['ACCOUNT', 'account', 'Sign in to save your settings and track online matches']];
const ROSTER = ['spe', 'suz', 'gs', 'vo', 'ds', 'mm', 'tt', 'kb', 'jp', 'at', 'mc', 'df'];
let cpuLevel = 2;

let prevMenu = [{ ...NEUTRAL }, { ...NEUTRAL }];
const BTN_LATCH = [{}, {}];
function menuEdges(i, cur) {
  const p = prevMenu[i], e = {};
  for (const k in NEUTRAL) e[k] = cur[k] && !p[k];
  prevMenu[i] = cur; return e;
}

function tick() {
  UI.t++;
  musicDirector();
  acctTick();
  socialTick();
  netPump();
  const pad = [padInput(0), padInput(1)];
  // gamepad presses aren't DOM events, so sound effects never got switched on by them. Retry now and then, and on
  // any pad press, until the browser lets the audio start (music already retries the same way).
  if ((!Sfx.ac || Sfx.ac.state !== 'running') && (UI.t % 30 === 0 || [0, 1].some(i => pad[i].any))) Sfx.unlock();
  const edges = keyEdges.splice(0);
  if (edges.includes('F3')) { PERF.on = !PERF.on; try { localStorage.setItem('umavs.fps', PERF.on ? '1' : ''); } catch (e) { } }
  const kb = [kbInput(0, edges), kbInput(1, edges)];
  const raw = [orIn(kb[0], pad[0].o), orIn(kb[1], pad[1].o)];
  raw.forEach((o, i) => { o.DASH = kb[i].DASH || pad[i].o.DASH; });
  applyDash(raw);
  const startPressed = [0, 1].some(i => pad[i].start && !padPrevStart[i]);
  padPrevStart = [pad[0].start, pad[1].start];
  const esc = edges.includes('Escape') || startPressed;
  const enter = edges.includes('Enter') || edges.includes('Space');
  const me = [menuEdges(0, raw[0]), menuEdges(1, raw[1])];
  const conf = i => me[i].L || me[i].S;
  const back = i => me[i].H;
  const anyConf = conf(0) || conf(1) || enter;
  // A button still held from a menu (confirm, unpause, rematch) shouldn't count as a press once the
  // match is live, or gamepad A (Skill) fires a skill on the first frame. Ignore it until it's released.
  const live = UI.screen === 'game' && !UI.paused && G.phase !== 'match' && !(G.mode === 'online' && Net.menu);
  for (const i of [0, 1]) for (const k of ['L', 'M', 'H', 'S']) {
    if (!raw[i][k]) BTN_LATCH[i][k] = false;
    else if (!live) BTN_LATCH[i][k] = true;
    else if (BTN_LATCH[i][k]) raw[i][k] = 0;
  }

  if (UI.screen === 'title') {
    // down reaches the social links row along the bottom; confirm there opens the link instead of starting
    const e = orEdges(me[0], me[1]), n = SOCIALS.length;
    if (UI.titleIdx === undefined) UI.titleIdx = -1;
    if (UI.titleIdx < 0) {
      if (e.d) { UI.titleIdx = 0; Sfx.play('menu'); return; }
      if (anyConf || esc) { UI.screen = 'mode'; Sfx.play('ok'); }
    } else {
      if (e.l || e.r) { UI.titleIdx = (UI.titleIdx + (e.r ? 1 : n - 1)) % n; Sfx.play('menu'); }
      if (e.u || esc || back(0) || back(1)) { UI.titleIdx = -1; Sfx.play('back'); }
      else if (anyConf) openSocial(UI.titleIdx);
    }
    return;
  }
  if (UI.screen === 'mode') {
    const up = me[0].u || me[1].u, dn = me[0].d || me[1].d, lf = me[0].l || me[1].l, rt = me[0].r || me[1].r, N = MODES.length;
    if (UI.modeIdx < MODE_LIST) {   // the big list; down off the end goes to the stage bar
      if (up) { UI.modeIdx = UI.modeIdx === 0 ? (UI.barIdx || MODE_LIST) : UI.modeIdx - 1; Sfx.play('menu'); }
      else if (dn) { UI.modeIdx = UI.modeIdx === MODE_LIST - 1 ? (UI.barIdx || MODE_LIST) : UI.modeIdx + 1; Sfx.play('menu'); }
    } else {   // the stage bar: left/right along it, up/down back to the list
      if (lf || rt) { UI.modeIdx = MODE_LIST + (UI.modeIdx - MODE_LIST + (rt ? 1 : N - MODE_LIST - 1)) % (N - MODE_LIST); UI.barIdx = UI.modeIdx; Sfx.play('menu'); }
      else if (up) { UI.barIdx = UI.modeIdx; UI.modeIdx = MODE_LIST - 1; Sfx.play('menu'); }
      else if (dn) { UI.barIdx = UI.modeIdx; UI.modeIdx = 0; Sfx.play('menu'); }
    }
    if (MODES[UI.modeIdx][1] === 'cpu' && (me[0].l || me[0].r || me[1].l || me[1].r)) { const r = me[0].r || me[1].r; cpuLevel = 1 + (cpuLevel - 1 + (r ? 1 : 3)) % 4; Sfx.play('menu'); }
    if (anyConf) {
      Sfx.play('ok');
      const m = MODES[UI.modeIdx][1];
      if (m === 'moves') { UI.screen = 'moves'; UI.back = 'mode'; }
      else if (m === 'replays') { UI.screen = 'replays'; RM.idx = 0; }
      else if (m === 'online') { UI.screen = 'online'; showNetPanel(); setStatus(Net.status || ''); }
      else if (m === 'controls') { UI.screen = 'controls'; UI.back = 'mode'; }
      else if (m === 'sound') { UI.screen = 'sound'; UI.soundIdx = 0; MD.jukebox = 'menu'; }
      else if (m === 'trials') { UI.screen = 'trials'; }
      else if (m === 'account') { acctOpen(); }
      else if (m === 'tutorial') { let li = 0; while (li < LESSONS.length - 1 && tutDone.includes(li)) li++; tutStart(tutDone.length >= LESSONS.length ? 0 : li); }
      else if (m === 'arcade') { arcOpen(); }
      else { UI.pendingMode = m; UI.screen = 'select'; UI.selDone = [false, false]; UI.sel = lastPicks(m); }
    }
    if (esc || back(0)) { UI.screen = 'title'; Sfx.play('back'); }
    return;
  }
  if (UI.screen === 'online') {
    netPanelPad(padEdges(pad));
    if (esc) { netClose(false); hideNetPanel(); UI.screen = 'mode'; Sfx.play('back'); }
    return;
  }
  if (UI.screen === 'spectate') { specTick(esc); return; }
  if (UI.screen === 'friends') { friendsTick(orEdges(me[0], me[1]), enter, esc); return; }
  if (UI.screen === 'leaders') { leadersTick(orEdges(me[0], me[1]), enter, esc); return; }
  if (UI.screen === 'account') { acctScreenTick(orEdges(me[0], me[1]), enter, esc); return; }
  if (UI.screen === 'replays') { replaysMenuTick(orEdges(me[0], me[1]), enter, esc, edges); return; }
  if (UI.screen === 'repwarn') { repWarnTick(orEdges(me[0], me[1]), enter, esc); return; }
  if (UI.screen === 'replay') { replayTick(orEdges(me[0], me[1]), edges, esc); return; }
  if (UI.screen === 'netselect') { netSelectTick(orEdges(me[0], me[1]), enter, esc); return; }
  if (UI.screen === 'controls') { controlsTick(edges, esc, enter, orEdges(me[0], me[1])); return; }
  if (UI.screen === 'moves') {
    if (me[0].l || me[0].r || me[1].l || me[1].r) { UI.movesChar = (UI.movesChar + ((me[0].r || me[1].r) ? 1 : ROSTER.length - 1)) % ROSTER.length; Sfx.play('menu'); }
    if (me[0].u || me[0].d || me[1].u || me[1].d) { UI.movesPage = UI.movesPage ? 0 : 1; Sfx.play('menu'); }
    if (esc || back(0) || back(1) || anyConf) { UI.screen = UI.back; Sfx.play('back'); }
    return;
  }
  if (['arcladder', 'arcvs', 'arcwin', 'arccont', 'arcover', 'arcend', 'arcdone'].includes(UI.screen)) { arcScreenTick(orEdges(me[0], me[1]), anyConf, esc); return; }
  if (UI.screen === 'select') {
    const twoP = UI.pendingMode === 'versus', arcade = UI.pendingMode === 'arcade';
    // "leave character select?" prompt: Stay is the default, so mashing confirm can't drop you out
    if (UI.selExit) {
      const e = orEdges(me[0], me[1]);
      if (e.l || e.r || e.u || e.d) { UI.selExitIdx = 1 - UI.selExitIdx; Sfx.play('menu'); }
      if (e.L || e.S || enter) {
        UI.selExit = false;
        if (UI.selExitIdx === 1) { UI.screen = 'mode'; Sfx.play('back'); } else Sfx.play('ok');
      } else if (e.H || esc) { UI.selExit = false; Sfx.play('back'); }
      return;
    }
    const askExit = () => { UI.selExit = true; UI.selExitIdx = 0; Sfx.play('menu'); };
    for (let i = 0; i < 2; i++) {
      // in 1P modes, P1 (or anyone) picks both sides in order
      const ctrl = twoP ? i : (UI.selDone[0] ? 1 : 0);
      const src = twoP ? me[i] : orEdges(me[0], me[1]);
      if (!twoP && i === 1) break;
      if (arcade && ctrl === 1) break;   // Arcade: only your runner
      if (UI.selDone[ctrl]) { if (src.H) { UI.selDone[ctrl] = false; Sfx.play('back'); } continue; }
      if (src.l || src.r) { const n = ROSTER.length + 1; UI.sel[ctrl] = (UI.sel[ctrl] + (src.r ? 1 : n - 1)) % n; Sfx.play('menu'); }
      if (src.u || src.d) { UI.pal[ctrl] = (UI.pal[ctrl] + (src.d ? 1 : PALETTE_COUNT - 1)) % PALETTE_COUNT; Sfx.play('menu'); }
      if (src.L || src.S || (enter && (twoP ? i === 0 : true))) {
        rememberPick(ctrl, UI.sel[ctrl]);
        if (UI.sel[ctrl] === ROSTER.length) { UI.sel[ctrl] = Math.floor(Math.random() * ROSTER.length); toast(`Random pick: ${nameOf(ROSTER[UI.sel[ctrl]])}`); }
        UI.selDone[ctrl] = true; Sfx.play('stamp');
      }
      if (src.H && !twoP && ctrl === 1) { UI.selDone[0] = false; Sfx.play('back'); }
      else if (src.H) { askExit(); return; }   // nothing left to undo: back means leaving
    }
    if (twoP && enter) { /* enter confirms P1 only, handled above */ }
    if (esc) { askExit(); return; }
    if (arcade && UI.selDone[0]) { arcBegin(ROSTER[UI.sel[0]], UI.pal[0]); return; }
    if (UI.selDone[0] && UI.selDone[1]) { UI.screen = 'stage'; UI.stageIdx = UI.stageIdx ?? 0; UI.stageT = 0; Sfx.play('ok'); }
    return;
  }
  if (UI.screen === 'stage') {
    const e = orEdges(me[0], me[1]), n = STAGE_LIST.length + 1;
    UI.stageT++;
    if (e.l || e.r) { UI.stageIdx = (UI.stageIdx + (e.r ? 1 : n - 1)) % n; Sfx.play('menu'); }
    if ((e.L || e.S || enter) && UI.stageT > 4) {
      UI.vsStage = UI.stageIdx === STAGE_LIST.length ? Math.floor(Math.random() * STAGE_LIST.length) : UI.stageIdx;
      Sfx.play('ok');
      UI.screen = 'music'; UI.musicIdx = Math.max(0, THEME_IDS.indexOf(ROSTER[UI.sel[0]])); UI.musicT = 0;
    }
    if (esc || e.H) { UI.screen = 'select'; if (UI.pendingMode === 'versus') UI.selDone = [false, false]; else UI.selDone[1] = false; Sfx.play('back'); }
    return;
  }
  if (UI.screen === 'music') {
    const e = UI.pendingMode === 'versus' ? me[0] : orEdges(me[0], me[1]), n = THEME_IDS.length;   // P1 picks the battle theme
    UI.musicT++;
    if (e.l || e.r) { UI.musicIdx = (UI.musicIdx + (e.r ? 1 : n - 1)) % n; Sfx.play('menu'); }
    if ((e.L || e.S || enter) && UI.musicT > 4) { Sfx.play('ok'); if (UI.pendingMode === 'training') beginLocalMatch(); else { UI.screen = 'vs'; UI.vsT = 0; Sfx.play('vs'); } }
    if (esc || e.H) { UI.screen = 'stage'; UI.stageT = 0; Sfx.play('back'); }
    return;
  }
  if (UI.screen === 'sound') {
    const e = orEdges(me[0], me[1]), rows = SOUND_ROWS(), r = rows[UI.soundIdx];
    if (e.u) { UI.soundIdx = (UI.soundIdx + rows.length - 1) % rows.length; Sfx.play('menu'); }
    if (e.d) { UI.soundIdx = (UI.soundIdx + 1) % rows.length; Sfx.play('menu'); }
    if ((e.l || e.r) && (r.k === 'music' || r.k === 'sfx')) {
      const d = e.r ? 0.1 : -0.1;
      if (r.k === 'music') Music.vol = Math.round(Math.max(0, Math.min(1, Music.vol + d)) * 10) / 10; else { Sfx.vol = Math.round(Math.max(0, Math.min(1, Sfx.vol + d)) * 10) / 10; Sfx.play('hit'); }
      Music.save();
    }
    if ((e.l || e.r || e.L || e.S || enter) && r.k === 'calm') { SET.calm = !SET.calm; saveSet(); Sfx.play('menu'); }
    if ((e.l || e.r || e.L || e.S || enter) && r.k === 'gfx') { cycleGfx(e.l ? -1 : 1); Sfx.play('menu'); }
    if ((e.L || e.S || enter) && r.k === 'full') { toggleFullscreen(); Sfx.play('menu'); }
    if (e.L || e.S || enter) {
      if (r.k === 'back') { UI.screen = 'mode'; Sfx.play('back'); }
    }
    if (esc || e.H) { UI.screen = 'mode'; Sfx.play('back'); }
    return;
  }
  if (UI.screen === 'trials') {
    const e = orEdges(me[0], me[1]), n = trialsFor(ROSTER[TM.char]).length;
    if (e.l || e.r) { TM.char = (TM.char + (e.r ? 1 : ROSTER.length - 1)) % ROSTER.length; TM.idx = 0; Sfx.play('move'); }
    if (e.u || e.d) { TM.idx = (TM.idx + (e.d ? 1 : n - 1)) % n; Sfx.play('move'); }
    if (e.L || e.S || enter) {
      Sfx.play('ok'); UI.pendingMode = 'training'; UI.sel = [TM.char, 0]; UI.vsStage = menuStage; UI.musicIdx = TM.char;
      beginLocalMatch(); trialStart(ROSTER[TM.char], TM.idx);
    }
    if (esc || e.H) { UI.screen = 'mode'; Sfx.play('back'); }
    return;
  }
  if (UI.screen === 'vs') {
    UI.vsT++;
    if (UI.vsT > 130 || (UI.vsT > 18 && (anyConf || esc))) beginLocalMatch();
    return;
  }
  if (UI.screen === 'game' && G.mode === 'online') {
    if (Net.menu) {
      if (conf(0) || conf(1) || enter) { netSend({ t: 'bye' }); netClose(false); UI.screen = 'online'; showNetPanel(); setStatus('You left the match.'); return; }
      if (esc || back(0) || back(1)) Net.menu = false;
    } else if (esc) Net.menu = true;
    if (netMatchConfirmedOver()) {   // results screen; keep resending inputs so the other side can finish too
      if (!Net.recDone) { Net.recDone = true; recFinishOnline(); }
      if (edges.includes('KeyD')) downloadReplay(lastReplay);
      if (edges.includes('KeyR')) { netSend({ t: 'lobby', pick: Net.myPick, ready: false, start: null }); UI.screen = 'netselect'; playReplay(lastReplay); return; }
      sendInputs(); if (Net.specs.length) specFeed(); G.phaseT++;
      if (G.phaseT > 60 && (anyConf || esc)) { UI.screen = 'netselect'; Net.menu = false; }
      return;
    }
    netGameTick(orIn(raw[0], raw[1]));
    return;
  }
  if (UI.screen === 'game') {
    if (UI.paused) { pauseMenu(me, esc, enter, conf, back); return; }
    if (esc) { UI.paused = true; UI.pauseIdx = 0; Sfx.play('page'); return; }
    if (G.mode === 'training') {
      if (edges.includes('Digit1')) cycle('dummy'); if (edges.includes('Digit2')) cycle('block');
      if (edges.includes('Digit3')) G.showBoxes = !G.showBoxes;
      if (edges.includes('Digit4') || edges.includes('Backspace')) { if (TR.on) trialReset(); else resetTraining(); }
      if (edges.includes('Digit5')) { TOOLS.inputs = !TOOLS.inputs; Sfx.play('move'); }
      if (edges.includes('Digit6')) { TOOLS.meter = !TOOLS.meter; Sfx.play('move'); }
      if (edges.includes('Digit7') && !TR.on) recToggle();
      if (edges.includes('Digit8') && !TR.on) playToggle();
      if (TR.on && edges.includes('Digit9')) { demoStart(); Sfx.play('ok'); }
      if (TR.on && edges.includes('Digit0')) { trialStart(TR.cid, TR.idx + 1); Sfx.play('move'); }
    }
    if (edges.includes('Backquote')) G.showBoxes = !G.showBoxes;
    if (ARC.on && arcGameTick()) return;
    if (G.phase === 'match') {
      recFinish();
      if (edges.includes('KeyD')) downloadReplay(lastReplay);
      if (edges.includes('KeyR') && lastReplay) { playReplay(lastReplay); return; }
      G.phaseT++;
      if (G.phaseT > 60) {
        const e = orEdges(me[0], me[1]);
        if (e.u || e.d) { UI.resIdx = ((UI.resIdx || 0) + (e.d ? 1 : 2)) % 3; Sfx.play('menu'); }
        if (anyConf) {
          Sfx.play('ok'); const k = UI.resIdx || 0; UI.resIdx = 0;
          if (k === 0) { beginLocalMatch(); return; }
          if (k === 1) { UI.screen = 'select'; UI.selDone = [false, false]; }
          if (k === 2) UI.screen = 'mode';
        }
        if (esc) { UI.screen = 'select'; UI.selDone = [false, false]; Sfx.play('back'); }
      }
      return;
    }
    const ins = gameInputs(raw);
    recFrame(ins);
    step(ins);
    if (G.mode === 'training') { demoAfterStep(); trialTrack(); toolsAfterStep(); tutAfterStep(); }
  }
}
const PICK_KEY = 'umavs.picks';
function lastPicks(mode) { try { const o = JSON.parse(localStorage.getItem(PICK_KEY) || '{}')[mode]; if (o && o.length === 2) return o.map(v => Math.min(ROSTER.length, Math.max(0, v | 0))); } catch (e) { } return [0, 1]; }
function rememberPick(side, v) { try { const all = JSON.parse(localStorage.getItem(PICK_KEY) || '{}'), cur = all[UI.pendingMode] || [0, 1]; cur[side] = v; all[UI.pendingMode] = cur; localStorage.setItem(PICK_KEY, JSON.stringify(all)); } catch (e) { } }
function beginLocalMatch() {
  TR.on = false; TR.demo = null; TUT.on = false; TOOLS.recState = TOOLS.rec && TOOLS.rec.length ? 'ready' : 'off'; TOOLS.hist = [[], []]; TOOLS.fm = [[], []];
  startMatch(UI.pendingMode, ROSTER[UI.sel[0]], ROSTER[UI.sel[1]], UI.pal);
  G.stage = UI.vsStage || 0; G.music = THEME_IDS[UI.musicIdx ?? 0] || ROSTER[UI.sel[0]];
  if (UI.pendingMode !== 'training') recStart(UI.pendingMode, ROSTER[UI.sel[0]], ROSTER[UI.sel[1]]); else recStop();
  G.cpuLevel = cpuLevel;
  UI.screen = 'game'; UI.paused = false;
}
// gamepad-only edges (keyboard typing in the room code box must not drive the menu)
let padPrevO = [{ ...NEUTRAL }, { ...NEUTRAL }];
function padEdges(pad) {
  const e = { ...NEUTRAL };
  for (let i = 0; i < 2; i++) { const o = pad[i].o; for (const k in NEUTRAL) if (o[k] && !padPrevO[i][k]) e[k] = 1; padPrevO[i] = { ...o }; }
  return e;
}
function orEdges(a, b) { const o = {}; for (const k in a) o[k] = a[k] || b[k]; return o; }

function gameInputs(raw) {
  const [a, b] = G.p;
  if (G.mode === 'versus') return raw;
  // 1-player modes: P1 can use either keyboard layout (WASD or arrows) and either gamepad
  let p1 = orIn(raw[0], raw[1]);
  if (G.mode === 'cpu') return [p1, cpuInput(b, G.cpuLevel)];
  if (TUT.on) return [p1, tutDummy()];
  if (TR.demo) p1 = demoInput() || p1;
  const rec = !TR.on && recInputs(p1); if (rec) return rec;
  // training dummy
  const t = G.training;
  let d = { ...NEUTRAL };
  if (t.dummy === 'crouch') d.d = 1;
  else if (t.dummy === 'jump') d.u = 1;
  else if (t.dummy === 'cpu') d = cpuInput(b, 2);
  else if (t.dummy === 'player 2') return raw;
  const threat = a.state === 'attack' || a.state === 'cine' || a.airborne || G.projs.some(q => q.owner === a.side);
  if (t.block !== 'none' && t.dummy !== 'cpu' && b.state !== 'attack' && threat) {
    const doBlock = t.block === 'all' || (t.block === 'random' && ((G.frameCount >> 4) * 2654435761 >>> 0) % 2 === 0);
    if (doBlock) {
      const back = a.x > b.x ? 'l' : 'r'; d[back] = 1; d.l = back === 'l' ? 1 : 0; d.r = back === 'r' ? 1 : 0;
      const low = a.state === 'attack' && a.move.hits && a.move.hits.some(h => h.guard === 'low' && a.t <= h.f[1]);
      const high = a.airborne || (a.state === 'attack' && a.move.hits && a.move.hits.some(h => h.guard === 'high'));
      if (low) d.d = 1; else if (high) d.d = 0;
      if (t.dummy === 'jump') d.u = 0;
    }
  }
  return [p1, d];
}
const DUMMY = ['stand', 'crouch', 'jump', 'cpu', 'player 2'], GUARD = ['none', 'all', 'random'];
function cycle(k) {
  const list = k === 'dummy' ? DUMMY : GUARD;
  G.training[k] = list[(list.indexOf(G.training[k]) + 1) % list.length]; Sfx.play('menu');
  G.p[1].ai = null;
}
function resetTraining() { for (const p of G.p) { const m = p.meter; p.reset(); p.setState('idle'); p.meter = m; } G.projs = []; G.adv = null; G.cam = STAGE_W / 2; G.freeze = 0; G.flashOwner = null; G.slow = 0; }

function pauseItems() {
  const items = [['Resume', () => { UI.paused = false; }]];
  if (TR.on) {
    items.push(['Watch demo', () => { demoStart(); UI.paused = false; }]);
    items.push(['Next trial', () => { trialStart(TR.cid, TR.idx + 1); UI.paused = false; }]);
    items.push(['Previous trial', () => { trialStart(TR.cid, TR.idx - 1); UI.paused = false; }]);
    items.push(['Reset positions', () => { trialReset(); UI.paused = false; }]);
    items.push([`Input display: ${TOOLS.inputs ? 'on' : 'off'}`, () => { TOOLS.inputs = !TOOLS.inputs; }]);
    items.push(['Trial list', () => { recStop(); TR.on = false; UI.screen = 'trials'; TM.idx = TR.idx; UI.paused = false; }]);
  } else if (TUT.on) { tutPauseItems(items); return items.concat(pauseCommon()); }
  else if (G.mode === 'training') {
    items.push([`Dummy: ${G.training.dummy}`, () => cycle('dummy')]);
    items.push([`Dummy guard: ${G.training.block}`, () => cycle('block')]);
    items.push([`Hitboxes: ${G.showBoxes ? 'on' : 'off'}`, () => { G.showBoxes = !G.showBoxes; }]);
    items.push(['Reset positions', () => { resetTraining(); UI.paused = false; }]);
    items.push([`Input display: ${TOOLS.inputs ? 'on' : 'off'}`, () => { TOOLS.inputs = !TOOLS.inputs; }]);
    items.push([`Frame meter: ${TOOLS.meter ? 'on' : 'off'}`, () => { TOOLS.meter = !TOOLS.meter; }]);
    items.push([TOOLS.recState === 'recording' ? 'Stop recording' : 'Record dummy', () => { recToggle(); UI.paused = false; }]);
    items.push([TOOLS.recState === 'playing' ? 'Stop playback' : 'Play recording', () => { playToggle(); UI.paused = false; }]);
  } else items.push([`Hitboxes: ${G.showBoxes ? 'on' : 'off'}`, () => { G.showBoxes = !G.showBoxes; }]);
  items.push(...pauseCommon());
  if (!ARC.on) items.push(['Character select', () => { recStop(); UI.screen = 'select'; UI.selDone = [false, false]; UI.paused = false; }]);
  else items.push(['Give up this run', () => { recStop(); arcQuit(); UI.paused = false; }]);
  items.push(['Main menu', () => { recStop(); ARC.on = false; UI.screen = 'mode'; UI.paused = false; }]);
  return items;
}
function pauseCommon() {
  const items = [];
  items.push([`Music: ${Math.round(Music.vol * 100)}%`, () => { Music.vol = Music.vol >= 1 ? 0 : Math.round((Music.vol + 0.25) * 4) / 4; Music.save(); }]);
  items.push([`Effects: ${Sfx.muted ? 'off' : 'on'}`, () => { Sfx.muted = !Sfx.muted; }]);
  items.push([`Reduce flashes: ${SET.calm ? 'on' : 'off'}`, () => { SET.calm = !SET.calm; saveSet(); }]);
  items.push([`Graphics: ${SET.gfx}`, () => cycleGfx(1)]);
  items.push(['Fullscreen', () => toggleFullscreen()]);
  items.push(['Move list', () => { UI.screen = 'moves'; UI.back = 'game'; UI.movesChar = ROSTER.indexOf(G.p[0].cid); UI.movesPage = 0; }]);
  items.push(['Controls', () => { UI.screen = 'controls'; UI.back = 'game'; UI.ctl = null; }]);
  return items;
}
function pauseMenu(me, esc, enter, conf, back) {
  const items = pauseItems();
  if (me[0].u || me[1].u) { UI.pauseIdx = (UI.pauseIdx + items.length - 1) % items.length; Sfx.play('menu'); }
  if (me[0].d || me[1].d) { UI.pauseIdx = (UI.pauseIdx + 1) % items.length; Sfx.play('menu'); }
  if (conf(0) || conf(1) || enter) { items[UI.pauseIdx][1](); Sfx.play('ok'); }
  if (esc || back(0)) { UI.paused = false; Sfx.play('back'); }
}

// ------------------------------------------------------------------ menu drawing
// combo notation -> readable: 236M -> ↓↘→M, jc -> jump cancel, dc -> dash cancel
// ------------------------------------------------------------------ control mapping
const CTL_COLS = ['P1 KEY', 'P2 KEY', 'GAMEPAD'];
function controlsRows() { return [...ACTIONS.map(([a, label]) => ({ a, label })), { label: 'Reset to defaults', act: 'reset' }, { label: 'Back', act: 'back' }]; }
let padPrevBtns = [];
function controlsTick(edges, esc, enter, e) {
  const C = UI.ctl || (UI.ctl = { row: 0, col: 0, wait: null, cool: 0 });
  const rows = controlsRows();
  if (C.wait && C.wait.kind === 'pad') {   // waiting for a gamepad button
    const pads = getPads(); let pressed = -1;
    for (const gp of pads) gp.buttons.forEach((bt, i) => { if (bt.pressed && !padPrevBtns.includes(i) && pressed < 0) pressed = i; });
    padPrevBtns = []; for (const gp of pads) gp.buttons.forEach((bt, i) => bt.pressed && padPrevBtns.push(i));
    if (esc) C.wait = null;
    else if (pressed >= 0 && pressed !== 9) { bindPad(C.wait.action, pressed); C.wait = null; C.cool = 12; }
    return;
  }
  if (C.wait) return;                       // keyboard capture happens in the keydown handler
  if (C.cool > 0) { C.cool--; return; }
  const has = k => edges.includes(k);
  if (has('ArrowUp') || has('KeyW') || e.u) { C.row = (C.row + rows.length - 1) % rows.length; Sfx.play('menu'); }
  if (has('ArrowDown') || has('KeyS') || e.d) { C.row = (C.row + 1) % rows.length; Sfx.play('menu'); }
  if (has('ArrowLeft') || has('KeyA') || e.l) { C.col = (C.col + 2) % 3; Sfx.play('menu'); }
  if (has('ArrowRight') || has('KeyD') || e.r) { C.col = (C.col + 1) % 3; Sfx.play('menu'); }
  if (esc) { UI.screen = UI.back; UI.ctl = null; Sfx.play('back'); return; }
  if (enter || has('KeyF') || e.L || e.S) {
    const r = rows[C.row];
    if (r.act === 'reset') { resetControls(); Sfx.play('ok'); toast('Controls reset to defaults'); }
    else if (r.act === 'back') { UI.screen = UI.back; UI.ctl = null; }
    else {
      C.wait = C.col < 2 ? { kind: 'key', player: C.col, action: r.a } : { kind: 'pad', action: r.a };
      padPrevBtns = []; for (const gp of getPads()) gp.buttons.forEach((bt, i) => bt.pressed && padPrevBtns.push(i));
      Sfx.play('ok');
    }
  }
}

function render() {
  baseT();
  try { renderScreen(); } finally {
    baseT();
    if (PERF.on) drawPerf();
    if (toastT > 0) { toastT--; ctx.globalAlpha = Math.min(1, toastT / 20); slant(W / 2 - 270, HGT - 94, 540, 34, 10, 'rgba(34,17,60,.95)'); ctx.fillStyle = PAL.gold; ctx.fillRect(W / 2 - 262, HGT - 94, 524, 2); label(toastMsg, W / 2 + 5, HGT - 76, 16, '#fff', 'center', 700); ctx.globalAlpha = 1; }
  }
}
function renderScreen() {
  switch (UI.screen) {
    case 'title': drawTitle(); break;
    case 'mode': drawMode(); break;
    case 'select': drawSelect(); break;
    case 'stage': drawStageSelect(); break;
    case 'music': drawMusicSelect(); break;
    case 'sound': drawSound(); break;
    case 'trials': drawTrialsMenu(); break;
    case 'vs': drawVS(); break;
    case 'moves': drawMoves(); break;
    case 'controls': drawControls(); break;
    case 'game': renderGame(); if (UI.paused) drawPause(); if (G.mode === 'online') drawNetHUD(); break;
    case 'online': drawOnlineBg(); break;
    case 'spectate': if (SPEC.live) renderGame(); else drawOnlineBg(); drawSpecHUD(); break;
    case 'friends': drawFriends(); break;
    case 'leaders': drawLeaders(); break;
    case 'account': drawAccount(); break;
    case 'netselect': drawNetSelect(); break;
    case 'replays': drawReplaysMenu(); break;
    case 'repwarn': drawRepWarn(); break;
    case 'arcladder': drawArcLadder(); break;
    case 'arcvs': drawArcVS(); break;
    case 'arcwin': drawArcWin(); break;
    case 'arccont': drawArcCont(); break;
    case 'arcover': drawArcOver(); break;
    case 'arcend': drawArcEnd(); break;
    case 'arcdone': drawArcDone(); break;
    case 'replay': renderGame(); drawReplayHUD(); break;
  }
}

// ------------------------------------------------------------------ loop
let acc = 0, last = performance.now();
// F3: frame-rate readout (frames per second, average and worst frame time over the last second)
const PERF = { on: (() => { try { return !!localStorage.getItem('umavs.fps'); } catch (e) { return false; } })(), frames: 0, work: 0, worst: 0, t0: 0, text: '' };
function drawPerf() {
  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, 214, 17);
  label(PERF.text || '…', 6, 9, 12, '#9dffb4', 'left', 700);
}
function loop(now) {
  const dt = 1000 / 60;
  if (PERF.on) {
    if (!PERF.t0) PERF.t0 = now;
    PERF.frames++; const gap = now - last; if (gap > PERF.worst) PERF.worst = gap;
    if (now - PERF.t0 >= 1000) {
      PERF.text = `${Math.round(PERF.frames * 1000 / (now - PERF.t0))} fps · work ${(PERF.work / PERF.frames).toFixed(1)} ms · worst ${PERF.worst.toFixed(0)} ms · ${SET.gfx}`;
      PERF.frames = 0; PERF.work = 0; PERF.worst = 0; PERF.t0 = now;
    }
  }
  const w0 = performance.now();
  let el = Math.min(250, now - last); last = now;
  // on a 60 Hz screen frames arrive every ~16.7 ms give or take a millisecond. Treat those as exactly one
  // tick, otherwise the jitter sometimes gives 0 ticks then 2 and the game visibly hitches.
  if (Math.abs(el - dt) < 1.5) el = dt;
  acc += el;
  let n = 0;
  while (acc >= dt - 0.5 && n < 4) { tick(); acc -= dt; n++; }
  if (n === 4) acc = 0;   // way behind (tab was hidden, slow machine): don't try to catch up
  if (n > 0) render();    // nothing changed since the last picture, so skip redrawing (saves work on 120 Hz+ screens)
  if (PERF.on) PERF.work += performance.now() - w0;
  requestAnimationFrame(loop);
}
function cycleGfx(d) { SET.gfx = GFX[(GFX.indexOf(SET.gfx) + d + GFX.length) % GFX.length]; saveSet(); fit(); }
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / HGT);
  cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(HGT * s) + 'px';
  // render at native resolution (capped at 2560 wide)
  const r = Math.min((GFX_W[SET.gfx] || 1440) / W, Math.max(1, Math.floor(W * s * (window.devicePixelRatio || 1)) / W));
  if (Math.abs(r - RES) > 0.001 || cv.width !== Math.round(W * r)) {
    RES = r; cv.width = Math.round(W * r); cv.height = Math.round(HGT * r);
    ctx.imageSmoothingEnabled = false;
  }
}
if (window.matchMedia) try { matchMedia('(resolution: 1dppx)').addEventListener('change', fit); } catch (e) { }
addEventListener('resize', fit);
const fontsReady = document.fonts ? Promise.all(['600 16px "Barlow Condensed"', 'italic 800 16px "Barlow Condensed"', 'italic 900 16px "Barlow Condensed"', '16px "Dela Gothic One"']
  .map(f => document.fonts.load(f).catch(() => null))) : Promise.resolve();
Music.load();
fontsReady.then(() => loadAssets()).then(() => { ledCache.clear(); initNetPanel(); initAcctPanel(); initFriendPanel(); acctInit(); fit(); Music.prewarm(); requestAnimationFrame(loop); });

// ------------------------------------------------------------------ fullscreen
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
  } catch (e) { toast('Fullscreen is not available here'); }
}
