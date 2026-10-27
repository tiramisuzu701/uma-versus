const VERSION = '2.0.1';
// Menus and HUD. The look is race day: gate colours, tote-board LED text,
// saddlecloth name plates, rosettes for round wins.
'use strict';

const SET_KEY = 'umavs.settings';
const SET = { calm: false, gfx: 'medium' };   // gfx: low = 960x540, medium = up to 1440 wide, high = up to 2560 wide
try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { }
if ('sharp' in SET) { if (SET.sharp === false) SET.gfx = 'low'; delete SET.sharp; }   // old 1.8 setting
const GFX = ['low', 'medium', 'high'], GFX_W = { low: 960, medium: 1440, high: 2560 };
function saveSet() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) { } }
const FD = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';
const PAL = {
  ink: '#170c28', navy: '#1e1038', navy2: '#2a1748', navy3: '#3a2360', night: '#1b1030', lilac: '#e3d8f5', rail: '#f4f1e8', turf: '#2fae5b', turfD: '#1d7a3e',
  gold: '#f6c343', goldD: '#b98512', rose: '#ff4f8b', p1: '#4aa8ff', p2: '#ff5a5a', dim: '#b3a6d4', led: '#ffb43a',
};
// JRA starting-gate colours, gates 1–8 (one per runner on the roster)
const GATE = [['#f4f4f4', '#151515'], ['#1d1d1d', '#ffffff'], ['#e43b3b', '#ffffff'], ['#2f6fe0', '#ffffff'],
              ['#f6d23a', '#151515'], ['#2fae5b', '#ffffff'], ['#f39233', '#151515'], ['#f27fb3', '#151515']];
const gateOf = cid => Math.max(0, ROSTER.indexOf(cid));
const DISPLAY = { mm: 'MEJIRO McQUEEN' };
const nameOf = cid => DISPLAY[cid] || CHARS[cid].name;
// select-screen ratings (1–5); health is derived from the data
const RATING = { spe: [3, 3, 3, 1], suz: [5, 4, 2, 3], gs: [4, 3, 2, 3], vo: [3, 3, 2, 3], ds: [2, 2, 5, 2], mm: [2, 3, 4, 4], tt: [4, 5, 2, 4], kb: [3, 3, 3, 1],
  jp: [1, 5, 1, 3], at: [2, 3, 4, 5], mc: [3, 3, 4, 5], df: [5, 3, 3, 3] };

// ---------------------------------------------------------------- text
function font(size, weight = 800, italic = true) { return `${italic ? 'italic ' : ''}${weight} ${size}px ${FD}`; }
const FDISP = '"Dela Gothic One", "Barlow Condensed", sans-serif';
function txt(s, x, y, size, color = '#fff', align = 'center', stroke = PAL.ink, weight = 900) {
  const heavy = weight >= 800, dsp = heavy && size >= 30;   // headlines use the display face (it runs wider, so a little smaller)
  ctx.font = dsp ? `${Math.round(size * 0.8)}px ${FDISP}` : font(size, heavy ? (size >= 40 ? 900 : 800) : 600, heavy);
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (stroke) {
    if (dsp) { const o = Math.max(2, Math.round(size / 18)); ctx.fillStyle = stroke; ctx.fillText(s, x + o, y + o); }   // offset shadow, Final Stretch style
    ctx.lineWidth = Math.max(2.5, size / (dsp ? 10 : 7)); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function disp(s, x, y, size, color = '#fff', align = 'left', shadow = null) {   // display face, no outline
  ctx.font = `${size}px ${FDISP}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (shadow) { const o = Math.max(2, Math.round(size / 14)); ctx.fillStyle = shadow; ctx.fillText(s, x + o, y + o); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function dispW(s, size) { ctx.font = `${size}px ${FDISP}`; return ctx.measureText(s).width; }
function fitDisp(s, maxW, size) { const w = dispW(s, size); return w > maxW ? Math.floor(size * maxW / w) : size; }
function label(s, x, y, size, color = '#fff', align = 'left', weight = 600, italic = false) {
  ctx.font = font(size, weight, italic); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function wrap(s, x, y, maxW, lh) {
  const words = s.split(' '); let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t; }
  ctx.fillText(line, x, y); return y;
}

// ---------------------------------------------------------------- LED dot-matrix (tote board)
const LED = (() => {
  const g = {}, rows = {
    '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110', '2': '01110 10001 00001 00010 00100 01000 11111',
    '3': '11110 00001 00001 01110 00001 00001 11110', '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
    '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000', '8': '01110 10001 10001 01110 10001 10001 01110',
    '9': '01110 10001 10001 01111 00001 00010 01100', 'A': '01110 10001 10001 11111 10001 10001 10001', 'B': '11110 10001 10001 11110 10001 10001 11110',
    'C': '01110 10001 10000 10000 10000 10001 01110', 'D': '11100 10010 10001 10001 10001 10010 11100', 'E': '11111 10000 10000 11110 10000 10000 11111',
    'F': '11111 10000 10000 11110 10000 10000 10000', 'G': '01110 10001 10000 10111 10001 10001 01111', 'H': '10001 10001 10001 11111 10001 10001 10001',
    'I': '01110 00100 00100 00100 00100 00100 01110', 'J': '00111 00010 00010 00010 00010 10010 01100', 'K': '10001 10010 10100 11000 10100 10010 10001',
    'L': '10000 10000 10000 10000 10000 10000 11111', 'M': '10001 11011 10101 10101 10001 10001 10001', 'N': '10001 10001 11001 10101 10011 10001 10001',
    'O': '01110 10001 10001 10001 10001 10001 01110', 'P': '11110 10001 10001 11110 10000 10000 10000', 'Q': '01110 10001 10001 10001 10101 10010 01101',
    'R': '11110 10001 10001 11110 10100 10010 10001', 'S': '01111 10000 10000 01110 00001 00001 11110', 'T': '11111 00100 00100 00100 00100 00100 00100',
    'U': '10001 10001 10001 10001 10001 10001 01110', 'V': '10001 10001 10001 10001 10001 01010 00100', 'W': '10001 10001 10001 10101 10101 10101 01010',
    'X': '10001 10001 01010 00100 01010 10001 10001', 'Y': '10001 10001 01010 00100 00100 00100 00100', 'Z': '11111 00001 00010 00100 01000 10000 11111',
    ' ': '00000 00000 00000 00000 00000 00000 00000', ':': '00000 01100 01100 00000 01100 01100 00000', '.': '00000 00000 00000 00000 00000 01100 01100',
    '!': '00100 00100 00100 00100 00100 00000 00100', '-': '00000 00000 00000 11111 00000 00000 00000', '/': '00001 00010 00010 00100 01000 01000 10000',
    '+': '00000 00100 00100 11111 00100 00100 00000', '*': '00100 10101 01110 11111 01110 10101 00100', '?': '01110 10001 00001 00010 00100 00000 00100',
    "'": '00100 00100 01000 00000 00000 00000 00000', '·': '00000 00000 00000 01100 01100 00000 00000', '%': '11000 11001 00010 00100 01000 10011 00011',
  };
  for (const [k, v] of Object.entries(rows)) g[k] = v.replace(/ /g, '');
  return g;
})();
const ledCache = new Map();
function ledText(str, x, y, dot, col = PAL.led, align = 'center', offCol = null) {
  str = String(str).toUpperCase();
  const key = str + '|' + dot + '|' + col + '|' + offCol + '|' + RES;
  let c = ledCache.get(key);
  if (!c) {
    const pitch = dot * 1.25, cw = 6 * pitch, pad = dot * 2;
    const lw = Math.ceil(str.length * cw + pad * 2), lh = Math.ceil(7 * pitch + pad * 2);
    c = canvasOf(Math.ceil(lw * RES), Math.ceil(lh * RES)); c.lw = lw; c.lh = lh;
    const x2 = c.getContext('2d'); x2.scale(RES, RES);
    for (const pass of [0, 1]) {
      if (pass === 0 && !offCol) continue;
      if (pass === 1) { x2.shadowColor = col; x2.shadowBlur = dot * 1.6; }
      x2.fillStyle = pass ? col : offCol;
      [...str].forEach((ch, i) => {
        const gl = LED[ch] || LED['?'];
        for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) {
          const on = gl[r * 5 + k] === '1';
          if (on !== !!pass) continue;
          x2.beginPath(); x2.arc(pad + i * cw + k * pitch + dot / 2, pad + r * pitch + dot / 2, dot / 2, 0, 7); x2.fill();
        }
      });
    }
    if (ledCache.size > 300) ledCache.clear();
    ledCache.set(key, c);
  }
  const ox = align === 'center' ? x - c.lw / 2 : align === 'right' ? x - c.lw : x;
  ctx.drawImage(c, Math.round(ox), Math.round(y - c.lh / 2), c.lw, c.lh);
  return c.lw;
}

// ---------------------------------------------------------------- shapes
function slant(x, y, w, h, k, fill) {   // parallelogram leaning right by k px
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + w + k, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
}
function rrect(x, y, w, h, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function gateTag(n, x, y, s = 26) {   // gate number square in its JRA colour
  const [bg, fg] = GATE[n % 8];
  rrect(x, y, s, s, 4, bg, n % 8 === 0 ? '#9aa0b8' : null, 1.5);
  label(String(n + 1), x + s / 2, y + s / 2 + 1, s * 0.78, fg, 'center', 900, true);
}
function rosette(x, y, r, col, on) {   // round-win marker
  ctx.save(); ctx.translate(x, y);
  if (on) {   // ribbons
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.2); ctx.lineTo(-r * 0.9, r * 1.6); ctx.lineTo(-r * 0.35, r * 1.3); ctx.lineTo(-r * 0.1, r * 1.7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.5, r * 0.2); ctx.lineTo(r * 0.9, r * 1.6); ctx.lineTo(r * 0.35, r * 1.3); ctx.lineTo(r * 0.1, r * 1.7); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = on ? col : '#3a2a5c'; ctx.beginPath();
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = i % 2 ? r : r * 0.82; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = on ? PAL.rail : '#24143e'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 7); ctx.fill();
  if (on) { ctx.fillStyle = col; star(0, 0, r * 0.4, -Math.PI / 2); }
  ctx.restore();
}
function railDivider(x, y, w, col = PAL.rail) {   // white running rail with posts
  ctx.fillStyle = col; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y + 3, w, 1);
  for (let px = x; px < x + w; px += 28) { ctx.fillStyle = col; ctx.fillRect(px, y, 3, 9); }
}
function plate(x, y, w, h, col, k = 12) {   // saddlecloth-style name plate
  slant(x, y, w, h, k, col);
  ctx.save(); ctx.globalAlpha = 0.22; slant(x + 2, y + 2, w - 6, h * 0.32, k * 0.9, '#fff'); ctx.restore();
}
function panel(x, y, w, h, accent = PAL.gold) {
  rrect(x, y, w, h, 10, 'rgba(34,17,60,.9)', 'rgba(255,255,255,.16)', 1.5);
  rrect(x + 14, y - 2, w - 28, 4, 2, accent);
}
function meterBar(x, y, w, h, v, col) {   // 5-pip rating bar
  for (let i = 0; i < 5; i++) slant(x + i * (w / 5), y, w / 5 - 4, h, 4, i < v ? col : 'rgba(255,255,255,.12)');
}

// ---------------------------------------------------------------- faces (head crop of the idle frame)
const FACES = {};
function faceOf(cid, pal, flip) {
  pal = pal || 0;
  const key = cid + '.' + pal + (flip ? 'f' : '');
  if (FACES[key]) return FACES[key];
  const S = SPR[cid], idx = S.anims['800'][0], [src, sx, sy] = palSrc(cid, pal, flip, idx);
  const tmp = canvasOf(64, 64), t = tmp.getContext('2d'); t.drawImage(src, sx, sy, 64, 64, 0, 0, 64, 64);
  let top = 0, minX = 64, maxX = 0;
  try {
    const d = t.getImageData(0, 0, 64, 64).data;
    top = 64; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (d[(y * 64 + x) * 4 + 3] > 20) { top = Math.min(top, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  } catch (e) { top = 6; minX = 16; maxX = 48; }
  const cx = Math.round((minX + maxX) / 2), c = canvasOf(30, 30), f = c.getContext('2d');
  f.save(); if (flip) { f.translate(30, 0); f.scale(-1, 1); }
  f.drawImage(tmp, flip ? 64 - cx - 15 : cx - 15, top - 1, 30, 30, 0, 0, 30, 30); f.restore();
  return (FACES[key] = c);
}
function face(cid, alt, x, y, size, flip) { ctx.imageSmoothingEnabled = false; ctx.drawImage(faceOf(cid, alt, flip), x, y, size, size); }

// ---------------------------------------------------------------- shared backdrop (Winning Live × Final Stretch)
let ACCENT = PAL.rose;   // the colour of whoever is on screen; menus set it, defaults to rose
const PEN = ['#ff4f8b', '#f6c343', '#4aa8ff', '#2fae5b', '#ffffff'];   // penlight colours
function glow(col, blur, fn) { if (SET.gfx === 'low') return fn(); ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; fn(); ctx.restore(); }
function beams(alpha = 0.16) {   // stage spotlights sweeping slowly
  const t = UI.t / 160, cols = [ACCENT, '#ffffff', '#4aa8ff'];
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const x = 200 + i * 240, a = Math.sin(t + i * 2.1) * 0.32 + (i - 1) * 0.18, len = 640, half = 120;
    ctx.globalAlpha = alpha; ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.moveTo(x - 8, -20); ctx.lineTo(x + 8, -20);
    ctx.lineTo(x + Math.sin(a) * len + half, Math.cos(a) * len); ctx.lineTo(x + Math.sin(a) * len - half, Math.cos(a) * len); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function speedLines(alpha = 0.05) {
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = -260; x < W + 40; x += 26) { ctx.moveTo(x, HGT); ctx.lineTo(x + HGT * 0.36, 0); }
  ctx.stroke();
}
function sparkles(n = 14) {   // twinkling four-point stars
  for (let i = 0; i < n; i++) {
    const x = (i * 197 + 61) % W, y = 50 + (i * 113) % (HGT - 120), ph = (UI.t / 40 + i * 1.7) % (Math.PI * 2), k = Math.max(0, Math.sin(ph));
    if (k < 0.05) continue;
    ctx.globalAlpha = k * 0.7; star4(x, y, 3 + k * 5, i % 3 ? '#fff' : PAL.gold); ctx.globalAlpha = 1;
  }
}
function star4(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.25, y - r * 0.25); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.25, y + r * 0.25); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.25, y + r * 0.25); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.25, y - r * 0.25); ctx.closePath(); ctx.fill(); }
function stripes(x, col = ACCENT, w = 300) {   // Final Stretch colour bands, skewed
  const k = HGT * 0.36, band = (bx, bw, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(bx + k, 0); ctx.lineTo(bx + bw + k, 0); ctx.lineTo(bx + bw, HGT); ctx.lineTo(bx, HGT); ctx.closePath(); ctx.fill(); };
  ctx.save(); ctx.globalAlpha = 0.9; band(x, w, col); ctx.restore();
  band(x + w + 20, 44, PAL.turf); band(x + w + 80, 14, PAL.gold);
}
function ghostText(s, x, y, size, align = 'left') {   // huge outlined word behind everything
  ctx.font = `${size}px ${FDISP}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.strokeText(s, x, y);
}
function penlights(x, y, w, h, gap) { PEN.forEach((c, i) => glow(c, 8, () => rrect(x + i * (w + gap), y, w, h, w / 2, c))); }
function horseshoe(x, y, r, col) {   // a lucky horseshoe, opening upward
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = r * 0.42; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.1, Math.PI * 0.9, false); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + r * Math.cos(Math.PI * 0.1), y + r * Math.sin(Math.PI * 0.1)); ctx.lineTo(x + r, y - r * 0.55);
  ctx.moveTo(x - r * Math.cos(Math.PI * 0.1), y + r * Math.sin(Math.PI * 0.1)); ctx.lineTo(x - r, y - r * 0.55); ctx.stroke();
  ctx.fillStyle = PAL.ink; for (const a of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.arc(x + Math.cos(Math.PI * a) * r, y + Math.sin(Math.PI * a) * r, r * 0.09, 0, 7); ctx.fill(); }
  ctx.restore();
}
function rowSlant(x, y, w, h, k, sel, base) {   // a menu row; the selected one is a white plate with the accent behind it
  if (!sel) return slant(x, y, w, h, k, base);
  glow(ACCENT, 16, () => slant(x + 5, y + 4, w, h, k, ACCENT));
  slant(x, y, w, h, k, '#fff');
}
const GHOST = { sound: 'OPTIONS', controls: 'CONTROLS', moves: 'MOVE LIST', replays: 'REPLAYS', trials: 'TRIALS', online: 'ONLINE', netselect: 'ONLINE',
  account: 'ACCOUNT', friends: 'FRIENDS', leaders: 'RANKINGS', select: 'ENTRY', stage: 'COURSE', music: 'MUSIC', arcladder: 'ARCADE', arcvs: 'ARCADE', arccont: 'ARCADE', arcover: 'ARCADE', arcdone: 'ARCADE', arcwin: 'ARCADE', repwarn: 'REPLAYS' };
function menuBg(dim = 0.55, acc = PAL.rose) {
  baseT(); ACCENT = acc;
  const cycle = ['title', 'mode'].includes(UI.screen);
  if (cycle) menuStage = Math.floor(UI.t / 720) % STAGES.length;
  const cam = STAGE_W / 2 + Math.sin(UI.t / 300) * 400;
  drawStage(cam, menuStage);
  const k = UI.t % 720;
  if (cycle && k > 690) { ctx.globalAlpha = (k - 690) / 30; drawStage(cam, (menuStage + 1) % STAGES.length); ctx.globalAlpha = 1; }
  ctx.fillStyle = `rgba(24,10,44,${Math.min(0.92, 0.6 + dim * 0.4)})`; ctx.fillRect(0, 0, W, HGT);
  const gw = GHOST[UI.screen]; if (gw) ghostText(gw, W + 6, HGT - 30, fitDisp(gw, W * 0.9, 150), 'right');
  speedLines(); beams(UI.screen === 'mode' || UI.screen === 'title' ? 0.2 : 0.12); sparkles(UI.screen === 'mode' || UI.screen === 'title' ? 14 : 8);
}
function topBar(title, sub) {
  ctx.fillStyle = PAL.navy2; ctx.fillRect(0, 0, W, 40);
  ctx.fillStyle = ACCENT; ctx.fillRect(0, 40, W, 3);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  const ok = logoImg(64, 20, 96); ctx.imageSmoothingEnabled = sm;
  if (!ok) { label('UMA', 14, 21, 24, '#fff', 'left', 900, true); label('VERSUS', 58, 21, 24, PAL.gold, 'left', 900, true); }
  const fs = fitDisp(title, W - 400, 17), tw = dispW(title, fs) + 34;
  slant(128, 7, tw, 27, 8, ACCENT);
  horseshoe(146, 21, 6, PAL.ink);
  disp(title, 160, 21, fs, PAL.ink, 'left');
  if (sub) label(sub, W - 16, 21, 15, PAL.dim, 'right', 600);
}
function hintBar(s) {
  ctx.fillStyle = PAL.navy2; ctx.fillRect(0, HGT - 26, W, 26);
  ctx.fillStyle = ACCENT; ctx.fillRect(0, HGT - 26, W, 3);
  penlights(12, HGT - 19, 5, 13, 5);
  label(s, W / 2, HGT - 12, 14, '#e8e0f6', 'center', 600);
}
const LOGO = typeof LOGO_URI !== 'undefined' ? Object.assign(new Image(), { src: LOGO_URI }) : null;
const LOGO_ERA = typeof LOGO_ERA_URI !== 'undefined' ? Object.assign(new Image(), { src: LOGO_ERA_URI }) : null;   // Update 2: "Beginning of a New Era"
function logoImg(cx, cy, w) {   // the logo artwork; false if it hasn't decoded yet
  if (!LOGO || !LOGO.complete || !LOGO.naturalWidth) return false;
  const h = w * LOGO.naturalHeight / LOGO.naturalWidth;
  ctx.drawImage(LOGO, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h)); return true;
}
function logo(x, y, s = 1) {
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const ok = logoImg(x - 10, y - 4, 470 * s); ctx.imageSmoothingEnabled = sm; if (ok) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (let i = 0; i < 5; i++) slant(-330 + i * 22, 34 + i * 7, 260 - i * 30, 4, 10, ['#ff4f8b', '#f6c343', '#2fae5b', '#4aa8ff', '#f4f1e8'][i]);   // speed stripes
  txt('UMA', -12, 0, 104, '#fff', 'right', PAL.ink);
  txt('VERSUS', -2, 0, 104, PAL.gold, 'left', PAL.ink);
  ctx.restore();
}

// ---------------------------------------------------------------- title
function drawTitle() {
  menuBg(0.35);
  // the whole roster parading along the rail
  ROSTER.forEach((cid, i) => {
    const x = ((UI.t * 3.2 + i * 150) % (W + 300)) - 150;
    drawSpr(cid, 0, '102', Math.floor(UI.t / 4 + i) % SPR[cid].anims['102'][1], x, 500, 1, 2.6);
  });
  if (LOGO_ERA && LOGO_ERA.complete && LOGO_ERA.naturalWidth) {   // this update's logo, with the subtitle
    const lw = 452, lh = lw * LOGO_ERA.naturalHeight / LOGO_ERA.naturalWidth, sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(LOGO_ERA, Math.round(W / 2 + 4 - lw / 2), 24, Math.round(lw), Math.round(lh)); ctx.imageSmoothingEnabled = sm;
  } else logo(W / 2 + 10, 150, 1);
  // tagline on a slanted tag
  const tg = `${ROSTER.length} RUNNERS  ·  FAN-MADE FIGHTING GAME`; ctx.font = font(17, 800, true); const tw = ctx.measureText(tg).width + 40;
  slant(W / 2 - tw / 2, 268, tw, 28, 10, PAL.navy2); label(tg, W / 2 + 5, 283, 17, PAL.gold, 'center', 800, true);
  if (UI.titleIdx >= 0 ? true : UI.t % 70 < 48) {
    const pw = 300; if (UI.titleIdx >= 0) ctx.globalAlpha = 0.45;
    glow(PAL.rose, 22, () => slant(W / 2 - pw / 2 + 6, 318, pw, 50, 14, PAL.rose)); slant(W / 2 - pw / 2, 312, pw, 50, 14, '#fff');
    disp('PRESS START', W / 2 + 7, 338, 30, PAL.ink, 'center'); ctx.globalAlpha = 1;
  }
  label('Enter · F · Ⓐ to start    ·    Down for links', W / 2, 384, 15, '#e8e0f6', 'center');
  if (Music.blocked) { slant(W / 2 - 205, 404, 410, 30, 10, 'rgba(24,11,42,.85)'); label('♪  Your browser holds back sound until you press a key or click', W / 2 + 5, 420, 14, PAL.gold, 'center', 700); }
  penlights(20, HGT - 44, 7, 24, 6);
  drawSocialBar();
  if (UI.titleIdx >= 0) label('← → choose    ·    confirm to open    ·    ↑ back', W / 2, HGT - 8, 12, '#e8e0f6', 'center', 600);
  label(`Update ${VERSION} · build ${BUILD}`, W - 12, HGT - 12, 12, 'rgba(255,255,255,.55)', 'right');
  drawAcctChip();
}

// ---------------------------------------------------------------- social links (title screen)
const SOCIALS = [
  { name: 'DISCORD', url: 'https://discord.gg/gUgfWuWhQh', col: '#6b74ff', icon: 'chat' },
  { name: 'YOUTUBE', url: 'https://www.youtube.com/@UmaVersus', col: '#ff4a4a', icon: 'play' },
  { name: 'TIKTOK', url: 'https://www.tiktok.com/@uma.versus', col: '#2fe0d8', icon: 'note' },
];
function socialRects() {
  const w = 148, h = 34, gap = 12, total = SOCIALS.length * w + (SOCIALS.length - 1) * gap, x0 = W / 2 - total / 2, y = HGT - 52;
  return SOCIALS.map((sc, i) => ({ ...sc, x: x0 + i * (w + gap), y, w, h }));
}
function socialIcon(kind, x, y, col) {   // simple generic glyphs (not the brand logos)
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2.2;
  if (kind === 'play') { rrect(x - 10, y - 7, 20, 14, 4, col); ctx.fillStyle = col === '#fff' ? PAL.ink : '#fff'; ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x + 5, y); ctx.lineTo(x - 3, y + 4); ctx.closePath(); ctx.fill(); }
  else if (kind === 'chat') { rrect(x - 10, y - 8, 20, 13, 5, col); ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x - 7, y + 9); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col === '#fff' ? PAL.ink : '#fff'; for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.arc(x + dx, y - 1.5, 1.6, 0, 7); ctx.fill(); } }
  else { ctx.beginPath(); ctx.arc(x - 3, y + 5, 4, 0, 7); ctx.fill(); ctx.fillRect(x, y - 9, 2.4, 14); ctx.beginPath(); ctx.moveTo(x + 2.4, y - 9); ctx.quadraticCurveTo(x + 9, y - 6, x + 8, y - 1); ctx.quadraticCurveTo(x + 6, y - 4, x + 2.4, y - 4); ctx.fill(); }
}
function drawSocialBar() {
  const R = socialRects();
  R.forEach((r, i) => {
    const s = UI.titleIdx === i || UI.socialHover === i;
    if (s) { glow(r.col, 16, () => rrect(r.x, r.y, r.w, r.h, r.h / 2, '#fff')); }
    else rrect(r.x, r.y, r.w, r.h, r.h / 2, 'rgba(24,10,44,.88)', 'rgba(255,255,255,.4)', 2);
    socialIcon(r.icon, r.x + 26, r.y + r.h / 2, s ? r.col : '#fff');
    label(r.name, r.x + 46, r.y + r.h / 2 + 1, 16, s ? PAL.ink : '#fff', 'left', 900, true);
  });
}
function openSocial(i) {
  const sc = SOCIALS[i]; if (!sc) return;
  let w = null; try { w = window.open(sc.url, '_blank'); if (w) w.opener = null; } catch (e) { }
  if (!w) toast(`Your browser blocked the new tab. The link is ${sc.url.replace(/^https:\/\//, '')}`);
  Sfx.play('ok');
}

// ---------------------------------------------------------------- main menu ("race programme")
const MODE_META = { arcade: '', tutorial: '', account: '', versus: '2P · SAME SCREEN', online: 'ROLLBACK', cpu: '', training: 'FREE RUN', replays: '', trials: '', moves: '', controls: 'KEYS · PADS', sound: 'VOLUME · DISPLAY' };
const TIPS = ['Hold back to block, even straight out of a dash', 'Motion + H does the EX version of a skill for 50 Spurt',
  'Mash L for an auto-combo: 5L › 5M › 5H › skill', 'Teio\'s skills chain into each other on hit', 'Cafe\'s Friend skills chain into each other once the Friend hits', 'McQueen deals PUNISH! damage to anyone caught recovering',
  'Vodka\'s Full Throttle is a hard knockdown: no quick rise', 'Daiwa can keep two shots on screen', 'Kitasan\'s Matsuri Uppercut is fully invincible',
  'Gold Ship can dash-cancel her normals for 50 Spurt', 'Suzuka is the only runner with an air dash', 'L+M is a throw. Throws beat blocking',
  'Counter Spurt: its own button (V · ; · LT) while blocking, for 50 Spurt', 'Caught by a command grab? Counter Spurt right away breaks it for 50 Spurt', 'Mashing throw tech while stuck in a combo locks your tech out for a moment', 'A combo can use each skill twice and each normal four times; after that it whiffs (REPEAT)', 'Getting hit or thrown clears your fireballs and potions off the screen', 'After a skill done with its motion, the same skill needs a moment (1/6 s) before it can come out again', 'Press ` in a match to show hitboxes', 'Replays are saved automatically after every match'];
function ticker(y) {
  ctx.fillStyle = 'rgba(24,11,42,.92)'; ctx.fillRect(0, y, W, 28);
  slant(-8, y, 108, 28, 10, PAL.gold); label('TRACK NEWS', 10, y + 14, 15, PAL.ink, 'left', 800, true);
  ctx.save(); ctx.beginPath(); ctx.rect(118, y, W - 118, 28); ctx.clip();
  const s = TIPS.join('     ●     '); ctx.font = font(15, 600, false);
  const w = ctx.measureText(s + '     ●     ').width, off = (UI.t * 1.1) % w;
  for (let k = 0; k < 3; k++) label(s + '     ●     ', 130 - off + k * w, y + 15, 15, '#efe8fb', 'left', 600);
  ctx.restore();
}
const MODE_LIST = 8;   // modes in the big list; the rest sit in the stage bar along the bottom
function modeMeta(id) {
  let meta = MODE_META[id] || '';
  if (id === 'cpu') meta = `◀ ${CPU_NAMES[cpuLevel]} ▶`;
  if (id === 'replays') meta = `${loadStored().length} SAVED`;
  if (id === 'moves') meta = `${ROSTER.length} RUNNERS`;
  if (id === 'tutorial') meta = `${tutDone.length} / ${LESSONS.length} LESSONS`;
  if (id === 'arcade') { const n = ROSTER.filter(c => arcRecord(c).clears).length; meta = `${n} / ${ROSTER.length} CLEARED`; }
  if (id === 'account') meta = acctName() ? acctName().toUpperCase() : ACCT.on ? 'GUEST' : 'OFF';
  if (id === 'trials') { const t = ROSTER.reduce((s, c) => s + (trialDone[c] || []).length, 0), n = ROSTER.reduce((s, c) => s + trialsFor(c).length, 0); meta = `${t} / ${n} CLEARED`; }
  return meta;
}
function drawMode() {
  const cid = ROSTER[Math.floor(UI.t / 300) % ROSTER.length], c = CHARS[cid];
  menuBg(0.62, c.color);
  stripes(500, c.color, 270);
  const [lab, id, desc] = MODES[UI.modeIdx];
  ghostText(lab, -8, HGT - 64, fitDisp(lab, W + 40, 170));
  // the runner of the moment, on her colour band
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(660, 476, 130, 16, 0, 0, 7); ctx.fill();
  drawSpr(cid, 0, '800', Math.floor(UI.t / 9) % SPR[cid].anims['800'][1], 660, 480, -1, 5.6);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (!logoImg(140, 58, 230)) { disp('UMA', 30, 50, 44, '#fff', 'left', PAL.ink); disp('VERSUS', 140, 50, 44, PAL.gold, 'left', PAL.ink); }
  ctx.imageSmoothingEnabled = sm;
  // account chip
  const who = acctName() ? acctName().toUpperCase() : ACCT.on ? 'GUEST · SIGN IN' : 'GUEST';
  ctx.font = font(15, 800, true); const cw = ctx.measureText(who).width + 30;
  rrect(W - 24 - cw, 18, cw, 30, 15, 'rgba(24,10,44,.85)', 'rgba(255,255,255,.3)', 2); label(who, W - 24 - cw / 2, 33, 15, '#fff', 'center', 800, true);
  label(`Update ${VERSION} · build ${BUILD}`, W - 24, 62, 12, 'rgba(255,255,255,.5)', 'right', 600);
  // the big list
  let y = 132;
  MODES.slice(0, MODE_LIST).forEach(([l, mid, d], i) => {
    if (i !== UI.modeIdx) { disp(l, 34, y + 13, 21, 'rgba(255,255,255,.55)'); y += 31; return; }
    const fs = 40, tw = dispW(l, fs) + 64;
    y += 4;
    glow(ACCENT, 22, () => slant(28 + 6, y + 6, tw, 52, 12, ACCENT)); slant(28, y, tw, 52, 12, '#fff');
    horseshoe(56, y + 25, 9, ACCENT);
    disp(l, 74, y + 27, fs, PAL.ink);
    const meta = modeMeta(mid); if (meta) label((mid === 'versus' ? '♪ ' : '') + meta, 28 + tw + 24, y + 27, 16, '#fff', 'left', 800, true);
    label(d, 36, y + 70, 15, PAL.lilac, 'left', 600);
    y += 92;
  });
  // runner name, bottom right
  disp(nameOf(cid), W - 30, 410, fitDisp(nameOf(cid), 420, 32), '#fff', 'right', PAL.ink);
  label(`${c.arch} · ${(c.look.tauntLine || '').toUpperCase()}`, W - 30, 438, 17, PAL.gold, 'right', 800, true);
  // stage bar with the remaining modes
  const by = HGT - 58;
  ctx.fillStyle = PAL.navy2; ctx.fillRect(0, by, W, 58); ctx.fillStyle = ACCENT; ctx.fillRect(0, by, W, 4);
  penlights(28, by + 15, 9, 28, 8);
  let bx = 128;
  MODES.slice(MODE_LIST).forEach(([l], k) => {
    const i = MODE_LIST + k, s = i === UI.modeIdx; ctx.font = font(16, 800, true); const w = ctx.measureText(l).width + 30;
    if (s) { glow(ACCENT, 14, () => rrect(bx, by + 15, w, 30, 15, '#fff')); label(l, bx + w / 2, by + 30, 16, PAL.ink, 'center', 800, true); }
    else { rrect(bx, by + 15, w, 30, 15, null, 'rgba(255,255,255,.35)', 2); label(l, bx + w / 2, by + 30, 16, '#e8e0f6', 'center', 800, true); }
    bx += w + 10;
  });
  const bar = UI.modeIdx >= MODE_LIST;
  label(bar ? MODES[UI.modeIdx][2] : '↑ ↓ choose  ·  F confirm', W - 24, by + 30, 14, '#cbbfe6', 'right', 600);
  if (bar) label('← → choose  ·  F confirm  ·  ↑ back to the list', 28, by - 12, 13, PAL.dim, 'left', 600);
}

// ---------------------------------------------------------------- character select ("entry")
// the starting gate: one stall per runner plus "random" at the end, sized to fit the roster
const STALL = () => { const n = ROSTER.length + 1, pitch = Math.min(98, Math.floor(930 / n)); return { n, pitch, w: pitch - 6, x0: Math.round((W - n * pitch) / 2) + 3 }; };
function stallX(i) { const S = STALL(); return S.x0 + i * S.pitch; }
function drawStalls(cursors) {   // cursors: [{i, col, tag}]; slot ROSTER.length is "random"
  const S = STALL(), w = S.w, h = 112, y = 54, fs = Math.min(80, w - 8);
  for (let i = 0; i <= ROSTER.length; i++) {
    const x = stallX(i), hot = cursors.filter(c => c.i === i), tagW = Math.min(38, w / 2);
    const tags = () => hot.forEach((c, k) => {
      ctx.strokeStyle = c.col; ctx.lineWidth = 4; ctx.strokeRect(x - 2 - k * 4, y - 2 - k * 4, w + 4 + k * 8, h + 4 + k * 8);
      slant(k ? x + w - tagW + 4 : x - 6, y - 22 - k * 4, tagW, 18, 6, c.col); label(c.tag, k ? x + w - tagW / 2 + 6 : x - 6 + tagW / 2 + 3, y - 13 - k * 4, 14, '#fff', 'center', 900, true);
    });
    if (i === ROSTER.length) {   // random stall
      rrect(x - 4, y - 4, w + 8, h + 8, 6, '#3a2a5c');
      ctx.fillStyle = vgradC(y, y + h, hot.length ? PAL.rose : '#2a1748', '#170c2c'); ctx.fillRect(x, y, w, h);
      ctx.save(); ctx.globalAlpha = 0.35; face(ROSTER[Math.floor(UI.t / 10) % ROSTER.length], 0, x + (w - fs) / 2, y + 18 + (80 - fs) / 2, fs, false); ctx.restore();
      txt('?', x + w / 2, y + 58, 50, '#fff', 'center', PAL.ink);
      ctx.fillStyle = PAL.rail; ctx.fillRect(x, y, w, 16); label('R', x + w / 2, y + 9, 15, PAL.ink, 'center', 900, true);
      ctx.fillStyle = 'rgba(24,11,42,.85)'; ctx.fillRect(x, y + h - 20, w, 20); label('RANDOM', x + w / 2, y + h - 9, 12, '#fff', 'center', 800, true);
      tags(); continue;
    }
    const cid = ROSTER[i], nm = nameOf(cid), g = GATE[i % 8];
    rrect(x - 4, y - 4, w + 8, h + 8, 6, '#3a2a5c');                       // metal frame
    ctx.fillStyle = vgradC(y, y + h, hot.length ? CHARS[cid].color : '#2a1748', '#170c2c'); ctx.fillRect(x, y, w, h);
    face(cid, 0, x + (w - fs) / 2, y + 18 + (80 - fs) / 2, fs, i >= ROSTER.length / 2);
    ctx.fillStyle = g[0]; ctx.fillRect(x, y, w, 16);
    label(String(i + 1), x + w / 2, y + 9, 16, g[1], 'center', 900, true);
    ctx.fillStyle = 'rgba(24,11,42,.85)'; ctx.fillRect(x, y + h - 20, w, 20);
    // long names wrap onto two short lines in narrow stalls
    const words = nm.split(' '), one = w >= 86 || words.length === 1;
    if (one) label(nm, x + w / 2, y + h - 9, nm.length > 12 ? 12 : 13.5, '#fff', 'center', 800, true);
    else { ctx.fillStyle = 'rgba(24,11,42,.85)'; ctx.fillRect(x, y + h - 32, w, 12); label(words[0], x + w / 2, y + h - 25, 10.5, '#fff', 'center', 800, true); label(words.slice(1).join(' '), x + w / 2, y + h - 10, 10.5, '#fff', 'center', 800, true); }
    for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(200,210,240,.18)'; ctx.fillRect(x + 8 + k * (w - 16) / 3, y + 16, 2, h - 36); }   // gate bars
    tags();
  }
}
const RANKS = [['D', '#6aa8ff'], ['C', '#5fd17a'], ['B', '#ff9b4a'], ['A', '#ff6fa6'], ['S', '#f6c343']];
function rankBadge(v, x, y) {   // Umamusume-style stat rank letter
  const [r, c] = RANKS[Math.max(0, Math.min(4, v - 1))];
  rrect(x - 10, y - 9, 20, 18, 5, c); disp(r, x, y + 1, 13, PAL.ink, 'center');
}
function vgradC(y0, y1, a, b) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function drawEntryCard(side, cid, done, who, pal, extra) {
  if (!cid) {   // random
    const x0 = side === 0 ? 16 : 486, y0 = 186;
    panel(x0, y0, 458, 306, side === 0 ? PAL.p1 : PAL.p2);
    const rc = ROSTER[Math.floor(UI.t / 6) % ROSTER.length];
    ctx.save(); ctx.globalAlpha = 0.25; drawSpr(rc, 0, '800', 0, side === 0 ? x0 + 110 : x0 + 348, y0 + 280, side === 0 ? 1 : -1, 4); ctx.restore();
    slant(side === 0 ? x0 + 214 : x0 + 18, y0 + 14, 90, 22, 8, side === 0 ? PAL.p1 : PAL.p2); label(who, (side === 0 ? x0 + 214 : x0 + 18) + 12, y0 + 26, 15, '#fff', 'left', 900, true);
    txt('RANDOM', side === 0 ? x0 + 320 : x0 + 130, y0 + 120, 54, '#fff', 'center', PAL.ink);
    label('The gate draws a runner for you', side === 0 ? x0 + 320 : x0 + 130, y0 + 168, 15, '#e8e0f6', 'center', 600);
    if (extra) label(extra, side === 0 ? x0 + 320 : x0 + 130, y0 + 190, 13, PAL.dim, 'center', 600);
    return;
  }
  const c = CHARS[cid], x0 = side === 0 ? 16 : 486, y0 = 186, w = 458, h = 306, flip = side === 1;
  panel(x0, y0, w, h, side === 0 ? PAL.p1 : PAL.p2);
  const sx = flip ? x0 + w - 110 : x0 + 110;
  ctx.fillStyle = 'rgba(47,174,91,.35)'; ctx.beginPath(); ctx.ellipse(sx, y0 + h - 30, 90, 14, 0, 0, 7); ctx.fill();
  const pose = done ? c.win : '800', nf = SPR[cid].anims[pose][1];
  drawSpr(cid, pal || 0, pose, Math.floor(UI.t / 8) % nf, sx, y0 + h - 26, flip ? -1 : 1, 4);
  const ix = flip ? x0 + 18 : x0 + 214, iw = 226;
  slant(ix, y0 + 14, 90, 22, 8, side === 0 ? PAL.p1 : PAL.p2); label(who, ix + 12, y0 + 26, 15, '#fff', 'left', 900, true);
  gateTag(gateOf(cid), ix + iw - 28, y0 + 12, 26);
  plate(ix - 4, y0 + 44, iw + 8, 38, c.color, 10); disp(nameOf(cid), ix + 10, y0 + 64, fitDisp(nameOf(cid), iw - 10, 22), '#fff', 'left', 'rgba(0,0,0,.35)');
  label(c.arch, ix + 2, y0 + 96, 16, PAL.gold, 'left', 800, true);
  label((done ? '' : '▲▼ ') + PALETTES[(pal || 0) % PALETTES.length].name, ix + iw, y0 + 96, 13, done ? PAL.dim : '#cfe3ff', 'right', 800, true);
  const rt = RATING[cid] || [3, 3, 3, 3], hp = Math.max(1, Math.min(5, Math.round((c.hp - 7500) / 600)));
  [['HEALTH', hp], ['SPEED', rt[0]], ['POWER', rt[1]], ['RANGE', rt[2]], ['DIFFICULTY', rt[3]]].forEach(([n, v], k) => {
    const yy = y0 + 118 + k * 20; label(n, ix + 2, yy, 13, PAL.dim, 'left', 700); meterBar(ix + 86, yy - 6, 112, 12, v, k === 4 ? PAL.rose : PAL.turf);
    if (k < 4) rankBadge(v, ix + 214, yy);
  });
  ctx.font = font(14, 600, false); ctx.fillStyle = '#e8e0f6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  wrap(c.blurb, ix + 2, y0 + 230, iw, 18);
  if (extra) label(extra, ix + 2, y0 + h - 16, 13, PAL.dim, 'left', 600);
  if (done) {   // "ENTERED" stamp
    ctx.save(); ctx.translate(sx, y0 + 64); ctx.rotate(-0.18);
    rrect(-74, -22, 148, 44, 6, 'rgba(255,255,255,.08)', PAL.gold, 4); txt('ENTERED', 0, 1, 30, PAL.gold, 'center', PAL.ink); ctx.restore();
  }
}
function drawSelect() {
  menuBg(0.62);
  const twoP = UI.pendingMode === 'versus';
  topBar('ENTRY · CHOOSE YOUR UMAMUSUME', { versus: 'VERSUS', cpu: `VS CPU · ${CPU_NAMES[cpuLevel]}`, training: 'TRAINING', arcade: 'ARCADE' }[UI.pendingMode]);
  const cur = [{ i: UI.sel[0], col: PAL.p1, tag: '1P' }];
  if (twoP || UI.selDone[0]) cur.push({ i: UI.sel[1], col: PAL.p2, tag: twoP ? '2P' : UI.pendingMode === 'cpu' ? 'CPU' : 'DUM' });
  drawStalls(cur);
  const pals = matchPals(ROSTER[UI.sel[0]], ROSTER[UI.sel[1]], UI.pal);
  drawEntryCard(0, ROSTER[UI.sel[0]], UI.selDone[0], 'P1', pals[0]);
  const p2who = twoP ? 'P2' : UI.pendingMode === 'cpu' ? 'CPU' : 'DUMMY';
  if (UI.pendingMode === 'arcade') { drawArcPreview(ROSTER[UI.sel[0]]); if (UI.selExit) { drawSelExit(); return; } hintBar('← → choose    ·    ↑ ↓ colour    ·    F / Enter start the run    ·    H / Esc back'); return; }
  drawEntryCard(1, ROSTER[UI.sel[1]], UI.selDone[1], p2who, pals[1], !twoP && !UI.selDone[0] ? 'Pick your runner first' : '');
  if (UI.selExit) { drawSelExit(); return; }
  hintBar(twoP ? 'P1: A / D + F, W / S colour    ·    P2: ← / → + J, ↑ / ↓ colour    ·    H cancel / back    ·    Esc back' : (UI.selDone[0] ? 'Now pick the opponent    ·    ↑ ↓ colour    ·    H to go back' : '← → choose    ·    ↑ ↓ colour    ·    F / Enter confirm    ·    H / Esc back'));
}

function drawSelExit() {   // "leave character select?" prompt
  ctx.fillStyle = 'rgba(16,6,32,.72)'; ctx.fillRect(0, 0, W, HGT);
  const x = W / 2 - 230, y = 170;
  panel(x, y, 460, 190, ACCENT);
  disp('LEAVE CHARACTER SELECT?', W / 2, y + 44, fitDisp('LEAVE CHARACTER SELECT?', 400, 22), '#fff', 'center', PAL.ink);
  label('Your picks are cleared and you go back to the main menu.', W / 2, y + 80, 15, PAL.lilac, 'center', 600);
  ['STAY', 'LEAVE'].forEach((t, k) => {
    const s = k === UI.selExitIdx, bx = W / 2 - 200 + k * 210;
    rowSlant(bx, y + 112, 180, 46, 12, s, 'rgba(34,17,60,.9)');
    disp(t, bx + 96, y + 136, 22, s ? PAL.ink : '#fff', 'center');
  });
  hintBar('← → choose    ·    confirm (F / Enter / Ⓐ)    ·    back (H / Esc / Ⓑ) to stay');
}
// Arcade, on the select screen: what the run looks like for the runner under the cursor
function drawArcPreview(cid) {
  const x0 = 486, y0 = 186; panel(x0, y0, 458, 306, PAL.rose);
  txt('ARCADE', x0 + 229, y0 + 40, 40, '#fff');
  label('7 races against the CPU, each one harder,', x0 + 229, y0 + 86, 16, '#e8e0f6', 'center', 600);
  label('then the final race against your rival.', x0 + 229, y0 + 108, 16, '#e8e0f6', 'center', 600);
  if (!cid) { label('Your rival is drawn with your runner.', x0 + 229, y0 + 160, 15, PAL.dim, 'center', 600); return; }
  const r = arcRecord(cid), rv = RIVAL[cid];
  label('RIVAL', x0 + 40, y0 + 150, 14, PAL.rose, 'left', 900, true);
  face(rv, 0, x0 + 40, y0 + 162, 56, true); label(nameOf(rv), x0 + 106, y0 + 190, 22, '#fff', 'left', 900, true);
  label('YOUR BEST', x0 + 40, y0 + 246, 14, PAL.gold, 'left', 900, true);
  label(r.clears ? `${mmss(r.best)}  ·  ${r.cont} continue${r.cont === 1 ? '' : 's'}  ·  cleared ${r.clears}×` : 'not cleared yet', x0 + 40, y0 + 270, 17, r.clears ? '#fff' : PAL.dim, 'left', 800, true);
}
// ---------------------------------------------------------------- course select
const COURSE_N = () => STAGE_LIST.length + 1;   // + random
function drawStageSelect() {
  menuBg(0.7);
  topBar('COURSE SELECT', `${nameOf(ROSTER[UI.sel[0]] || 'spe')}  vs  ${nameOf(ROSTER[UI.sel[1]] || 'spe')}`);
  const i = UI.stageIdx, rnd = i === STAGE_LIST.length, show = rnd ? Math.floor(UI.t / 20) % STAGE_LIST.length : i;
  // big preview
  const px = 170, py = 56, pw = 620, ph = 300;
  rrect(px - 6, py - 6, pw + 12, ph + 12, 8, '#3a2a5c');
  ctx.imageSmoothingEnabled = true; ctx.drawImage(STAGES[show].thumb, 0, 40, W, HGT - 40, px, py, pw, ph); ctx.imageSmoothingEnabled = false;
  if (rnd) { ctx.fillStyle = 'rgba(24,11,42,.55)'; ctx.fillRect(px, py, pw, ph); txt('?', W / 2, py + ph / 2, 120, PAL.gold); }
  ctx.fillStyle = 'rgba(24,11,42,.82)'; ctx.fillRect(px, py + ph - 56, pw, 56);
  label(rnd ? 'RANDOM COURSE' : STAGE_LIST[i].name, px + 18, py + ph - 36, 30, '#fff', 'left', 900, true);
  label(rnd ? 'LEAVE IT TO THE DRAW' : STAGE_LIST[i].sub, px + 18, py + ph - 13, 15, PAL.gold, 'left', 700, true);
  ledText(`RACE ${String(i + 1)}`, px + pw - 18, py + 22, 3, PAL.led, 'right', 'rgba(255,180,58,.12)');
  // course cards
  const n = COURSE_N(), cw = 150, gap = 14, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, cy = 384;
  for (let k = 0; k < n; k++) {
    const x = x0 + k * (cw + gap), s = k === i, r = k === STAGE_LIST.length;
    rrect(x - 3, cy - 3, cw + 6, 90, 6, s ? PAL.gold : '#3a2a5c');
    if (r) { ctx.fillStyle = '#141b3a'; ctx.fillRect(x, cy, cw, 84); txt('RANDOM', x + cw / 2, cy + 42, 26, '#fff'); }
    else { ctx.imageSmoothingEnabled = true; ctx.drawImage(STAGES[k].thumb, 0, 60, W, HGT - 60, x, cy, cw, 84); ctx.imageSmoothingEnabled = false; }
    gateTag(k, x + 4, cy + 4, 22);
    if (!s) { ctx.fillStyle = 'rgba(24,11,42,.4)'; ctx.fillRect(x, cy, cw, 84); }
  }
  hintBar('← → choose a course    ·    F / Enter start    ·    H / Esc back to runners');
}

// ---------------------------------------------------------------- VS splash ("race card")
function drawVS() {
  const t = UI.vsT, k = Math.min(1, t / 14), e = 1 - Math.pow(1 - k, 3);
  const [c1, c2] = [ROSTER[UI.sel[0]], ROSTER[UI.sel[1]]];
  drawStage(STAGE_W / 2, UI.vsStage); ctx.fillStyle = 'rgba(24,11,42,.55)'; ctx.fillRect(0, 0, W, HGT);
  ctx.save(); ctx.globalAlpha = 0.92;
  ctx.fillStyle = CHARS[c1].color; ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(W * 0.56 * e, 60); ctx.lineTo(W * 0.44 * e, 440); ctx.lineTo(0, 440); ctx.fill();
  ctx.fillStyle = CHARS[c2].color; ctx.beginPath(); ctx.moveTo(W, 60); ctx.lineTo(W - W * 0.44 * e, 60); ctx.lineTo(W - W * 0.56 * e, 440); ctx.lineTo(W, 440); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.15; for (let i = 0; i < 14; i++) slant(-200 + i * 90 + (t * 6) % 90, 60, 30, 380, 120, '#fff'); ctx.restore();
  drawSpr(c1, UI.pal ? UI.pal[0] : 0, '800', Math.floor(t / 8) % SPR[c1].anims['800'][1], -160 + 400 * e, 452, 1, 5.2);
  drawSpr(c2, matchPals(c1, c2, UI.pal)[1], '800', Math.floor(t / 8) % SPR[c2].anims['800'][1], W + 160 - 400 * e, 452, -1, 5.2);
  plate(30, 352, 330, 46, PAL.ink, 14); disp(nameOf(c1), 50, 376, fitDisp(nameOf(c1), 250, 24), '#fff', 'left'); gateTag(gateOf(c1), 320, 361, 28);
  plate(W - 370, 352, 330, 46, PAL.ink, 14); disp(nameOf(c2), W - 60, 376, fitDisp(nameOf(c2), 250, 24), '#fff', 'right'); gateTag(gateOf(c2), W - 352, 361, 28);
  slant(40, 404, 150, 22, 8, 'rgba(24,11,42,.85)'); label(CHARS[c1].arch, 54, 415, 16, PAL.gold, 'left', 800, true);
  slant(W - 196, 404, 150, 22, 8, 'rgba(24,11,42,.85)'); label(CHARS[c2].arch, W - 60, 415, 16, PAL.gold, 'right', 800, true);
  const vs = Math.min(1, Math.max(0, (t - 10) / 10));
  ctx.save(); ctx.translate(W / 2, 236); ctx.scale(2 - vs, 2 - vs); ctx.globalAlpha = vs; txt('VS', 0, 0, 120, PAL.gold, 'center', PAL.ink); ctx.restore();
  ctx.fillStyle = 'rgba(24,11,42,.94)'; ctx.fillRect(0, 0, W, 60); ctx.fillRect(0, 440, W, 100);
  ledText('RACE CARD', 24, 30, 3, PAL.led, 'left', 'rgba(255,180,58,.1)');
  label(STAGE_LIST[UI.vsStage].name, W - 24, 24, 22, '#fff', 'right', 900, true);
  label(STAGE_LIST[UI.vsStage].sub, W - 24, 46, 14, PAL.gold, 'right', 700, true);
  railDivider(0, 456, W); penlights(24, 478, 8, 26, 7); penlights(W - 24 - 5 * 15 + 7, 478, 8, 26, 7);
  label({ versus: 'VERSUS · BEST OF 3', cpu: `VS CPU · ${CPU_NAMES[cpuLevel]} · BEST OF 3`, training: 'TRAINING' }[UI.pendingMode] || '', W / 2, 492, 20, '#fff', 'center', 800, true);
  if (t > 20) label('press confirm to skip', W / 2, 518, 13, PAL.dim, 'center');
}

// ---------------------------------------------------------------- in-game HUD
function hpBar(p, i) {
  const flip = i === 1, bw = 330, bh = 22, top = 16, k = 14, side = flip ? PAL.p2 : PAL.p1;
  const x = flip ? W - 92 - bw : 92;
  // portrait in the runner's colour
  const mx = flip ? W - 80 : 12, g = gateOf(p.cid);
  glow(side, 10, () => rrect(mx - 2, 8, 70, 70, 12, side));
  rrect(mx + 1, 11, 64, 64, 10, vgradC(11, 75, p.c.color, PAL.navy));
  face(p.cid, p.pal, mx + 3, 13, 60, flip);
  rrect(flip ? mx + 44 : mx + 1, 59, 22, 16, 4, GATE[g % 8][0]); label(String(g + 1), flip ? mx + 55 : mx + 12, 68, 13, GATE[g % 8][1], 'center', 900, true);
  // bar body, skewed toward the timer, with the side colour as a drop shadow
  // every layer shares one slanted edge line, padded outward, so the outline stays an even width
  const slope = y => k * (top + bh - y) / bh;
  const poly = (pad = 0, dx = 0, dy = 0) => {
    const y0 = top - pad + dy, y1 = top + bh + pad + dy; ctx.beginPath();
    if (!flip) { ctx.moveTo(x - pad + dx, y0); ctx.lineTo(x + bw + pad + dx + slope(y0 - dy), y0); ctx.lineTo(x + bw + pad + dx + slope(y1 - dy), y1); ctx.lineTo(x - pad + dx, y1); }
    else { ctx.moveTo(x - pad + dx - slope(y0 - dy), y0); ctx.lineTo(x + bw + pad + dx, y0); ctx.lineTo(x + bw + pad + dx, y1); ctx.lineTo(x - pad + dx - slope(y1 - dy), y1); }
    ctx.closePath(); };
  ctx.fillStyle = side; poly(3, flip ? -5 : 5, 5); ctx.fill();
  ctx.fillStyle = '#fff'; poly(3); ctx.fill();
  ctx.fillStyle = PAL.navy2; poly(); ctx.fill();
  const frac = v => Math.max(0, Math.min(1, v / p.c.hp)) * (bw + k);   // + k so a full bar fills the slanted tip
  ctx.save(); poly(); ctx.clip();
  ctx.fillStyle = '#ff5070'; flip ? ctx.fillRect(x + bw - frac(p.redHp), top, frac(p.redHp) + 20, bh) : ctx.fillRect(x - 20, top, frac(p.redHp) + 20, bh);
  const low = p.hp / p.c.hp < 0.3, hw = frac(p.dispHp);
  const grd = ctx.createLinearGradient(0, top, 0, top + bh);
  grd.addColorStop(0, low ? '#ffc56b' : '#fff7b0'); grd.addColorStop(0.55, low ? '#ff8a2a' : '#f6c343'); grd.addColorStop(1, low ? '#d9531a' : '#d99a14');
  ctx.fillStyle = grd; flip ? ctx.fillRect(x + bw - hw, top, hw + 20, bh) : ctx.fillRect(x - 20, top, hw + 20, bh);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 20, top + 3, bw + 40, 2);
  for (let f = 1; f < 10; f++) { ctx.fillStyle = 'rgba(27,16,48,.3)'; ctx.fillRect(x + f * bw / 10, top + (f % 5 ? 14 : 5), 2, bh); }   // furlong ticks
  ctx.restore();
  // name tag in the runner's colour, round wins as penlights
  const nm = nameOf(p.cid), fs = fitDisp(nm, 230, 15), tw = dispW(nm, fs) + 26, ny = top + bh + 9;
  const nx = flip ? x + bw - tw : x;
  slant(nx, ny, tw, 24, flip ? -8 : 8, p.c.color);
  disp(nm, flip ? nx + tw - 13 : nx + 13, ny + 13, fs, '#fff', flip ? 'right' : 'left', 'rgba(0,0,0,.35)');
  for (let w = 0; w < 2; w++) {
    const px = flip ? nx - 18 - w * 14 : nx + tw + 12 + w * 14, on = p.wins > w;
    if (on) glow(PAL.gold, 10, () => rrect(px, ny + 2, 8, 20, 4, PAL.gold)); else rrect(px, ny + 2, 8, 20, 4, 'rgba(255,255,255,.22)');
  }
}
function spurtGauge(p, i) {
  const flip = i === 1, segW = 112, mh = 16, my = HGT - 30, gap = 6, k = flip ? -10 : 10;
  const full = p.meter >= 100, mx = flip ? W - 64 - 2 * segW - gap : 64;
  for (let sgi = 0; sgi < 2; sgi++) {   // two halves: each one is an EX
    const sx = mx + (flip ? (1 - sgi) : sgi) * (segW + gap), v = Math.max(0, Math.min(1, (p.meter - sgi * 50) / 50));
    slant(sx - 2 - k * 2 / mh, my - 2, segW + 4, mh + 4, k * (mh + 4) / mh, '#fff');   // outline parallel to the fill
    slant(sx, my, segW, mh, k, PAL.navy2);
    if (v > 0) {
      ctx.save(); slant(sx, my, segW, mh, k, 'rgba(0,0,0,0)'); ctx.clip();
      const c = v >= 1 ? (full && !SET.calm && G.frameCount % 16 < 8 ? '#fff' : PAL.gold) : '#c99a2a';
      const span = segW + Math.abs(k) + 12;   // reaches the slanted tip when full
      ctx.fillStyle = c; flip ? ctx.fillRect(sx + segW + 12 - span * v, my, span * v, mh) : ctx.fillRect(sx - 12, my, span * v, mh);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(sx - 12, my + 2, segW + 24, 2);
      ctx.restore();
    }
  }
  const n = Math.floor(p.meter / 50);
  disp(String(n), flip ? W - 34 : 34, my + 7, 24, n ? PAL.gold : 'rgba(255,255,255,.55)', 'center', PAL.ink);
  const lab = full ? 'LAST SPURT!' : `SPURT ${Math.floor(p.meter)}`;
  label(lab, flip ? mx + 2 * segW + gap : mx, my - 11, 14, full ? PAL.gold : '#fff', flip ? 'right' : 'left', 900, true);
  // shortcut cooldown chips
  ['5S', '6S', '4S', '2S', 'jS'].filter(id => p.c.moves[id]).forEach((id, q) => {
    const m = p.c.moves[id], cw = 24, bx = flip ? mx - 12 - (q + 1) * (cw + 2) : mx + 2 * segW + gap + 16 + q * (cw + 2), by = my - 6;
    const rem = Math.max((p.cd[id] || 0) / m.cd, Math.min(1, (p.tcd && p.tcd[id] || 0) / 60));   // simple-input cooldown, or the short motion-input one
    rrect(bx, by, cw, 24, 6, '#fff'); rrect(bx + 2, by + 2, cw - 4, 20, 5, rem > 0 ? '#3a2a5c' : p.c.color);
    if (rem > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx + 2, by + 2, (cw - 4) * rem, 20); }
    label({ '5S': 'S', '6S': '→S', '4S': '←S', '2S': '↓S', 'jS': 'jS' }[id], bx + cw / 2, by + 13, 12, rem > 0 ? '#8a7aa8' : '#fff', 'center', 800, true);
  });
  // Counter Spurt chip: gold when it's ready (cooldown over and 50 Spurt banked)
  {
    const q = ['5S', '6S', '4S', '2S', 'jS'].filter(id => p.c.moves[id]).length, cw = 28;
    const bx = flip ? mx - 12 - q * 26 - cw - 2 : mx + 2 * segW + gap + 16 + q * 26 + 2, by = my - 6;
    const rem = (p.gcCd || 0) / GC_CD, ready = rem <= 0 && p.meter >= 50;
    rrect(bx, by, cw, 24, 6, '#fff'); rrect(bx + 2, by + 2, cw - 4, 20, 5, ready ? PAL.gold : '#3a2a5c');
    if (rem > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx + 2, by + 2, (cw - 4) * rem, 20); }
    label('CS', bx + cw / 2, by + 13, 12, ready ? PAL.ink : '#8a7aa8', 'center', 900, true);
  }
}
function comboCounter(p, i) {
  const o = opp(p);
  if (!(o.combo >= 2 && ['hit', 'airHit', 'cineHit', 'down'].includes(o.state))) { p.comboShow = 0; return; }
  p.comboShow = Math.min(10, (p.comboShow || 0) + 1);
  const flip = i === 1, e = 1 - Math.pow(1 - p.comboShow / 10, 3), x = flip ? W - 26 + (1 - e) * 140 : 26 - (1 - e) * 140, y = 214;
  ctx.save(); ctx.globalAlpha = e; ctx.translate(x, y); ctx.rotate(flip ? 0.05 : -0.05);
  const n = String(o.combo), fs = 46;
  ctx.font = `${fs}px ${FDISP}`; const nw = ctx.measureText(n).width;
  const al = flip ? 'right' : 'left', sx = flip ? -1 : 1;
  disp(n, 0, 0, fs, PAL.gold, al, ACCENT === PAL.rose ? PAL.rose : ACCENT);
  disp('HITS', sx * (nw + 10), 6, 22, '#fff', al, PAL.ink);
  label(`${o.comboDmg} DMG  ·  NEXT ${Math.round(comboScale(o) * 100)}%`, 0, 36, 15, '#fff', al, 800, true);
  if (o.limitHit) label('COMBO LIMIT', 0, 56, 14, '#9fe3ff', al, 900, true);
  ctx.restore();
}
// ---------------------------------------------------------------- callouts: skill-activation banners on each player's side
const CALLOUTS = [];
let CALLOUT_FIRST = -1;
const CO_LIFE = 84, CO_COL = { atk: ['#f6c343', '#ff8a3c'], def: ['#4aa8ff', '#7fe0ff'], spurt: ['#ff4f8b', '#ffb0d0'], bad: ['#8a7aa8', '#b9a6e6'] };
function calloutsReset() { CALLOUTS.length = 0; CALLOUT_FIRST = -1; }
function pushCallout(side, text, kind) {
  if (kind === 'first') { if (CALLOUT_FIRST === G.round || G.mode === 'training') return; CALLOUT_FIRST = G.round; kind = 'atk'; }
  const old = CALLOUTS.find(c => c.side === side && c.text === text);
  if (old) { old.born = G.frameCount; return; }
  CALLOUTS.push({ side, text, kind, born: G.frameCount });
  const mine = CALLOUTS.filter(c => c.side === side);
  if (mine.length > 2) CALLOUTS.splice(CALLOUTS.indexOf(mine[0]), 1);
}
function coIcon(kind, x, y, r) {
  if (kind === 'def') {   // shield
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y - r * 0.6); ctx.lineTo(x + r * 0.5, y - r * 0.4); ctx.lineTo(x + r * 0.45, y + r * 0.1);
    ctx.quadraticCurveTo(x + r * 0.3, y + r * 0.5, x, y + r * 0.65); ctx.quadraticCurveTo(x - r * 0.3, y + r * 0.5, x - r * 0.45, y + r * 0.1); ctx.lineTo(x - r * 0.5, y - r * 0.4); ctx.closePath(); ctx.fill();
  } else if (kind === 'spurt') horseshoe(x, y + 1, r * 0.42, '#fff');
  else star4(x, y, r * 0.65, '#fff');
}
function drawCallouts() {
  for (let i = CALLOUTS.length - 1; i >= 0; i--) { const a = G.frameCount - CALLOUTS[i].born; if (a > CO_LIFE || a < -10) CALLOUTS.splice(i, 1); }
  for (const side of [0, 1]) CALLOUTS.filter(c => c.side === side).forEach((c, k) => {
    const a = Math.max(0, G.frameCount - c.born), e = 1 - Math.pow(1 - Math.min(1, a / 8), 3), out = a > CO_LIFE - 12 ? (CO_LIFE - a) / 12 : 1;
    const [c1, c2] = CO_COL[c.kind] || CO_COL.atk, fs = 19, h = 36, tw = dispW(c.text, fs) + 66, y = 92 + k * 44;
    const x = side === 0 ? -tw + (tw + 12) * e : W - 12 - tw * e;
    ctx.save(); ctx.globalAlpha = Math.max(0, out);
    glow(c1, 14, () => rrect(x, y, tw, h, h / 2, '#fff', c1, 3));
    const ix = side === 0 ? x + h / 2 : x + tw - h / 2, g = ctx.createLinearGradient(ix, y, ix, y + h); g.addColorStop(0, c2); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, y + h / 2, h / 2 - 4, 0, 7); ctx.fill();
    coIcon(c.kind, ix, y + h / 2, h / 2 - 4);
    disp(c.text, side === 0 ? x + h + 6 : x + tw - h - 6, y + h / 2 + 1, fs, PAL.ink, side === 0 ? 'left' : 'right');
    if (a < 14 && !SET.calm) for (let q = 0; q < 4; q++) { const t = a / 14; star4(x + tw * (0.2 + q * 0.22), y - 4 - t * 14 + (q % 2) * 40, 5 * (1 - t) + 1, q % 2 ? c2 : '#fff'); }   // a little sparkle on entry
    ctx.restore();
  });
}
function drawHUD() {
  ACCENT = PAL.rose;
  ctx.fillStyle = 'rgba(24,11,42,.45)'; ctx.fillRect(0, 0, W, 4);
  const sh = ctx.createLinearGradient(0, 0, 0, 96); sh.addColorStop(0, 'rgba(22,10,40,.6)'); sh.addColorStop(1, 'rgba(22,10,40,0)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, W, 96);
  G.p.forEach((p, i) => { hpBar(p, i); spurtGauge(p, i); comboCounter(p, i); });
  drawCallouts();
  // timer pill
  const low = G.timer <= 10 && G.mode !== 'training';
  glow(low ? '#ff5a4a' : ACCENT, 16, () => rrect(W / 2 - 46, 8, 92, 62, 31, PAL.navy2, low ? '#ff5a4a' : ACCENT, 3));
  const tv = G.mode === 'training' ? '∞' : String(G.timer).padStart(2, '0');
  disp(tv, W / 2, 33, 30, low ? '#ff6a5a' : '#fff', 'center');
  label(G.mode === 'training' ? 'TRAINING' : G.p.every(p => p.wins === 1) ? 'FINAL ROUND' : `ROUND ${G.round}`, W / 2, 57, 11, PAL.lilac, 'center', 800, true);
}
function drawTrainingHUD() {
  const t = G.training;
  if (typeof Net !== 'undefined' && Net.practice) {   // practising while the online room waits
    const pulse = 0.6 + 0.4 * Math.sin(G.frameCount / 12);
    rrect(W / 2 - 170, 172, 340, 24, 12, 'rgba(20,10,40,.85)'); label(`ROOM ${Net.code} · WAITING FOR AN OPPONENT`, W / 2, 185, 13, `rgba(246,195,67,${pulse})`, 'center', 900, true);
  }
  panel(W / 2 - 250, 84, 500, 82, PAL.turf);
  const rs = { off: '', recording: '   ● REC', ready: '   [8] play', playing: '   ▶ PLAYBACK' }[TOOLS.recState];
  label(`[1] Dummy: ${t.dummy.toUpperCase()}    [2] Guard: ${t.block.toUpperCase()}    [3] Hitboxes: ${G.showBoxes ? 'ON' : 'OFF'}    [4] Reset`, W / 2, 100, 13.5, '#efe8fb', 'center', 700);
  label(`[5] Inputs: ${TOOLS.inputs ? 'ON' : 'OFF'}    [6] Frame meter: ${TOOLS.meter ? 'ON' : 'OFF'}    [7] Record dummy${rs}`, W / 2, 118, 13.5, TOOLS.recState === 'recording' ? '#ff8a8a' : '#efe8fb', 'center', 700);
  if (G.adv && G.adv.val !== null) {
    const v = G.adv.val, who = G.adv.a.side === 0 ? 'P1' : 'P2';
    ledText(`${who} ${v >= 0 ? '+' : ''}${v}`, W / 2, 137, 2.4, v > 0 ? '#7dff9a' : v < 0 ? '#ff7d7d' : '#fff');
  } else label('frame advantage —', W / 2, 137, 13, PAL.dim, 'center');
  const di = G.dmgInfo, d = G.p[1];
  label(di ? `last hit ${di.last}  ·  combo ${di.combo} (${di.hits} hit${di.hits > 1 ? 's' : ''})  ·  scaling ${Math.round(comboScale(d) * 100)}%  ·  juggle ${Math.min(d.jug, JUG_MAX)}/${JUG_MAX}` : 'hit the dummy to see damage', W / 2, 155, 13, di ? PAL.gold : PAL.dim, 'center', 700);
}

// round intro: the starting gate opens on "GO!"
function drawRoundIntro() {
  const t = G.phaseT, final = G.p.every(p => p.wins === 1);
  if (t < 60) {
    const e = Math.min(1, t / 10), out = t > 50 ? (t - 50) / 10 : 0;
    ctx.save(); ctx.globalAlpha = 1 - out;
    ctx.fillStyle = 'rgba(24,11,42,.72)'; ctx.fillRect(0, HGT / 2 - 64, W * e, 128);
    railDivider(0, HGT / 2 - 64, W * e); railDivider(0, HGT / 2 + 58, W * e);
    ledText(final ? 'FINAL ROUND' : `RACE ${G.round}`, W / 2, HGT / 2 - 34, 3, PAL.led, 'center', 'rgba(255,180,58,.1)');
    txt(final ? 'FINAL ROUND' : `ROUND ${G.round}`, W / 2 + (1 - e) * 200, HGT / 2 + 14, 72, '#fff', 'center', PAL.ink);
    ctx.restore(); return;
  }
  // gate stalls across the screen; the doors swing open at GO (frame 85)
  const open = t < 85 ? 0 : Math.min(1, (t - 85) / 8), gy = HGT / 2 - 70, gh = 140, n = 8, sw = W / n;
  if (open < 1) {
    for (let i = 0; i < n; i++) {
      const x = i * sw;
      ctx.fillStyle = '#c9ccd6'; ctx.fillRect(x, gy - 10, sw, 10); ctx.fillRect(x, gy - 10, 6, gh + 10);
      ctx.fillStyle = GATE[i][0]; ctx.fillRect(x + 6, gy - 10, sw - 6, 10);
      label(String(i + 1), x + sw / 2, gy - 4, 10, GATE[i][1], 'center', 900, true);
      const dw = (sw - 6) / 2 * (1 - open);
      ctx.fillStyle = 'rgba(190,196,212,.92)'; ctx.fillRect(x + 6, gy, dw, gh); ctx.fillRect(x + sw - dw, gy, dw, gh);
      ctx.fillStyle = 'rgba(90,96,120,.8)'; for (let k = 1; k < 4; k++) { ctx.fillRect(x + 6, gy + k * gh / 4, dw, 3); ctx.fillRect(x + sw - dw, gy + k * gh / 4, dw, 3); }
    }
  }
  if (t < 85) txt('READY…', W / 2, HGT / 2, 64, '#fff', 'center', PAL.ink);
  else { const s = 1 + Math.max(0, 1 - (t - 85) / 6) * 0.8; ctx.save(); ctx.translate(W / 2, HGT / 2); ctx.scale(s, s); txt('GO!', 0, 0, 110, PAL.gold, 'center', PAL.ink); ctx.restore(); }
}
// KO: white flash + photo-finish line, then the round result
function drawKO() {
  const t = G.phaseT;
  if (t < 100) {
    if (t < 8 && !SET.calm) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - t / 8)})`; ctx.fillRect(0, 0, W, HGT); }
    const lx = W / 2;
    for (let y = 0; y < HGT; y += 20) { ctx.fillStyle = (y / 20) % 2 ? '#fff' : PAL.ink; ctx.fillRect(lx - 4, y, 8, 20); }
    const s = 1 + Math.max(0, 1 - t / 10) * 1.2;
    ctx.save(); ctx.translate(W / 2, HGT / 2); ctx.scale(s, s);
    txt(G.koType === 'ko' ? 'K.O.' : 'TIME UP', 0, 0, G.koType === 'ko' ? 120 : 96, G.koType === 'ko' ? '#ff4d5e' : PAL.gold, 'center', PAL.ink);
    ctx.restore();
    if (G.koType === 'ko') { slant(W / 2 - 150, HGT / 2 + 78, 300, 34, 10, 'rgba(24,11,42,.85)'); ledText('PHOTO FINISH', W / 2 + 5, HGT / 2 + 95, 2.6, PAL.led, 'center'); }
  } else if (G.posed) {
    const w = G.roundWinner, e = Math.min(1, (t - 100) / 10);
    ctx.fillStyle = 'rgba(24,11,42,.72)'; ctx.fillRect(0, HGT / 2 - 50, W * e, 100);
    if (w < 0) txt('DEAD HEAT', W / 2, HGT / 2, 60, '#fff', 'center', PAL.ink);
    else {
      plate(W / 2 - 230, HGT / 2 - 30, 460, 60, G.p[w].c.color, 16);
      txt(`${nameOf(G.p[w].cid)} WINS`, W / 2 + 8, HGT / 2 + 1, 44, '#fff', 'center', PAL.ink);
      if (G.p[w].hp === G.p[w].c.hp) { ctx.save(); ctx.translate(W / 2 + 200, HGT / 2 - 50); ctx.rotate(0.15); rrect(-62, -18, 124, 36, 5, PAL.gold); label('PERFECT', 0, 1, 26, PAL.ink, 'center', 900, true); ctx.restore(); }
    }
  }
}
// match result: winner on the podium, official result board
function drawResults() {
  ctx.fillStyle = 'rgba(24,10,44,.8)'; ctx.fillRect(0, 0, W, HGT);
  const w = G.p[0].wins >= 2 && G.p[1].wins >= 2 ? -1 : G.p[0].wins >= 2 ? 0 : 1;
  ACCENT = w < 0 ? PAL.rose : G.p[w].c.color; speedLines(); beams(0.16); sparkles(10);
  if (w >= 0) { stripes(150, G.p[w].c.color, 160); ghostText('WINNER', -6, HGT - 40, 170); }
  topBar('OFFICIAL RESULT', STAGE_LIST[G.stage || 0].name);
  if (w < 0) { txt('DEAD HEAT', W / 2, 220, 80, '#fff'); }
  else {
    const p = G.p[w], l = G.p[1 - w];
    // podium + winner
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(260, 452, 130, 18, 0, 0, 7); ctx.fill();
    rrect(160, 420, 200, 34, 4, PAL.gold); label('1ST', 260, 438, 24, PAL.ink, 'center', 900, true);
    const wa = winAnim(p); drawSpr(p.cid, p.pal || 0, wa, Math.floor(G.phaseT / 8) % SPR[p.cid].anims[wa][1], 260, 422, 1, 4.4);
    rosette(372, 150, 34, p.c.color, true);
    // result board
    const bx = 470, by = 74;
    rrect(bx, by, 460, 290, 8, '#120b05', PAL.goldD, 3);
    ledText('RESULT', bx + 230, by + 26, 3.4, PAL.led, 'center', 'rgba(255,180,58,.1)');
    [[p, '1'], [l, '2']].forEach(([q, place], k) => {
      const y = by + 70 + k * 74;
      ledText(place, bx + 36, y + 18, 5, k ? '#ddd2f0' : PAL.led);
      gateTag(gateOf(q.cid), bx + 70, y + 4, 30);
      label(nameOf(q.cid), bx + 112, y + 12, 28, '#fff', 'left', 900, true);
      label(`${q.side === 0 ? 'P1' : 'P2'} · ${q.c.arch}`, bx + 112, y + 36, 14, PAL.dim, 'left', 700, true);
      for (let r = 0; r < 2; r++) rosette(bx + 400 + r * 26, y + 20, 10, PAL.gold, q.wins > r);
    });
    railDivider(bx + 20, by + 230, 420, '#5a4a2a');
    ledText(`${p.wins} - ${l.wins}`, bx + 230, by + 262, 3.4, PAL.led);
  }
  if (UI.screen === 'replay') return;
  if (G.mode === 'spectate') { txt('WAITING FOR THE NEXT MATCH', W / 2 + 230, 404, 22, '#fff'); return; }
  if (G.mode === 'online') {
    if (G.phaseT > 60 && G.phaseT % 60 < 40) txt('PRESS CONFIRM FOR THE LOBBY', W / 2 + 230, 404, 22, '#fff');
    label('Replay saved. Your opponent has the same one.', W / 2 + 230, 440, 14, PAL.dim, 'center', 700);
    hintBar('R  watch replay    ·    D  save replay file    ·    confirm  back to the lobby'); return;
  }
  ['REMATCH', 'CHARACTER SELECT', 'MAIN MENU'].forEach((t, k) => {
    const s = k === (UI.resIdx || 0) && G.phaseT > 60, y = 384 + k * 38;
    rowSlant(500 + (s ? 10 : 0), y, 400, 32, 10, s, 'rgba(34,17,60,.88)');
    gateTag(k, 510 + (s ? 10 : 0), y + 4, 24); label(t, 546 + (s ? 10 : 0), y + 17, 20, s ? PAL.ink : '#fff', 'left', 900, true);
  });
  hintBar('↑ ↓ choose    ·    confirm    ·    R  watch replay    ·    D  save replay file');
}
// super freeze banner
function drawSuperFlash(fo) {
  const k = Math.min(1, (38 - G.freeze) / 8);
  ctx.save(); ctx.globalAlpha = 0.9; slant(fo.side === 0 ? -20 : W - W * k - 20, 158, W * k + 40, 78, fo.side === 0 ? 30 : -30, fo.c.color); ctx.restore();
  railDivider(0, 154, W * k); railDivider(W - W * k, 236, W * k);
  face(fo.cid, fo.pal, fo.side === 0 ? 50 : W - 160, 122, 110, fo.side === 1);
  txt(((fo.move && fo.move.kind === 'super' ? fo.move : fo.c.moves.SU) || { name: 'SUPER' }).name.toUpperCase(), W / 2 + (fo.side === 0 ? 70 : -70), 197, 44, '#fff', 'center', PAL.ink);
}

// ---------------------------------------------------------------- pause
function drawPause() {
  baseT();
  ctx.fillStyle = 'rgba(24,11,42,.55)'; ctx.fillRect(0, 0, W, HGT);
  slant(-40, 0, 420, HGT, 0, 'rgba(34,17,60,.95)'); ctx.fillStyle = PAL.gold; ctx.fillRect(380, 0, 3, HGT);
  txt(UI.pauseSub ? 'TRAINING' : 'PAUSED', 40, 56, 56, '#fff', 'left', PAL.ink);
  ledText(UI.pauseSub ? 'OPTIONS' : 'STEWARDS INQUIRY', 42, 96, 2.2, PAL.led, 'left');
  const items = pauseItems(), sp = Math.min(36, (HGT - 136) / items.length), hh = sp - 6;
  items.forEach(([l], i) => {
    const s = i === UI.pauseIdx, y = 122 + i * sp;
    rowSlant(28 + (s ? 10 : 0), y, 320, hh, 10, s, 'rgba(255,255,255,.06)');
    gateTag(i, 38 + (s ? 10 : 0), y + (hh - Math.min(22, hh - 4)) / 2, Math.min(22, hh - 4));
    label(l, 72 + (s ? 10 : 0), y + hh / 2 + 1, Math.min(19, hh - 6), s ? PAL.ink : '#efe8fb', 'left', 800, true);
  });
}

// ---------------------------------------------------------------- move list
function drawMoves() {
  menuBg(0.86);
  const cid = ROSTER[UI.movesChar], c = CHARS[cid];
  topBar('MOVE LIST', '← → runner    ·    ↑ ↓ moves / combos');
  plate(24, 50, 420, 36, c.color, 12); gateTag(gateOf(cid), 34, 55, 26);
  label(nameOf(cid), 70, 69, 26, '#fff', 'left', 900, true); label(c.arch, 456, 69, 16, PAL.gold, 'left', 800, true);
  ['MOVES', 'COMBOS'].forEach((t, k) => { const s = (UI.movesPage || 0) === k; slant(700 + k * 120, 52, 110, 30, 8, s ? PAL.gold : 'rgba(255,255,255,.08)'); label(t, 755 + k * 120, 68, 17, s ? PAL.ink : '#ddd2f0', 'center', 900, true); });
  if (UI.movesPage) { drawCombos(c); return; }
  const rows = [
    ['Auto-combo', 'L, L, L, L', 'Mash L on hit: 5L → 5M → 5H → S'],
    ['Block', 'hold ←  (↙ for lows)', 'Works out of a dash too · overheads must be blocked standing'],
    ['Throw', 'L + M (close)', 'Hold back for a back throw · tech with L + M'],
    ['Dash / dash attacks', '→→  ·  →→ + L/M/H', 'L jab · M lunge · H flying kick (overhead) · or bind a Dash button in Controls'],
    ['Hop overhead', '→ + M', 'Must be blocked standing · lows beat it'],
    ['Counter Spurt', 'Counter Spurt button while blocking', 'Costs 50 Spurt · invincible push-away · also breaks a command grab as it connects · 3 s cooldown'],
    ['Taunt', 'L + H', '+8 Spurt · every hit on a taunt is a counter-hit'],
    ['Quick / slow rise', 'hold button / hold ↓', 'While knocked down (not after throws or supers)'],
    ['Skills', 'motion + L / M  ·  motion + H', 'L and M versions are free · H is the EX (50 Spurt)'],
    ['Skill shortcut', 'S + direction', 'Easy version of the M skill: cooldown, -10% damage'],
  ];
  if (c.lightChain) rows.push(['Low chain (' + c.short + ')', '2L, 2L, 2L…', 'Crouching jabs chain into themselves']);
  if (c.dashCancel) rows.push(['Dash cancel (' + c.short + ')', '→→ while a normal connects', 'Costs 50 Spurt · 10 frames before she can attack · keep the pressure on']);
  if (c.airDash) rows.push(['Air dash (' + c.short + ')', '→→ / ←← in the air', 'Once per jump, needs some height']);
  if (c.punisher) rows.push(['Punish (' + c.short + ')', 'hit them while they recover', '+20% damage and extra hitstun: PUNISH!']);
  if (c.specialChain || c.puppet) rows.push(['Special chain (' + c.short + ')', c.puppet ? 'Friend skill › another once she hits' : 'skill › another skill on hit', 'Each skill once per combo']);
  if (c.lowHpBoost) rows.push(['Miracle mode (' + c.short + ')', 'below 30% health', '+15% damage']);
  if (c.ai === 'grapple') rows.push(['Command grabs (' + c.short + ')', '→S · S · ←S', 'Can\'t be blocked or teched · ←S only catches jumpers']);
  if (c.puppet) rows.push(['Friend (' + c.short + ')', 'every skill', 'The Friend attacks · one command at a time · hit her mid-attack and she leaves for 4s']);
  if (c.projMax === 3 && c.ai === 'setplay') rows.push(['Potions (' + c.short + ')', 'up to 3 out', 'Go off when stepped on · any attack or projectile pops one · →S sets them all off · all gone if she gets hit']);
  if (c.ai === 'footsies') rows.push(['Poke follow-up (' + c.short + ')', 'S after Flame Thrust hits', 'Flame Twist launches · only on hit, not on block']);
  const sp = Object.values(c.moves).filter(m => m.name && (m.kind === 'special' || m.kind === 'super') && !m.isEx && !m.varOf && !m.followOf);
  panel(20, 94, W - 40, 414, c.color);
  const skill = [];
  for (const m of sp) {
    skill.push([[m.name, m.input + (m.motion ? '  ·  ' + arrows(m.motion) + '+atk' : ''), m.kind === 'super' ? 'SUPER' + (m.note ? ' · ' + m.note : '') : (m.note || '') + (m.vnote ? '  (' + m.vnote + ')' : '')], m.kind === 'super' ? c.color : '#fff']);
    if (m.fnote) skill.push([['   follow-ups', '', m.fnote], '#9ff']);
    if (m.ex) skill.push([['   EX', arrows(m.motion) + ' + H', m.ex.note || ''], PAL.gold]);
  }
  const lh = Math.min(17.5, (414 - 62) / (rows.length + skill.length));   // fit everything in the panel
  let y = 110;
  label('UNIVERSAL', 40, y, 15, PAL.gold, 'left', 900, true); y += 19;
  for (const r of rows) { line3(r, y, '#fff', lh); y += lh; }
  y += 5; label('SKILLS & SUPER', 40, y, 15, PAL.gold, 'left', 900, true); y += 19;
  for (const [r, col] of skill) { line3(r, y, col, lh); y += lh; }
  hintBar('← → switch runner    ·    ↑ ↓ moves / combos    ·    any button to go back');
}
function comboText(seq) {
  return seq.replace(/ , /g, ' , ').split(' ').map(t => t === 'jc' ? '(jump)' : t === 'dc' ? '(→→)' : t === ',' ? '(link)' : t === 'fS' ? 'S' : t.replace(/^(\d{3,5})([LMH])$/, (_, mo, b) => arrows(mo) + b)).join('  ›  ');
}
function drawCombos(c) {
  panel(20, 94, W - 40, 414, c.color);
  label('STARTER COMBOS', 40, 112, 15, PAL.gold, 'left', 900, true);
  let y = 140;
  for (const cb of (c.combos || [])) {
    slant(36, y - 14, 880, 58, 8, 'rgba(255,255,255,.05)');
    label(cb.name, 52, y + 2, 20, '#fff', 'left', 900, true);
    label(comboText(cb.seq), 250, y + 2, 20, '#7fe0ff', 'left', 800, true);
    label(cb.note || '', 250, y + 26, 14, '#d4c8ea', 'left', 600);
    y += 64;
  }
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(36, 460, W - 72, 42);
  label('COMBO RULES', 48, 471, 12, PAL.gold, 'left', 900, true);
  label('Scaling: 1st hit full, then light starters 80% · mediums 90% · heavies 100%, and −13% per hit from the 3rd (min 25%, supers 50%)', 140, 471, 12.5, '#d4c8ea', 'left', 600);
  label('Juggle: 10 points · j.H in an air combo ground-bounces (once) · EX knockdowns wall-bounce (once) · after 2s hitstun shrinks · hard limit 32 hits / 7s', 140, 490, 12.5, '#d4c8ea', 'left', 600);
  hintBar('← → switch runner    ·    ↑ ↓ moves / combos    ·    any button to go back');
}
function arrows(mo) { return mo.split('').map(d => ({ 1: '↙', 2: '↓', 3: '↘', 4: '←', 6: '→', 7: '↖', 8: '↑', 9: '↗' })[d]).join(''); }
function line3(r, y, col = '#fff', lh = 17.5) {
  const fs = Math.min(15, lh - 2);
  label(r[0], 44, y, fs, col, 'left', 700); label(r[1], 300, y, fs, '#7fe0ff', 'left', 700);
  // the description shrinks to fit its column rather than being cut off
  ctx.font = font(fs - 1, 600, false); const w = ctx.measureText(r[2]).width, k = Math.min(1, (W - 560) / Math.max(1, w));
  ctx.save(); ctx.translate(520, y); ctx.scale(k, 1); label(r[2], 0, 0, fs - 1, '#d4c8ea', 'left', 600); ctx.restore();
}

// ---------------------------------------------------------------- controls
function drawControls() {
  menuBg(0.86);
  const C = UI.ctl || { row: 0, col: 0 };
  topBar('CONTROLS', 'saved in this browser');
  panel(30, 52, W - 60, 440, PAL.turf);
  const xs = [56, 350, 550, 750];
  ['ACTION', ...CTL_COLS].forEach((h, k) => label(h, xs[k], 72, 15, PAL.gold, 'left', 900, true));
  controlsRows().forEach((r, i) => {
    const y = 94 + i * 24.4, selRow = i === C.row;
    if (selRow) slant(40, y - 11, W - 92, 22, 6, 'rgba(255,255,255,.1)');
    label(r.label, xs[0], y, 16, r.act ? PAL.gold : '#fff', 'left', r.act ? 900 : 700, !!r.act);
    if (r.act) return;
    const cells = [KEYMAP[0][r.a].map(keyName).join(' / ') || '—', KEYMAP[1][r.a].map(keyName).join(' / ') || '—', (PADMAP[r.a] || []).map(b => PADNAMES[b] || 'B' + b).join(' / ') || '—'];
    cells.forEach((t, k) => {
      const active = selRow && C.col === k, waiting = active && UI.ctl && UI.ctl.wait;
      if (active) slant(xs[k + 1] - 10, y - 11, 180, 22, 6, waiting ? PAL.gold : PAL.rose);
      label(waiting ? (k < 2 ? 'press a key…' : 'press a button…') : t, xs[k + 1], y, 15, waiting ? PAL.ink : active ? '#fff' : '#7fe0ff', 'left', 700);
    });
  });
  drawPadTest(474);
  const w = UI.ctl && UI.ctl.wait;
  hintBar(w ? 'Press the new input    ·    Esc to cancel' : '↑ ↓ action    ·    ← → column    ·    Enter / F rebind    ·    Esc back    ·    ` toggles hitboxes in a match');
}

// controller test: what the game sees from each controller, for helping players with controller problems
function drawPadTest(y) {
  const pads = getPads();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(40, y - 12, W - 80, pads.length > 1 ? 38 : 24);
  if (!pads.length) { label(padsAllowed ? 'CONTROLLER TEST · no controller seen yet. Plug one in and press a button.' : 'CONTROLLER TEST · this browser blocks controllers here', 56, y, 14, PAL.dim, 'left', 700); return; }
  pads.slice(0, 2).forEach((gp, k) => {
    const name = gp.id.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 34) || 'Controller';
    const held = gp.buttons.map((b, i) => b.pressed ? (PADNAMES[i] || 'B' + i) : null).filter(Boolean);
    const hat = hatDir(gp), stick = `${(gp.axes[0] || 0).toFixed(1)}, ${(gp.axes[1] || 0).toFixed(1)}`;
    const dirs = hat ? ['UP', 'DOWN', 'LEFT', 'RIGHT'].filter((d, i) => hat[i]).join('+') : '';
    label(`P${k + 1} · ${name} · ${gp.mapping === 'standard' ? 'standard layout' : 'non-standard layout'}`, 56, y + k * 14, 13, gp.mapping === 'standard' ? '#bfe8c9' : PAL.gold, 'left', 700);
    label(`stick ${stick}${dirs ? ' · d-pad ' + dirs : ''}${held.length ? ' · ' + held.join(' ') : ''}`, W - 52, y + k * 14, 13, '#fff', 'right', 700);
  });
}

// ---------------------------------------------------------------- replays
function drawReplaysMenu() {
  menuBg(0.82);
  topBar('REPLAYS', `build ${BUILD}`);
  const items = replayMenuItems(), rowH = 46, vis = Math.floor((HGT - 66 - 40) / rowH);
  RM.top = Math.max(0, Math.min(RM.top, RM.idx, items.length - vis)); if (RM.idx >= RM.top + vis) RM.top = RM.idx - vis + 1;
  items.slice(RM.top, RM.top + vis).forEach((it, k) => {
    const i = RM.top + k, y = 66 + k * rowH, s = i === RM.idx, ask = RM.del === i;
    rowSlant(60 + (s ? 10 : 0), y, 800, 38, 12, s, 'rgba(34,17,60,.85)');
    if (it.all) rrect(72 + (s ? 10 : 0), y + 6, 26, 26, 4, PAL.p2); else gateTag(i, 72 + (s ? 10 : 0), y + 6, 26);
    if (it.all) label('×', 85 + (s ? 10 : 0), y + 19, 20, '#fff', 'center', 900);
    const main = ask ? (it.all ? 'Press again to delete every saved replay' : 'Press X again to delete this replay') : it.label;
    label(main, 110 + (s ? 10 : 0), y + (it.sub ? 13 : 20), 19, ask ? PAL.p2 : s ? PAL.ink : it.all ? '#ffb3b3' : '#fff', 'left', 800, true);
    if (it.sub) label(ask ? it.label : it.sub, 110 + (s ? 10 : 0), y + 29, 12.5, s ? '#5e4c80' : PAL.dim, 'left', 600);
  });
  if (RM.top > 0) label('▲ more', 860, 56, 13, PAL.dim, 'right', 700, true);
  if (RM.top + vis < items.length) label('▼ more', 860, HGT - 36, 13, PAL.dim, 'right', 700, true);
  hintBar('Enter / F watch    ·    D save as a file    ·    X / Delete (pad: Y) delete    ·    Esc back');
}
function drawRepWarn() {
  menuBg(0.82);
  topBar('REPLAYS', `build ${BUILD}`);
  const A = RP.ask, r = A.rep;
  panel(W / 2 - 330, 130, 660, 250, PAL.p2);
  txt('OLDER REPLAY', W / 2, 168, 34, '#fff');
  label(describe(r), W / 2, 206, 17, PAL.gold, 'center', 800, true);
  label(`It was recorded on build ${r.build}. You have build ${BUILD}.`, W / 2, 238, 16, '#efe8fb', 'center', 700);
  label('Moves have changed since then, so the match may not play out the way it really went.', W / 2, 262, 15, '#d4c8ea', 'center', 600);
  ['WATCH ANYWAY', 'BACK'].forEach((t, k) => {
    const s = k === A.idx, x = W / 2 - 250 + k * 260;
    rowSlant(x, 300, 240, 40, 10, s, 'rgba(34,17,60,.9)');
    label(t, x + 125, 321, 21, s ? PAL.ink : '#fff', 'center', 900, true);
  });
  hintBar('← → choose    ·    F / Enter confirm    ·    Esc back');
}
function drawReplayHUD() {
  if (RP.hide) {   // hidden: a short reminder of how to bring the controls back, then nothing
    RP.hideT = (RP.hideT || 0) + 1;
    if (RP.hideT < 120) { ctx.globalAlpha = Math.min(1, (120 - RP.hideT) / 30); label(RP.hide === 2 ? 'Clean view · H to show everything' : 'Controls hidden · H again for a clean view', W / 2, HGT - 60, 13, '#fff', 'center', 800, true); ctx.globalAlpha = 1; }
    if (RP.hide === 1 && RP.idx >= RP.n) txt('END OF REPLAY', W / 2, HGT / 2 + 80, 30, PAL.gold);
    return;
  }
  const y = 96, w = 440, x = W / 2 - w / 2;
  panel(x - 14, y - 22, w + 28, 66, PAL.rose);
  ctx.fillStyle = '#3a2a5c'; ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = PAL.rose; ctx.fillRect(x, y, w * (RP.idx / Math.max(1, RP.n)), 8);
  const sec = f => `${Math.floor(f / 3600)}:${String(Math.floor(f / 60) % 60).padStart(2, '0')}`;
  label(`REPLAY  ${RP.paused ? '❚❚' : '▶'} ${RP.speed}x   ${sec(RP.idx)} / ${sec(RP.n)}`, W / 2, y - 8, 16, '#fff', 'center', 800, true);
  label('Space pause · ←/→ ±5s · ↑/↓ speed · . step · R restart · ` hitboxes · H hide · D save · Esc exit', W / 2, y + 24, 12, '#b9bfdc', 'center', 600);
  if (RP.warn) label(RP.warn, W / 2, y + 40, 12, '#ffb36b', 'center', 700);
  if (RP.idx >= RP.n) txt('END OF REPLAY', W / 2, HGT / 2 + 80, 30, PAL.gold);
}

// ---------------------------------------------------------------- online lobby
function drawNetSelect() {
  menuBg(0.62);
  topBar('ONLINE ENTRY', `ping ${Math.round(Net.ping)} ms · delay ${Net.delay} · build ${BUILD}`);
  const picks = Net.side === 0 ? [Net.myPick, Net.theirPick] : [Net.theirPick, Net.myPick];
  const ready = Net.side === 0 ? [Net.myReady, Net.theirReady] : [Net.theirReady, Net.myReady];
  drawStalls([{ i: picks[0], col: PAL.p1, tag: Net.side === 0 ? 'YOU' : 'P1' }, { i: picks[1], col: PAL.p2, tag: Net.side === 1 ? 'YOU' : 'P2' }]);
  for (let side = 0; side < 2; side++) {
    const mine = side === Net.side;
    const pals = matchPals(ROSTER[picks[0]], ROSTER[picks[1]], Net.side === 0 ? [Net.myPal, Net.theirPal] : [Net.theirPal, Net.myPal]);
    drawEntryCard(side, ROSTER[picks[side]] || null, ready[side], (netName(side) || (side === 0 ? 'P1' : 'P2')) + (mine ? ' · YOU' : ''), pals[side], mine ? '' : (ready[side] ? '' : 'choosing…'));
  }
  // course + music (P1, the host, decides)
  const host = Net.role === 'host', st = host ? Net.stage : Net.theirStage, mu = host ? netMusic() : (Net.theirMusic || ROSTER[picks[0]]);
  [['COURSE', st === STAGE_LIST.length ? 'RANDOM' : STAGE_LIST[st || 0].name], ['MUSIC', TRACK_TITLE(mu)]].forEach(([k, v], j) => {
    const x = j ? W / 2 + 6 : W / 2 - 336, f = host && Net.focus === j + 1;
    rowSlant(x, 167, 330, 24, 8, f, 'rgba(24,11,42,.92)');
    label(k, x + 14, 179, 13, f ? PAL.rose : PAL.dim, 'left', 900, true);
    label((f ? '◀ ' : '') + v + (f ? ' ▶' : ''), x + 76, 179, 14, f ? PAL.ink : PAL.gold, 'left', 800, true);
  });
  { const [w, col] = pingWord(Net.ping), bars = Net.ping < 60 ? 4 : Net.ping < 120 ? 3 : Net.ping < 200 ? 2 : 1;   // connection, before you lock in
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i < bars ? col : 'rgba(255,255,255,.15)'; ctx.fillRect(W / 2 - 150 + i * 7, 208 - (i + 1) * 3.5, 5, (i + 1) * 3.5); }
    label(`CONNECTION ${w} · ${Math.round(Net.ping)} ms · delay ${Net.delay}${Net.specs.length ? ' · ' + Net.specs.length + ' watching' : ''}${host ? '' : ' · P1 picks course and music'}`, W / 2 - 116, 202, 12.5, col, 'left', 800, true); }
  if (Net.theirBuild && Net.theirBuild !== BUILD) {
    panel(W / 2 - 330, 220, 660, 96, PAL.p2);
    txt('DIFFERENT GAME VERSIONS', W / 2, 248, 26, '#fff');
    label(`You have build ${BUILD}, your friend has build ${Net.theirBuild}.`, W / 2, 276, 15, '#ffd6dc', 'center', 700);
    label('You both need the same version. Grab the latest copy and try again.', W / 2, 298, 15, '#ffd6dc', 'center', 700);
  } else if (!Net.theirBuild) label('checking versions…', W / 2, 228, 14, '#d9cdef', 'center', 700);
  hintBar(Net.role === 'host' ? (Net.myReady ? '↑ ↓ runner / course / music    ·    ← → change    ·    H unlock runner    ·    waiting for your friend…' : '↑ ↓ runner / course / music    ·    ← → change    ·    M colour    ·    F / Enter lock in    ·    Esc leave')
    : (Net.myReady ? 'Waiting for your friend…    ·    H to change' : '← → choose    ·    ↑ ↓ colour    ·    F / J / Enter lock in    ·    Esc leave'));
}
function pingWord(ms) { return ms < 60 ? ['GOOD', '#7dff9a'] : ms < 120 ? ['OK', PAL.gold] : ms < 200 ? ['LAGGY', '#ffb36b'] : ['BAD', '#ff6b6b']; }
function drawNetHUD() {
  const [w, col] = pingWord(Net.ping), avg = Net.rbN ? (Net.rbSum / Net.rbN).toFixed(1) : '0';
  label(`ONLINE · ${Math.round(Net.ping)} ms`, W / 2 - 6, 84, 12, col, 'right', 800);
  label(`· delay ${Net.delay} · rollback ${Net.rbFrames}f (avg ${avg}, max ${Net.rbMax})${Net.specs.length ? ' · ' + Net.specs.length + ' watching' : ''}`, W / 2 - 2, 84, 12, '#cfe3ff', 'left', 700);
  for (const sd of [0, 1]) { const n = netName(sd); if (n) label(n, sd === 0 ? 112 : W - 112, 84, 14, '#fff', sd === 0 ? 'left' : 'right', 900, true); }
  if (Net.waiting && Net.stalls > 20) txt('waiting for opponent…', W / 2, 104, 18, PAL.gold);
  if (Net.desync >= 0) txt(`DESYNC at frame ${Net.desync}: please report what happened`, W / 2, 124, 15, '#ff6b6b');
  if (Net.menu) {
    panel(W / 2 - 230, HGT / 2 - 60, 460, 120, PAL.rose);
    txt('Leave the match?', W / 2, HGT / 2 - 20, 32, '#fff');
    label('F / Enter = leave    ·    Esc / H = keep playing', W / 2, HGT / 2 + 24, 15, '#d9cdef', 'center', 700);
  }
}
function drawOnlineBg() { menuBg(0.7); topBar('ONLINE', 'peer-to-peer · rollback netcode'); }
function drawSpecHUD() {
  if (SPEC.live) {
    slant(W / 2 - 120, 92, 240, 24, 8, 'rgba(24,11,42,.85)'); label(`SPECTATING · ${SPEC.names[0]} vs ${SPEC.names[1]}`, W / 2 + 4, 104, 13, PAL.gold, 'center', 900, true);
    for (const sd of [0, 1]) label(SPEC.names[sd], sd === 0 ? 112 : W - 112, 84, 14, '#fff', sd === 0 ? 'left' : 'right', 900, true);
    const behind = SPEC.frames.length - SPEC.idx;
    if (behind < 2 && G.phase !== 'match') label('waiting for the players…', W / 2, 126, 13, PAL.dim, 'center', 700);
  } else {
    panel(W / 2 - 260, 190, 520, 140, PAL.gold);
    txt('WATCHING ROOM ' + Net.code, W / 2, 226, 30, '#fff');
    label(`${SPEC.names[0]} vs ${SPEC.names[1]}`, W / 2, 262, 18, PAL.gold, 'center', 800, true);
    label(SPEC.buildOk ? 'The match shows up here as soon as it starts.' : 'This room is on a different version, so the match can\'t be shown.', W / 2, 292, 15, '#d9cdef', 'center', 600);
  }
  hintBar('Esc  stop watching');
}

// ---------------------------------------------------------------- battle music select (after the course)
function drawMusicSelect() {
  menuBg(0.72);
  topBar('MUSIC SELECT', `${STAGE_LIST[UI.vsStage || 0].name}`);
  const n = THEME_IDS.length, gap = 6, cw = Math.min(102, Math.floor((W - 40 - (n - 1) * gap) / n)), x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y = 250;
  label('BATTLE THEME', W / 2, 74, 16, PAL.gold, 'center', 900, true);
  const id = THEME_IDS[UI.musicIdx], c = CHARS[id];
  plate(W / 2 - 300, 96, 600, 64, c.color, 18);
  txt(TRACK_TITLE(id), W / 2 + 10, 128, 40, '#fff', 'center', PAL.ink);
  label(id === ROSTER[UI.sel[0]] ? 'P1\'s runner (default)' : 'swapped from P1\'s runner', W / 2, 180, 14, '#e8e0f6', 'center', 600);
  // equaliser while the preview plays
  for (let i = 0; i < 28; i++) { const h = 6 + Math.abs(Math.sin(UI.t / (6 + i % 5) + i)) * 26; ctx.fillStyle = i % 2 ? PAL.gold : PAL.rose; ctx.fillRect(W / 2 - 196 + i * 14, 236 - h, 9, h); }
  const fs = Math.min(80, cw - 10);
  for (let k = 0; k < n; k++) {
    const x = x0 + k * (cw + gap), sel = k === UI.musicIdx, cid = THEME_IDS[k], nm = nameOf(cid), words = nm.split(' ');
    rrect(x - 3, y - 3, cw + 6, 128, 6, sel ? PAL.gold : '#3a2a5c');
    ctx.fillStyle = vgradC(y, y + 122, sel ? CHARS[cid].color : '#2a1748', '#170c2c'); ctx.fillRect(x, y, cw, 122);
    face(cid, 0, x + (cw - fs) / 2, y + 14 + (80 - fs), fs, false);
    ctx.fillStyle = GATE[k % 8][0]; ctx.fillRect(x, y, cw, 14); label(String(k + 1), x + cw / 2, y + 8, 13, GATE[k % 8][1], 'center', 900, true);
    ctx.fillStyle = 'rgba(24,11,42,.85)'; ctx.fillRect(x, y + 98, cw, 24);
    if (cw >= 90 || words.length === 1) label(nm, x + cw / 2, y + 110, nm.length > 12 ? 12 : 13.5, '#fff', 'center', 800, true);
    else { label(words[0], x + cw / 2, y + 104, 10.5, '#fff', 'center', 800, true); label(words.slice(1).join(' '), x + cw / 2, y + 116, 10.5, '#fff', 'center', 800, true); }
    if (cid === ROSTER[UI.sel[0]]) { slant(x + 4, y + 18, 30, 16, 5, PAL.p1); label('P1', x + 19, y + 26, 12, '#fff', 'center', 900, true); }
  }
  label('A tied match switches to the Third Round Theme for the final round.', W / 2, 410, 14, PAL.dim, 'center', 600);
  hintBar('← → choose (preview plays)    ·    F / Enter confirm    ·    H / Esc back to courses');
}

// ---------------------------------------------------------------- options
const SOUND_ROWS = () => [{ k: 'music', label: 'Music volume' }, { k: 'sfx', label: 'Effects volume' }, { k: 'calm', label: 'Reduce flashes & shake' }, { k: 'full', label: 'Fullscreen' }, { k: 'gfx', label: 'Graphics' }, { k: 'back', label: 'Back' }];
function drawSound() {
  menuBg(0.82);
  topBar('OPTIONS', 'saved in this browser');
  const rows = SOUND_ROWS(), X = 210, RH = 44, Y0 = 150;
  panel(X, Y0 - 34, 540, rows.length * RH + 40, PAL.rose);
  rows.forEach((r, i) => {
    const y = Y0 + i * RH, sel = i === UI.soundIdx;
    if (sel) rowSlant(X + 12, y - 15, 516, 30, 8, true);
    const col = sel ? PAL.ink : '#efe8fb';
    if (r.k === 'music' || r.k === 'sfx') {
      label(r.label, X + 30, y, 18, col, 'left', 800, true);
      const v = r.k === 'music' ? Music.vol : Sfx.vol;
      meterBar(X + 260, y - 7, 200, 14, Math.round(v * 5), PAL.turf);
      label(`${Math.round(v * 100)}%`, X + 508, y, 16, col, 'right', 800, true);
    } else if (r.k === 'gfx') {
      label(r.label, X + 30, y, 18, col, 'left', 800, true);
      label((sel ? '◀ ' : '') + SET.gfx.toUpperCase() + (sel ? ' ▶' : ''), X + 508, y, 16, col, 'right', 900, true);
    } else if (r.k === 'calm' || r.k === 'full') {
      label(r.label, X + 30, y, 18, col, 'left', 800, true);
      label((r.k === 'calm' ? SET.calm : document.fullscreenElement) ? 'ON' : 'OFF', X + 508, y, 16, col, 'right', 900, true);
    } else label(r.label, X + 30, y, 18, sel ? PAL.ink : PAL.gold, 'left', 900, true);
  });
  if (Music.blocked) label('Press any key to allow audio', W / 2, Y0 + rows.length * RH + 30, 14, PAL.gold, 'center', 700);
  hintBar('↑ ↓ choose    ·    ← → change    ·    F / Enter select    ·    Esc back');
}

// ---------------------------------------------------------------- account
function drawAccount() {
  menuBg(0.72);
  topBar('ACCOUNT', acctOn() ? 'signed in · settings saved to your account' : ACCT.on ? 'playing as a guest' : 'accounts are off in this copy');
  if (!acctOn()) { hintBar('Tab or click to switch boxes    ·    Enter to confirm    ·    Esc back'); return; }
  const p = ACCT.profile, st = ACCT.stats || {}, fav = (p && p.fav_runner) || 'spe', c = CHARS[fav];
  // ---- profile card
  panel(30, 60, 400, 412, c.color);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(230, 300, 96, 14, 0, 0, 7); ctx.fill();
  drawSpr(fav, 0, '800', Math.floor(UI.t / 9) % SPR[fav].anims['800'][1], 230, 304, 1, 3.4);
  plate(50, 78, 360, 44, c.color, 14); label(p ? p.name : '…', 70, 101, 30, '#fff', 'left', 900, true);
  label(p ? 'joined ' + new Date(p.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '', 404, 140, 13, PAL.dim, 'right', 700);
  // stats
  const games = st.games || 0, wins = st.wins || 0, losses = st.losses ?? (games - wins);   // online matches only
  label('ONLINE RECORD', 50, 312, 12, PAL.dim, 'left', 800, true);
  const boxes = [['MATCHES', String(games)], ['WINS', String(wins)], ['LOSSES', String(losses)], ['WIN RATE', games ? Math.round(100 * wins / games) + '%' : '—']];
  boxes.forEach(([k, v], i) => { const x = 46 + i * 92; rrect(x, 322, 84, 58, 5, 'rgba(255,255,255,.06)'); label(k, x + 42, 336, 12, PAL.dim, 'center', 800, true); txt(v, x + 42, 362, 26, '#fff'); });
  if (st.main_runner) { label('MOST PLAYED ONLINE', 50, 404, 12, PAL.dim, 'left', 800, true); face(st.main_runner, 0, 50, 414, 44); label(nameOf(st.main_runner), 102, 437, 18, '#fff', 'left', 900, true); }
  // ---- rows
  const rows = { fav: `Favourite runner   ◀ ${nameOf(fav)} ▶`, name: 'Change name', friends: 'Friends', leaders: 'Leaderboards', sync: 'Save settings now', out: 'Sign out', back: 'Back' };
  ACCT_ROWS.forEach((r, i) => {
    const y = 296 + i * 26, s = i === ACCT.idx, x = 458 + (s ? 10 : 0);
    rowSlant(x, y, 470, 23, 10, s, 'rgba(34,17,60,.82)');
    label(rows[r], x + 20, y + 12, 16, s ? PAL.ink : '#fff', 'left', 900, true);
  });
  // ---- recent matches
  panel(458, 60, 472, 226, PAL.turf);
  label('RECENT ONLINE MATCHES', 474, 80, 15, PAL.gold, 'left', 900, true);
  if (!ACCT.recent.length) label('Play online while signed in and your results show up here.', 474, 110, 14, '#d9cdef', 'left', 600);
  ACCT.recent.slice(0, 7).forEach((m, i) => {
    const y = 96 + i * 27;
    rrect(474, y, 34, 22, 4, m.won ? PAL.turf : '#8a2a3c'); label(m.won ? 'WIN' : 'LOSS', 491, y + 11, 11, '#fff', 'center', 900, true);
    face(m.my_runner, 0, 514, y - 1, 24); label('vs', 543, y + 11, 12, PAL.dim, 'left', 700); face(m.opp_runner, 0, 560, y - 1, 24, true);
    label(m.opp_name || '', 592, y + 11, 15, '#fff', 'left', 800, true);
    label(`${m.rounds_won}-${m.rounds_lost}`, 818, y + 11, 15, m.won ? '#9dffb4' : '#ffb0bc', 'right', 900, true);
    label(new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), 912, y + 11, 12, PAL.dim, 'right', 700);
  });
  if (ACCT.status) label(ACCT.status, 458 + 235, 486, 14, ACCT.statusOk ? PAL.gold : '#ff8a9a', 'center', 700);
  hintBar('↑ ↓ choose    ·    ← → change runner    ·    F / Enter confirm    ·    H / Esc back');
}
// small "who's signed in" chip for the title screen
function drawAcctChip() {
  if (!ACCT.on) return;
  const n = acctName(), t = n || 'GUEST · SIGN IN'; ctx.font = font(15, 800, true);
  const w = ctx.measureText(t).width + (n ? 56 : 30), x = W - 20 - w;
  rrect(x, 16, w, 32, 16, 'rgba(24,10,44,.85)', 'rgba(255,255,255,.3)', 2);
  if (n) { face(ACCT.profile.fav_runner, 0, x + 8, 19, 26); label(n, x + 40, 33, 15, '#fff', 'left', 800, true); }
  else label(t, x + w / 2, 33, 15, '#fff', 'center', 800, true);
}
// online: show account names instead of P1/P2 when we have them
function netName(side) { if (G.mode !== 'online' && UI.screen !== 'netselect') return null; return side === Net.side ? acctName() : (Net.theirWho && Net.theirWho.name) || null; }
