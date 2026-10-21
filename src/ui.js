const VERSION = '1.8';   // shown on the title screen and main menu (cosmetic; not part of BUILD)
// ============================================================================
//  UI  —  "race day" look: starting-gate colours, tote-board LED text,
//  saddlecloth name plates, rosettes for round wins. Menus + in-game HUD.
// ============================================================================
'use strict';

const SET_KEY = 'umavs.settings';
const SET = { calm: false };
try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { }
function saveSet() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) { } }
const FD = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';
const PAL = {
  ink: '#0a0e1f', navy: '#121a36', navy2: '#1c2750', navy3: '#283466', rail: '#f4f1e8', turf: '#2fae5b', turfD: '#1d7a3e',
  gold: '#f6c343', goldD: '#b98512', rose: '#ff4f8b', p1: '#4aa8ff', p2: '#ff5a5a', dim: '#8f98c0', led: '#ffb43a',
};
// JRA starting-gate colours, gates 1–8 (one per runner on the roster)
const GATE = [['#f4f4f4', '#151515'], ['#1d1d1d', '#ffffff'], ['#e43b3b', '#ffffff'], ['#2f6fe0', '#ffffff'],
              ['#f6d23a', '#151515'], ['#2fae5b', '#ffffff'], ['#f39233', '#151515'], ['#f27fb3', '#151515']];
const gateOf = cid => Math.max(0, ROSTER.indexOf(cid));
const DISPLAY = { mm: 'MEJIRO McQUEEN' };
const nameOf = cid => DISPLAY[cid] || CHARS[cid].name;
// select-screen ratings (1–5); health is derived from the data
const RATING = { spe: [3, 3, 3, 1], suz: [5, 4, 2, 3], gs: [4, 3, 2, 3], vo: [3, 3, 2, 3], ds: [2, 2, 5, 2], mm: [2, 3, 4, 4], tt: [4, 5, 2, 4], kb: [3, 3, 3, 1] };

// ---------------------------------------------------------------- text
function font(size, weight = 800, italic = true) { return `${italic ? 'italic ' : ''}${weight} ${size}px ${FD}`; }
function txt(s, x, y, size, color = '#fff', align = 'center', stroke = PAL.ink, weight = 900) {
  const heavy = weight >= 800;
  ctx.font = font(size, heavy ? (size >= 40 ? 900 : 800) : 600, heavy);
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (stroke) { ctx.lineWidth = Math.max(2.5, size / 7); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
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
  const key = str + '|' + dot + '|' + col + '|' + offCol;
  let c = ledCache.get(key);
  if (!c) {
    const pitch = dot * 1.25, cw = 6 * pitch, pad = dot * 2;
    c = canvasOf(Math.ceil(str.length * cw + pad * 2), Math.ceil(7 * pitch + pad * 2));
    const x2 = c.getContext('2d');
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
  const ox = align === 'center' ? x - c.width / 2 : align === 'right' ? x - c.width : x;
  ctx.drawImage(c, Math.round(ox), Math.round(y - c.height / 2));
  return c.width;
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
  ctx.fillStyle = on ? col : '#2b3150'; ctx.beginPath();
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = i % 2 ? r : r * 0.82; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = on ? PAL.rail : '#1a1f38'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 7); ctx.fill();
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
  rrect(x, y, w, h, 6, 'rgba(12,17,38,.88)', 'rgba(255,255,255,.08)', 1);
  ctx.fillStyle = accent; ctx.fillRect(x + 6, y, w - 12, 3);
}
function meterBar(x, y, w, h, v, col) {   // 5-pip rating bar
  for (let i = 0; i < 5; i++) slant(x + i * (w / 5), y, w / 5 - 4, h, 4, i < v ? col : 'rgba(255,255,255,.12)');
}

// ---------------------------------------------------------------- faces (head crop of the idle frame)
const FACES = {};
function faceOf(cid, alt, flip) {
  const key = cid + (alt ? 'a' : '') + (flip ? 'f' : '');
  if (FACES[key]) return FACES[key];
  const S = SPR[cid], idx = S.anims['800'][0], sx = (idx % S.cols) * 64, sy = Math.floor(idx / S.cols) * 64;
  const src = flip ? (alt ? S.altR : S.imgR) : (alt ? S.alt : S.img);
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
function portrait(cid, alt, x, y, size, flip) { face(cid, alt, x, y, size, flip); }   // kept for older callers

// ---------------------------------------------------------------- shared backdrop
function menuBg(dim = 0.55) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cycle = ['title', 'mode'].includes(UI.screen);
  if (cycle) menuStage = Math.floor(UI.t / 720) % STAGES.length;
  const cam = STAGE_W / 2 + Math.sin(UI.t / 300) * 400;
  drawStage(cam, menuStage);
  const k = UI.t % 720;
  if (cycle && k > 690) { ctx.globalAlpha = (k - 690) / 30; drawStage(cam, (menuStage + 1) % STAGES.length); ctx.globalAlpha = 1; }
  ctx.fillStyle = `rgba(8,11,28,${dim})`; ctx.fillRect(0, 0, W, HGT);
}
function topBar(title, sub) {
  ctx.fillStyle = 'rgba(8,11,28,.92)'; ctx.fillRect(0, 0, W, 40);
  ctx.fillStyle = PAL.gold; ctx.fillRect(0, 40, W, 2);
  slant(-10, 0, 200, 40, 14, PAL.rose); slant(-14, 0, 196, 40, 14, '#1b2150');
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  const ok = logoImg(92, 20, 92); ctx.imageSmoothingEnabled = sm;
  if (!ok) { label('UMA', 14, 21, 24, '#fff', 'left', 900, true); label('VERSUS', 58, 21, 24, PAL.ink, 'left', 900, true); }
  label(title, 214, 21, 22, '#fff', 'left', 800, true);
  if (sub) label(sub, W - 16, 21, 15, PAL.dim, 'right', 600);
}
function hintBar(s) {
  ctx.fillStyle = 'rgba(8,11,28,.92)'; ctx.fillRect(0, HGT - 26, W, 26);
  ctx.fillStyle = PAL.turf; ctx.fillRect(0, HGT - 26, W, 2);
  label(s, W / 2, HGT - 12, 14, '#cfd5f0', 'center', 600);
}
const LOGO = typeof LOGO_URI !== 'undefined' ? Object.assign(new Image(), { src: LOGO_URI }) : null;
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
  menuBg(0.3);
  // the whole roster parading along the rail
  ROSTER.forEach((cid, i) => {
    const x = ((UI.t * 3.2 + i * 150) % (W + 300)) - 150;
    drawSpr(cid, 'img', '102', Math.floor(UI.t / 4 + i) % SPR[cid].anims['102'][1], x, 500, 1, 2.6);
  });
  ctx.fillStyle = 'rgba(8,11,28,.55)'; ctx.fillRect(0, 70, W, 240);
  logo(W / 2 + 10, 165, 1);
  ledText('TEAM SPICA  *  8 RUNNERS  *  FAN-MADE FIGHTING GAME', W / 2, 292, 2.2, '#ffd27a');
  if (UI.t % 70 < 48) txt('PRESS START', W / 2, 338, 34, '#fff');
  label('Enter · F · Ⓐ', W / 2, 368, 15, '#dfe3f5', 'center');
  if (Music.blocked) { slant(W / 2 - 205, 400, 410, 30, 10, 'rgba(8,11,28,.85)'); label('♪  Your browser holds back sound until you press a key or click', W / 2 + 5, 416, 14, PAL.gold, 'center', 700); }
  label(`Update ${VERSION} · build ${BUILD}`, W - 12, HGT - 12, 12, 'rgba(255,255,255,.55)', 'right');
  drawAcctChip();
}

// ---------------------------------------------------------------- main menu ("race programme")
const MODE_META = { account: '', versus: '2P · SAME SCREEN', online: 'ROLLBACK', cpu: '', training: 'FREE RUN', replays: '', trials: '', moves: '8 RUNNERS', controls: 'KEYS · PADS', sound: 'VOLUME · TRACKS' };
const TIPS = ['Hold back to block, even straight out of a dash', 'motion + H is the EX version of a skill: it costs 50 Spurt',
  'Mash L for an auto-combo: 5L › 5M › 5H › skill', 'Teio\'s skills chain into each other on hit', 'McQueen deals PUNISH! damage to anyone caught recovering',
  'Vodka\'s Full Throttle is a hard knockdown: no quick rise', 'Daiwa can keep two shots on screen', 'Kitasan\'s Matsuri Uppercut is fully invincible',
  'Gold Ship can dash-cancel her normals for 10 Spurt', 'Suzuka is the only runner with an air dash', 'Throw with L+M: it beats blocking',
  'Counter Spurt: S+H while blocking, for 50 Spurt', 'Press ` in a match to show hitboxes', 'Replays are saved automatically after every match'];
function ticker(y) {
  ctx.fillStyle = 'rgba(8,11,28,.92)'; ctx.fillRect(0, y, W, 28);
  slant(-8, y, 108, 28, 10, PAL.gold); label('TRACK NEWS', 10, y + 14, 15, PAL.ink, 'left', 800, true);
  ctx.save(); ctx.beginPath(); ctx.rect(118, y, W - 118, 28); ctx.clip();
  const s = TIPS.join('     ●     '); ctx.font = font(15, 600, false);
  const w = ctx.measureText(s + '     ●     ').width, off = (UI.t * 1.1) % w;
  for (let k = 0; k < 3; k++) label(s + '     ●     ', 130 - off + k * w, y + 15, 15, '#e6e9f8', 'left', 600);
  ctx.restore();
}
function drawMode() {
  menuBg(0.5);
  topBar('RACE PROGRAMME', `Update ${VERSION} · build ${BUILD}`);
  // runner in the paddock (cycles through the roster)
  const cid = ROSTER[Math.floor(UI.t / 300) % ROSTER.length], c = CHARS[cid];
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(760, 432, 120, 18, 0, 0, 7); ctx.fill();
  drawSpr(cid, 'img', '800', Math.floor(UI.t / 9) % SPR[cid].anims['800'][1], 760, 436, -1, 4.2);
  plate(626, 446, 270, 34, c.color, 12); label(nameOf(cid), 646, 464, 24, '#fff', 'left', 900, true);
  gateTag(gateOf(cid), 852, 450, 26);
  label('IN THE PADDOCK · ' + c.arch, 640, 494, 14, '#e6e9f8', 'left', 700, true);
  // entries
  const x = 46, y0 = 52, rowH = 43;
  MODES.forEach(([lab, id, desc], i) => {
    const y = y0 + i * rowH, s = i === UI.modeIdx, push = s ? 14 : 0;
    slant(x + push, y, 470, rowH - 6, 14, s ? 'rgba(255,255,255,.96)' : 'rgba(12,17,38,.82)');
    if (s) slant(x + push - 6, y, 8, rowH - 6, 14, PAL.rose);
    gateTag(i, x + push + 14, y + 8, 25);
    label(lab, x + push + 52, y + 14, 23, s ? PAL.ink : '#fff', 'left', 900, true);
    let meta = MODE_META[id] || '';
    if (id === 'cpu') meta = `◀ ${CPU_NAMES[cpuLevel]} ▶`;
    if (id === 'replays') meta = `${loadStored().length} SAVED`;
    if (id === 'account') meta = acctName() ? acctName().toUpperCase() : ACCT.on ? 'GUEST' : 'OFF';
    if (id === 'trials') { const t = ROSTER.reduce((s, c) => s + (trialDone[c] || []).length, 0), n = ROSTER.reduce((s, c) => s + trialsFor(c).length, 0); meta = `${t} / ${n} CLEARED`; }
    label(meta, x + push + 452, y + 14, 14, s ? '#5a6080' : PAL.dim, 'right', 700, true);
    label(desc, x + push + 52, y + 29, 12.5, s ? '#40466a' : '#aeb5d8', 'left', 600);
  });
  ticker(HGT - 54);
  hintBar('↑ ↓ choose    ·    F / Enter confirm    ·    H / Esc back');
}

// ---------------------------------------------------------------- character select ("entry")
function stallX(i) { return 43 + i * 98; }
function drawStalls(cursors) {   // cursors: [{i, col, tag}]; slot ROSTER.length is "random"
  for (let i = 0; i <= ROSTER.length; i++) {
    const x = stallX(i), y = 54, w = 90, h = 112, hot = cursors.filter(c => c.i === i);
    if (i === ROSTER.length) {   // random stall
      rrect(x - 4, y - 4, w + 8, h + 8, 6, '#2a3150');
      ctx.fillStyle = vgradC(y, y + h, hot.length ? PAL.rose : '#1a2142', '#0b0f24'); ctx.fillRect(x, y, w, h);
      ctx.save(); ctx.globalAlpha = 0.35; face(ROSTER[Math.floor(UI.t / 10) % ROSTER.length], false, x + 5, y + 18, 80, false); ctx.restore();
      txt('?', x + w / 2, y + 58, 56, '#fff', 'center', PAL.ink);
      ctx.fillStyle = PAL.rail; ctx.fillRect(x, y, w, 16); label('R', x + w / 2, y + 9, 15, PAL.ink, 'center', 900, true);
      ctx.fillStyle = 'rgba(8,11,28,.85)'; ctx.fillRect(x, y + h - 20, w, 20); label('RANDOM', x + w / 2, y + h - 9, 13.5, '#fff', 'center', 800, true);
      hot.forEach((c, k) => { ctx.strokeStyle = c.col; ctx.lineWidth = 4; ctx.strokeRect(x - 2 - k * 4, y - 2 - k * 4, w + 4 + k * 8, h + 4 + k * 8);
        slant(k ? x + w - 34 : x - 6, y - 22 - k * 4, 38, 18, 6, c.col); label(c.tag, k ? x + w - 13 : x + 15, y - 13 - k * 4, 15, '#fff', 'center', 900, true); });
      continue;
    }
    const cid = ROSTER[i];
    rrect(x - 4, y - 4, w + 8, h + 8, 6, '#2a3150');                       // metal frame
    ctx.fillStyle = vgradC(y, y + h, hot.length ? CHARS[cid].color : '#1a2142', '#0b0f24'); ctx.fillRect(x, y, w, h);
    face(cid, false, x + 5, y + 18, 80, i >= 4);
    ctx.fillStyle = GATE[i][0]; ctx.fillRect(x, y, w, 16);
    label(String(i + 1), x + w / 2, y + 9, 16, GATE[i][1], 'center', 900, true);
    ctx.fillStyle = 'rgba(8,11,28,.85)'; ctx.fillRect(x, y + h - 20, w, 20);
    label(nameOf(cid), x + w / 2, y + h - 9, nameOf(cid).length > 12 ? 12 : 13.5, '#fff', 'center', 800, true);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(200,210,240,.18)'; ctx.fillRect(x + 10 + k * 23, y + 16, 2, h - 36); }   // gate bars
    hot.forEach((c, k) => {
      ctx.strokeStyle = c.col; ctx.lineWidth = 4; ctx.strokeRect(x - 2 - k * 4, y - 2 - k * 4, w + 4 + k * 8, h + 4 + k * 8);
      slant(k ? x + w - 34 : x - 6, y - 22 - k * 4, 38, 18, 6, c.col); label(c.tag, k ? x + w - 13 : x + 15, y - 13 - k * 4, 15, '#fff', 'center', 900, true);
    });
  }
}
function vgradC(y0, y1, a, b) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function drawEntryCard(side, cid, done, who, alt, extra) {
  if (!cid) {   // random
    const x0 = side === 0 ? 16 : 486, y0 = 186;
    panel(x0, y0, 458, 306, side === 0 ? PAL.p1 : PAL.p2);
    const rc = ROSTER[Math.floor(UI.t / 6) % ROSTER.length];
    ctx.save(); ctx.globalAlpha = 0.25; drawSpr(rc, 'img', '800', 0, side === 0 ? x0 + 110 : x0 + 348, y0 + 280, side === 0 ? 1 : -1, 4); ctx.restore();
    slant(side === 0 ? x0 + 214 : x0 + 18, y0 + 14, 90, 22, 8, side === 0 ? PAL.p1 : PAL.p2); label(who, (side === 0 ? x0 + 214 : x0 + 18) + 12, y0 + 26, 15, '#fff', 'left', 900, true);
    txt('RANDOM', side === 0 ? x0 + 320 : x0 + 130, y0 + 120, 54, '#fff', 'center', PAL.ink);
    label('The gate draws a runner for you', side === 0 ? x0 + 320 : x0 + 130, y0 + 168, 15, '#dfe3f5', 'center', 600);
    if (extra) label(extra, side === 0 ? x0 + 320 : x0 + 130, y0 + 190, 13, PAL.dim, 'center', 600);
    return;
  }
  const c = CHARS[cid], x0 = side === 0 ? 16 : 486, y0 = 186, w = 458, h = 306, flip = side === 1;
  panel(x0, y0, w, h, side === 0 ? PAL.p1 : PAL.p2);
  const sx = flip ? x0 + w - 110 : x0 + 110;
  ctx.fillStyle = 'rgba(47,174,91,.35)'; ctx.beginPath(); ctx.ellipse(sx, y0 + h - 30, 90, 14, 0, 0, 7); ctx.fill();
  const pose = done ? c.win : '800', nf = SPR[cid].anims[pose][1];
  drawSpr(cid, alt ? 'alt' : 'img', pose, Math.floor(UI.t / 8) % nf, sx, y0 + h - 26, flip ? -1 : 1, 4);
  const ix = flip ? x0 + 18 : x0 + 214, iw = 226;
  slant(ix, y0 + 14, 90, 22, 8, side === 0 ? PAL.p1 : PAL.p2); label(who, ix + 12, y0 + 26, 15, '#fff', 'left', 900, true);
  gateTag(gateOf(cid), ix + iw - 28, y0 + 12, 26);
  plate(ix - 4, y0 + 44, iw + 8, 38, c.color, 10); label(nameOf(cid), ix + 8, y0 + 64, nameOf(cid).length > 13 ? 25 : 28, '#fff', 'left', 900, true);
  label(c.arch, ix + 2, y0 + 96, 16, PAL.gold, 'left', 800, true);
  const rt = RATING[cid] || [3, 3, 3, 3], hp = Math.max(1, Math.min(5, Math.round((c.hp - 7500) / 600)));
  [['HEALTH', hp], ['SPEED', rt[0]], ['POWER', rt[1]], ['RANGE', rt[2]], ['DIFFICULTY', rt[3]]].forEach(([n, v], k) => {
    const yy = y0 + 118 + k * 20; label(n, ix + 2, yy, 13, PAL.dim, 'left', 700); meterBar(ix + 86, yy - 6, 136, 12, v, k === 4 ? PAL.rose : PAL.turf);
  });
  ctx.font = font(14, 600, false); ctx.fillStyle = '#dfe3f5'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
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
  topBar('ENTRY · CHOOSE YOUR UMAMUSUME', { versus: 'VERSUS', cpu: `VS CPU · ${CPU_NAMES[cpuLevel]}`, training: 'TRAINING' }[UI.pendingMode]);
  const cur = [{ i: UI.sel[0], col: PAL.p1, tag: '1P' }];
  if (twoP || UI.selDone[0]) cur.push({ i: UI.sel[1], col: PAL.p2, tag: twoP ? '2P' : UI.pendingMode === 'cpu' ? 'CPU' : 'DUM' });
  drawStalls(cur);
  drawEntryCard(0, ROSTER[UI.sel[0]], UI.selDone[0], 'P1', false);
  const p2who = twoP ? 'P2' : UI.pendingMode === 'cpu' ? 'CPU' : 'DUMMY';
  drawEntryCard(1, ROSTER[UI.sel[1]], UI.selDone[1], p2who, UI.sel[0] === UI.sel[1], !twoP && !UI.selDone[0] ? 'Pick your runner first' : '');
  hintBar(twoP ? 'P1: A / D + F    ·    P2: ← / → + J    ·    H / L to cancel    ·    Esc back' : (UI.selDone[0] ? 'Now pick the opponent    ·    H to go back' : '← → choose    ·    F / Enter confirm    ·    Esc back'));
}

// ---------------------------------------------------------------- course select
const COURSE_N = () => STAGE_LIST.length + 1;   // + random
function drawStageSelect() {
  menuBg(0.7);
  topBar('COURSE SELECT', `${nameOf(ROSTER[UI.sel[0]] || 'spe')}  vs  ${nameOf(ROSTER[UI.sel[1]] || 'spe')}`);
  const i = UI.stageIdx, rnd = i === STAGE_LIST.length, show = rnd ? Math.floor(UI.t / 20) % STAGE_LIST.length : i;
  // big preview
  const px = 170, py = 56, pw = 620, ph = 300;
  rrect(px - 6, py - 6, pw + 12, ph + 12, 8, '#2a3150');
  ctx.imageSmoothingEnabled = true; ctx.drawImage(STAGES[show].thumb, 0, 40, W, HGT - 40, px, py, pw, ph); ctx.imageSmoothingEnabled = false;
  if (rnd) { ctx.fillStyle = 'rgba(8,11,28,.55)'; ctx.fillRect(px, py, pw, ph); txt('?', W / 2, py + ph / 2, 120, PAL.gold); }
  ctx.fillStyle = 'rgba(8,11,28,.82)'; ctx.fillRect(px, py + ph - 56, pw, 56);
  label(rnd ? 'RANDOM COURSE' : STAGE_LIST[i].name, px + 18, py + ph - 36, 30, '#fff', 'left', 900, true);
  label(rnd ? 'LEAVE IT TO THE DRAW' : STAGE_LIST[i].sub, px + 18, py + ph - 13, 15, PAL.gold, 'left', 700, true);
  ledText(`RACE ${String(i + 1)}`, px + pw - 18, py + 22, 3, PAL.led, 'right', 'rgba(255,180,58,.12)');
  // course cards
  const n = COURSE_N(), cw = 150, gap = 14, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, cy = 384;
  for (let k = 0; k < n; k++) {
    const x = x0 + k * (cw + gap), s = k === i, r = k === STAGE_LIST.length;
    rrect(x - 3, cy - 3, cw + 6, 90, 6, s ? PAL.gold : '#2a3150');
    if (r) { ctx.fillStyle = '#141b3a'; ctx.fillRect(x, cy, cw, 84); txt('RANDOM', x + cw / 2, cy + 42, 26, '#fff'); }
    else { ctx.imageSmoothingEnabled = true; ctx.drawImage(STAGES[k].thumb, 0, 60, W, HGT - 60, x, cy, cw, 84); ctx.imageSmoothingEnabled = false; }
    gateTag(k, x + 4, cy + 4, 22);
    if (!s) { ctx.fillStyle = 'rgba(8,11,28,.4)'; ctx.fillRect(x, cy, cw, 84); }
  }
  hintBar('← → choose a course    ·    F / Enter start    ·    H / Esc back to runners');
}

// ---------------------------------------------------------------- VS splash ("race card")
function drawVS() {
  const t = UI.vsT, k = Math.min(1, t / 14), e = 1 - Math.pow(1 - k, 3);
  const [c1, c2] = [ROSTER[UI.sel[0]], ROSTER[UI.sel[1]]];
  drawStage(STAGE_W / 2, UI.vsStage); ctx.fillStyle = 'rgba(8,11,28,.55)'; ctx.fillRect(0, 0, W, HGT);
  ctx.save(); ctx.globalAlpha = 0.92;
  ctx.fillStyle = CHARS[c1].color; ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(W * 0.56 * e, 60); ctx.lineTo(W * 0.44 * e, 440); ctx.lineTo(0, 440); ctx.fill();
  ctx.fillStyle = CHARS[c2].color; ctx.beginPath(); ctx.moveTo(W, 60); ctx.lineTo(W - W * 0.44 * e, 60); ctx.lineTo(W - W * 0.56 * e, 440); ctx.lineTo(W, 440); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.15; for (let i = 0; i < 14; i++) slant(-200 + i * 90 + (t * 6) % 90, 60, 30, 380, 120, '#fff'); ctx.restore();
  drawSpr(c1, 'img', '800', Math.floor(t / 8) % SPR[c1].anims['800'][1], -160 + 400 * e, 452, 1, 5.2);
  drawSpr(c2, UI.sel[0] === UI.sel[1] ? 'alt' : 'img', '800', Math.floor(t / 8) % SPR[c2].anims['800'][1], W + 160 - 400 * e, 452, -1, 5.2);
  plate(30, 352, 330, 46, PAL.ink, 14); label(nameOf(c1), 50, 375, 32, '#fff', 'left', 900, true); gateTag(gateOf(c1), 320, 361, 28);
  plate(W - 370, 352, 330, 46, PAL.ink, 14); label(nameOf(c2), W - 60, 375, 32, '#fff', 'right', 900, true); gateTag(gateOf(c2), W - 352, 361, 28);
  slant(40, 404, 150, 22, 8, 'rgba(8,11,28,.85)'); label(CHARS[c1].arch, 54, 415, 16, PAL.gold, 'left', 800, true);
  slant(W - 196, 404, 150, 22, 8, 'rgba(8,11,28,.85)'); label(CHARS[c2].arch, W - 60, 415, 16, PAL.gold, 'right', 800, true);
  const vs = Math.min(1, Math.max(0, (t - 10) / 10));
  ctx.save(); ctx.translate(W / 2, 236); ctx.scale(2 - vs, 2 - vs); ctx.globalAlpha = vs; txt('VS', 0, 0, 120, PAL.gold, 'center', PAL.ink); ctx.restore();
  ctx.fillStyle = 'rgba(8,11,28,.94)'; ctx.fillRect(0, 0, W, 60); ctx.fillRect(0, 440, W, 100);
  ledText('RACE CARD', 24, 30, 3, PAL.led, 'left', 'rgba(255,180,58,.1)');
  label(STAGE_LIST[UI.vsStage].name, W - 24, 24, 22, '#fff', 'right', 900, true);
  label(STAGE_LIST[UI.vsStage].sub, W - 24, 46, 14, PAL.gold, 'right', 700, true);
  railDivider(0, 456, W);
  label({ versus: 'VERSUS · BEST OF 3', cpu: `VS CPU · ${CPU_NAMES[cpuLevel]} · BEST OF 3`, training: 'TRAINING' }[UI.pendingMode] || '', W / 2, 492, 20, '#fff', 'center', 800, true);
  if (t > 20) label('press confirm to skip', W / 2, 518, 13, PAL.dim, 'center');
}

// ---------------------------------------------------------------- in-game HUD
function hpBar(p, i) {
  const flip = i === 1, bw = 326, bh = 20, top = 22;
  const x = flip ? W - 92 - bw : 92;
  // portrait medallion in the runner's gate colour
  const mx = flip ? W - 82 : 14, g = gateOf(p.cid);
  rrect(mx - 2, 10, 72, 72, 8, PAL.ink);
  rrect(mx + 2, 14, 64, 64, 6, vgradC(14, 78, p.c.color, PAL.navy));
  face(p.cid, p.alt, mx + 4, 16, 60, flip);
  ctx.fillStyle = GATE[g][0]; ctx.fillRect(mx + 2, 64, 20, 14); label(String(g + 1), mx + 12, 72, 13, GATE[g][1], 'center', 900, true);
  // bar body (slanted toward the timer)
  const k = flip ? -14 : 14, poly = (xx, ww, yy, hh) => { ctx.beginPath(); if (!flip) { ctx.moveTo(xx, yy); ctx.lineTo(xx + ww + k, yy); ctx.lineTo(xx + ww, yy + hh); ctx.lineTo(xx, yy + hh); } else { ctx.moveTo(xx + k, yy); ctx.lineTo(xx + ww, yy); ctx.lineTo(xx + ww, yy + hh); ctx.lineTo(xx, yy + hh); } ctx.closePath(); };
  ctx.fillStyle = PAL.ink; poly(x - 4, bw + 8, top - 4, bh + 8); ctx.fill();
  ctx.fillStyle = '#3a1520'; poly(x, bw, top, bh); ctx.fill();
  const frac = v => Math.max(0, Math.min(1, v / p.c.hp)) * bw;
  ctx.save(); poly(x, bw, top, bh); ctx.clip();
  ctx.fillStyle = '#ff5050'; flip ? ctx.fillRect(x + bw - frac(p.redHp), top, frac(p.redHp) + 20, bh) : ctx.fillRect(x - 20, top, frac(p.redHp) + 20, bh);
  const low = p.hp / p.c.hp < 0.3, hw = frac(p.dispHp);
  const grd = ctx.createLinearGradient(0, top, 0, top + bh);
  grd.addColorStop(0, low ? '#ffc56b' : '#fff7b0'); grd.addColorStop(0.5, low ? '#ff8a2a' : '#f6c343'); grd.addColorStop(1, low ? '#d9531a' : '#d99a14');
  ctx.fillStyle = grd; flip ? ctx.fillRect(x + bw - hw, top, hw + 20, bh) : ctx.fillRect(x - 20, top, hw + 20, bh);
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - 20, top + 3, bw + 40, 2);
  for (let f = 1; f < 10; f++) { ctx.fillStyle = 'rgba(10,14,31,.35)'; ctx.fillRect(x + f * bw / 10, top + (f % 5 ? 12 : 4), 2, bh); }   // furlong ticks
  ctx.restore();
  // name plate in the runner's colour + round rosettes
  const nx = flip ? x + bw - 236 : x;
  plate(nx, top + bh + 7, 236, 22, p.c.color, flip ? -8 : 8);
  label(nameOf(p.cid), flip ? nx + 226 : nx + 12, top + bh + 18, 17, '#fff', flip ? 'right' : 'left', 900, true);
  for (let w = 0; w < 2; w++) rosette(flip ? x + 16 + w * 26 : x + bw - 16 - w * 26, top + bh + 18, 10, PAL.gold, p.wins > w);
}
function spurtGauge(p, i) {
  const flip = i === 1, mw = 250, mh = 14, my = HGT - 34, mx = flip ? W - 30 - mw : 30;
  const full = p.meter >= 100, v = Math.min(1, p.meter / 100);
  ctx.fillStyle = PAL.ink; ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#1a2142'; ctx.fillRect(mx, my, mw, mh);
  const grd = ctx.createLinearGradient(mx, 0, mx + mw, 0);
  grd.addColorStop(0, PAL.turfD); grd.addColorStop(0.5, PAL.turf); grd.addColorStop(1, full ? '#c8ffde' : '#7ff0a8');
  ctx.fillStyle = full && !SET.calm && G.frameCount % 16 < 8 ? '#fff' : grd;
  flip ? ctx.fillRect(mx + mw - mw * v, my, mw * v, mh) : ctx.fillRect(mx, my, mw * v, mh);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(mx, my + 2, mw, 2);
  ctx.fillStyle = p.meter >= 50 ? PAL.gold : '#5a6290'; ctx.fillRect(mx + mw / 2 - 1, my - 6, 3, mh + 12);
  label('EX', mx + mw / 2, my - 12, 11, p.meter >= 50 ? PAL.gold : '#5a6290', 'center', 900, true);
  const lab = full ? 'LAST SPURT!' : `SPURT ${Math.floor(p.meter)}`;
  label(lab, flip ? mx + mw : mx, my - 12, 15, full ? PAL.gold : '#fff', flip ? 'right' : 'left', 900, true);
  // shortcut cooldown chips
  ['5S', '6S', '4S', '2S', 'jS'].filter(id => p.c.moves[id]).forEach((id, k) => {
    const m = p.c.moves[id], cw = 30, bx = flip ? mx - 12 - (k + 1) * (cw + 4) : mx + mw + 12 + k * (cw + 4), by = my - 6;
    const rem = (p.cd[id] || 0) / m.cd;
    rrect(bx, by, cw, 24, 4, PAL.ink); rrect(bx + 2, by + 2, cw - 4, 20, 3, rem > 0 ? '#2a3150' : p.c.color);
    if (rem > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx + 2, by + 2, (cw - 4) * rem, 20); }
    label({ '5S': 'S', '6S': '→S', '4S': '←S', '2S': '↓S', 'jS': 'jS' }[id], bx + cw / 2, by + 13, 13, rem > 0 ? '#7880a8' : '#fff', 'center', 800, true);
  });
}
function comboCounter(p, i) {
  const o = opp(p);
  if (!(o.combo >= 2 && ['hit', 'airHit', 'cineHit', 'down'].includes(o.state))) { p.comboShow = 0; return; }
  p.comboShow = Math.min(10, (p.comboShow || 0) + 1);
  const flip = i === 1, e = 1 - Math.pow(1 - p.comboShow / 10, 3), x = flip ? W - 24 + (1 - e) * 120 : 24 - (1 - e) * 120;
  ctx.save(); ctx.globalAlpha = e;
  slant(flip ? x - 170 : x - 10, 126, 180, 74, flip ? -12 : 12, 'rgba(8,11,28,.75)');
  txt(String(o.combo), flip ? x - 96 : x + 74, 154, 54, PAL.gold, flip ? 'right' : 'right', PAL.ink);
  label('HITS', flip ? x - 90 : x + 80, 148, 20, '#fff', 'left', 900, true);
  label(`${o.comboDmg} DMG  ·  NEXT ${Math.round(comboScale(o) * 100)}%`, flip ? x - 10 : x + 4, 188, 15, '#cfd5f0', flip ? 'right' : 'left', 700, true);
  if (o.limitHit) label('COMBO LIMIT', flip ? x - 10 : x + 4, 210, 14, '#9fe3ff', flip ? 'right' : 'left', 900, true);
  ctx.restore();
}
function drawHUD() {
  ctx.fillStyle = 'rgba(8,11,28,.35)'; ctx.fillRect(0, 0, W, 6);
  G.p.forEach((p, i) => { hpBar(p, i); spurtGauge(p, i); comboCounter(p, i); });
  // tote-board timer
  rrect(W / 2 - 44, 8, 88, 64, 8, PAL.ink); rrect(W / 2 - 40, 12, 80, 56, 6, '#140c06', PAL.goldD, 2);
  const tv = G.mode === 'training' ? '--' : String(G.timer).padStart(2, '0');
  ledText(tv, W / 2, 36, 5, G.timer <= 10 && G.mode !== 'training' ? '#ff5a4a' : PAL.led, 'center', 'rgba(255,180,58,.08)');
  label(G.mode === 'training' ? 'TRAINING' : `ROUND ${G.round}`, W / 2, 62, 11, PAL.gold, 'center', 800, true);
}
function drawTrainingHUD() {
  const t = G.training;
  panel(W / 2 - 250, 84, 500, 82, PAL.turf);
  const rs = { off: '', recording: '   ● REC', ready: '   [8] play', playing: '   ▶ PLAYBACK' }[TOOLS.recState];
  label(`[1] Dummy: ${t.dummy.toUpperCase()}    [2] Guard: ${t.block.toUpperCase()}    [3] Hitboxes: ${G.showBoxes ? 'ON' : 'OFF'}    [4] Reset`, W / 2, 100, 13.5, '#e6e9f8', 'center', 700);
  label(`[5] Inputs: ${TOOLS.inputs ? 'ON' : 'OFF'}    [6] Frame meter: ${TOOLS.meter ? 'ON' : 'OFF'}    [7] Record dummy${rs}`, W / 2, 118, 13.5, TOOLS.recState === 'recording' ? '#ff8a8a' : '#e6e9f8', 'center', 700);
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
    ctx.fillStyle = 'rgba(8,11,28,.72)'; ctx.fillRect(0, HGT / 2 - 64, W * e, 128);
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
    if (G.koType === 'ko') { slant(W / 2 - 150, HGT / 2 + 78, 300, 34, 10, 'rgba(8,11,28,.85)'); ledText('PHOTO FINISH', W / 2 + 5, HGT / 2 + 95, 2.6, PAL.led, 'center'); }
  } else if (G.posed) {
    const w = G.roundWinner, e = Math.min(1, (t - 100) / 10);
    ctx.fillStyle = 'rgba(8,11,28,.72)'; ctx.fillRect(0, HGT / 2 - 50, W * e, 100);
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
  ctx.fillStyle = 'rgba(8,11,28,.66)'; ctx.fillRect(0, 0, W, HGT);
  const w = G.p[0].wins >= 2 && G.p[1].wins >= 2 ? -1 : G.p[0].wins >= 2 ? 0 : 1;
  topBar('OFFICIAL RESULT', STAGE_LIST[G.stage || 0].name);
  if (w < 0) { txt('DEAD HEAT', W / 2, 220, 80, '#fff'); }
  else {
    const p = G.p[w], l = G.p[1 - w];
    // podium + winner
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(260, 452, 130, 18, 0, 0, 7); ctx.fill();
    rrect(160, 420, 200, 34, 4, PAL.gold); label('1ST', 260, 438, 24, PAL.ink, 'center', 900, true);
    const wa = winAnim(p); drawSpr(p.cid, p.alt ? 'alt' : 'img', wa, Math.floor(G.phaseT / 8) % SPR[p.cid].anims[wa][1], 260, 422, 1, 4.4);
    rosette(372, 150, 34, p.c.color, true);
    // result board
    const bx = 470, by = 74;
    rrect(bx, by, 460, 290, 8, '#120b05', PAL.goldD, 3);
    ledText('RESULT', bx + 230, by + 26, 3.4, PAL.led, 'center', 'rgba(255,180,58,.1)');
    [[p, '1'], [l, '2']].forEach(([q, place], k) => {
      const y = by + 70 + k * 74;
      ledText(place, bx + 36, y + 18, 5, k ? '#cfd5f0' : PAL.led);
      gateTag(gateOf(q.cid), bx + 70, y + 4, 30);
      label(nameOf(q.cid), bx + 112, y + 12, 28, '#fff', 'left', 900, true);
      label(`${q.side === 0 ? 'P1' : 'P2'} · ${q.c.arch}`, bx + 112, y + 36, 14, PAL.dim, 'left', 700, true);
      for (let r = 0; r < 2; r++) rosette(bx + 400 + r * 26, y + 20, 10, PAL.gold, q.wins > r);
    });
    railDivider(bx + 20, by + 230, 420, '#5a4a2a');
    ledText(`${p.wins} - ${l.wins}`, bx + 230, by + 262, 3.4, PAL.led);
  }
  if (UI.screen === 'replay') return;
  if (G.mode === 'online') { if (G.phaseT > 60 && G.phaseT % 60 < 40) txt('PRESS CONFIRM FOR THE LOBBY', W / 2 + 230, 404, 22, '#fff'); hintBar('R  watch replay    ·    D  save replay file    ·    confirm  back to the lobby'); return; }
  ['REMATCH', 'CHARACTER SELECT', 'MAIN MENU'].forEach((t, k) => {
    const s = k === (UI.resIdx || 0) && G.phaseT > 60, y = 384 + k * 38;
    slant(500 + (s ? 10 : 0), y, 400, 32, 10, s ? 'rgba(255,255,255,.96)' : 'rgba(12,17,38,.88)');
    gateTag(k, 510 + (s ? 10 : 0), y + 4, 24); label(t, 546 + (s ? 10 : 0), y + 17, 20, s ? PAL.ink : '#fff', 'left', 900, true);
  });
  hintBar('↑ ↓ choose    ·    confirm    ·    R  watch replay    ·    D  save replay file');
}
// super freeze banner
function drawSuperFlash(fo) {
  const k = Math.min(1, (38 - G.freeze) / 8);
  ctx.save(); ctx.globalAlpha = 0.9; slant(fo.side === 0 ? -20 : W - W * k - 20, 158, W * k + 40, 78, fo.side === 0 ? 30 : -30, fo.c.color); ctx.restore();
  railDivider(0, 154, W * k); railDivider(W - W * k, 236, W * k);
  face(fo.cid, fo.alt, fo.side === 0 ? 50 : W - 160, 122, 110, fo.side === 1);
  txt(((fo.move && fo.move.kind === 'super' ? fo.move : fo.c.moves.SU) || { name: 'SUPER' }).name.toUpperCase(), W / 2 + (fo.side === 0 ? 70 : -70), 197, 44, '#fff', 'center', PAL.ink);
}

// ---------------------------------------------------------------- pause
function drawPause() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(8,11,28,.55)'; ctx.fillRect(0, 0, W, HGT);
  slant(-40, 0, 420, HGT, 0, 'rgba(12,17,38,.95)'); ctx.fillStyle = PAL.gold; ctx.fillRect(380, 0, 3, HGT);
  txt('PAUSED', 40, 56, 56, '#fff', 'left', PAL.ink);
  ledText('STEWARDS INQUIRY', 42, 96, 2.2, PAL.led, 'left');
  const items = pauseItems(), sp = Math.min(36, (HGT - 136) / items.length), hh = sp - 6;
  items.forEach(([l], i) => {
    const s = i === UI.pauseIdx, y = 122 + i * sp;
    slant(28 + (s ? 10 : 0), y, 320, hh, 10, s ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.06)');
    gateTag(i, 38 + (s ? 10 : 0), y + (hh - Math.min(22, hh - 4)) / 2, Math.min(22, hh - 4));
    label(l, 72 + (s ? 10 : 0), y + hh / 2 + 1, Math.min(19, hh - 6), s ? PAL.ink : '#e6e9f8', 'left', 800, true);
  });
}

// ---------------------------------------------------------------- move list
function drawMoves() {
  menuBg(0.86);
  const cid = ROSTER[UI.movesChar], c = CHARS[cid];
  topBar('MOVE LIST', '← → runner    ·    ↑ ↓ moves / combos');
  plate(24, 50, 420, 36, c.color, 12); gateTag(gateOf(cid), 34, 55, 26);
  label(nameOf(cid), 70, 69, 26, '#fff', 'left', 900, true); label(c.arch, 456, 69, 16, PAL.gold, 'left', 800, true);
  ['MOVES', 'COMBOS'].forEach((t, k) => { const s = (UI.movesPage || 0) === k; slant(700 + k * 120, 52, 110, 30, 8, s ? PAL.gold : 'rgba(255,255,255,.08)'); label(t, 755 + k * 120, 68, 17, s ? PAL.ink : '#cfd5f0', 'center', 900, true); });
  if (UI.movesPage) { drawCombos(c); return; }
  const rows = [
    ['Auto-combo', 'L, L, L, L', 'Mash L on hit: 5L → 5M → 5H → S'],
    ['Block', 'hold ←  (↙ for lows)', 'Works out of a dash too · overheads must be blocked standing'],
    ['Throw', 'L + M (close)', 'Hold back for a back throw · tech with L + M'],
    ['Dash / dash attacks', '→→  ·  →→ + L/M/H', 'L jab · M lunge · H flying kick (overhead)'],
    ['Hop overhead', '→ + M', 'Must be blocked standing · lows beat it'],
    ['Counter Spurt', 'S + H while blocking', 'Costs 50 Spurt · invincible push-away'],
    ['Taunt', 'L + H', '+8 Spurt · every hit on a taunt is a counter-hit'],
    ['Quick / slow rise', 'hold button / hold ↓', 'While knocked down (not after throws or supers)'],
    ['Skills', 'motion + L / M  ·  motion + H', 'L and M versions are free · H is the EX (50 Spurt)'],
    ['Skill shortcut', 'S + direction', 'Easy version of the M skill: cooldown, -10% damage'],
  ];
  if (c.lightChain) rows.push(['Low chain (' + c.short + ')', '2L, 2L, 2L…', 'Crouching jabs chain into themselves']);
  if (c.dashCancel) rows.push(['Dash cancel (' + c.short + ')', '→→ while a normal connects', 'Costs 10 Spurt · keep the pressure on']);
  if (c.airDash) rows.push(['Air dash (' + c.short + ')', '→→ / ←← in the air', 'Once per jump, needs some height']);
  if (c.punisher) rows.push(['Punish (' + c.short + ')', 'hit them while they recover', '+20% damage and extra hitstun: PUNISH!']);
  if (c.specialChain) rows.push(['Special chain (' + c.short + ')', 'skill › another skill on hit', 'Each skill once per combo']);
  if (c.lowHpBoost) rows.push(['Miracle mode (' + c.short + ')', 'below 30% health', '+15% damage']);
  const sp = Object.values(c.moves).filter(m => m.name && (m.kind === 'special' || m.kind === 'super') && !m.isEx && !m.varOf && !m.followOf);
  panel(20, 94, W - 40, 414, c.color);
  let y = 110;
  label('UNIVERSAL', 40, y, 15, PAL.gold, 'left', 900, true); y += 19;
  for (const r of rows) { line3(r, y); y += 17.5; }
  y += 5; label('SKILLS & SUPER', 40, y, 15, PAL.gold, 'left', 900, true); y += 19;
  for (const m of sp) {
    line3([m.name, m.input + (m.motion ? '  ·  ' + arrows(m.motion) + '+atk' : ''), m.kind === 'super' ? 'SUPER' + (m.note ? ' · ' + m.note : '') : (m.note || '') + (m.vnote ? '  (' + m.vnote + ')' : '')], y, m.kind === 'super' ? c.color : '#fff');
    y += 17.5;
    if (m.fnote) { line3(['   follow-ups', '', m.fnote], y, '#9ff'); y += 17.5; }
    if (m.ex) { line3(['   EX', arrows(m.motion) + ' + H', m.ex.note || ''], y, PAL.gold); y += 17.5; }
  }
  hintBar('← → switch runner    ·    ↑ ↓ moves / combos    ·    any button to go back');
}
function comboText(seq) {
  return seq.replace(/ , /g, ' , ').split(' ').map(t => t === 'jc' ? '(jump)' : t === 'dc' ? '(→→)' : t === ',' ? '(link)' : t.replace(/^(\d{3,5})([LMH])$/, (_, mo, b) => arrows(mo) + b)).join('  ›  ');
}
function drawCombos(c) {
  panel(20, 94, W - 40, 414, c.color);
  label('STARTER COMBOS', 40, 112, 15, PAL.gold, 'left', 900, true);
  let y = 140;
  for (const cb of (c.combos || [])) {
    slant(36, y - 14, 880, 58, 8, 'rgba(255,255,255,.05)');
    label(cb.name, 52, y + 2, 20, '#fff', 'left', 900, true);
    label(comboText(cb.seq), 250, y + 2, 20, '#7fe0ff', 'left', 800, true);
    label(cb.note || '', 250, y + 26, 14, '#c9cfe8', 'left', 600);
    y += 64;
  }
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(36, 460, W - 72, 42);
  label('COMBO RULES', 48, 471, 12, PAL.gold, 'left', 900, true);
  label('Scaling: 1st hit full, then light starters 80% · mediums 90% · heavies 100%, and −13% per hit from the 3rd (min 25%, supers 50%)', 140, 471, 12.5, '#c9cfe8', 'left', 600);
  label('Juggle: 10 points · j.H in an air combo ground-bounces (once) · EX knockdowns wall-bounce (once) · after 2s hitstun shrinks · hard limit 32 hits / 7s', 140, 490, 12.5, '#c9cfe8', 'left', 600);
  hintBar('← → switch runner    ·    ↑ ↓ moves / combos    ·    any button to go back');
}
function arrows(mo) { return mo.split('').map(d => ({ 1: '↙', 2: '↓', 3: '↘', 4: '←', 6: '→', 7: '↖', 8: '↑', 9: '↗' })[d]).join(''); }
function line3(r, y, col = '#fff') {
  label(r[0], 44, y, 15, col, 'left', 700); label(r[1], 300, y, 15, '#7fe0ff', 'left', 700);
  ctx.save(); ctx.beginPath(); ctx.rect(520, y - 10, W - 560, 20); ctx.clip(); label(r[2], 520, y, 14, '#c9cfe8', 'left', 600); ctx.restore();
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
    const y = 98 + i * 28.5, selRow = i === C.row;
    if (selRow) slant(40, y - 13, W - 92, 26, 6, 'rgba(255,255,255,.1)');
    label(r.label, xs[0], y, 16, r.act ? PAL.gold : '#fff', 'left', r.act ? 900 : 700, !!r.act);
    if (r.act) return;
    const cells = [KEYMAP[0][r.a].map(keyName).join(' / ') || '—', KEYMAP[1][r.a].map(keyName).join(' / ') || '—', (PADMAP[r.a] || []).map(b => PADNAMES[b] || 'B' + b).join(' / ') || '—'];
    cells.forEach((t, k) => {
      const active = selRow && C.col === k, waiting = active && UI.ctl && UI.ctl.wait;
      if (active) slant(xs[k + 1] - 10, y - 12, 180, 24, 6, waiting ? PAL.gold : PAL.rose);
      label(waiting ? (k < 2 ? 'press a key…' : 'press a button…') : t, xs[k + 1], y, 15, waiting ? PAL.ink : active ? '#fff' : '#7fe0ff', 'left', 700);
    });
  });
  const w = UI.ctl && UI.ctl.wait;
  hintBar(w ? 'Press the new input    ·    Esc to cancel' : '↑ ↓ action    ·    ← → column    ·    Enter / F rebind    ·    Esc back    ·    ` toggles hitboxes in a match');
}

// ---------------------------------------------------------------- replays
function drawReplaysMenu() {
  menuBg(0.82);
  topBar('REPLAYS', `build ${BUILD}`);
  const items = replayMenuItems();
  items.forEach((it, i) => {
    const y = 66 + i * 46, s = i === RM.idx;
    if (y > HGT - 70) return;
    slant(60 + (s ? 10 : 0), y, 800, 38, 12, s ? 'rgba(255,255,255,.96)' : 'rgba(12,17,38,.85)');
    gateTag(i, 72 + (s ? 10 : 0), y + 6, 26);
    label(it.label, 110 + (s ? 10 : 0), y + (it.sub ? 13 : 20), 19, s ? PAL.ink : '#fff', 'left', 800, true);
    if (it.sub) label(it.sub, 110 + (s ? 10 : 0), y + 29, 12.5, s ? '#4a5070' : PAL.dim, 'left', 600);
  });
  hintBar('Enter / F watch    ·    D save the selected replay as a file    ·    Esc back');
}
function drawReplayHUD() {
  const y = 96, w = 440, x = W / 2 - w / 2;
  panel(x - 14, y - 22, w + 28, 66, PAL.rose);
  ctx.fillStyle = '#2a3150'; ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = PAL.rose; ctx.fillRect(x, y, w * (RP.idx / Math.max(1, RP.n)), 8);
  const sec = f => `${Math.floor(f / 3600)}:${String(Math.floor(f / 60) % 60).padStart(2, '0')}`;
  label(`REPLAY  ${RP.paused ? '❚❚' : '▶'} ${RP.speed}x   ${sec(RP.idx)} / ${sec(RP.n)}`, W / 2, y - 8, 16, '#fff', 'center', 800, true);
  label('Space pause · ←/→ ±5s · ↑/↓ speed · . step · R restart · ` hitboxes · D save · Esc exit', W / 2, y + 24, 12, '#b9bfdc', 'center', 600);
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
    drawEntryCard(side, ROSTER[picks[side]] || null, ready[side], (netName(side) || (side === 0 ? 'P1' : 'P2')) + (mine ? ' · YOU' : ''), side === 1 && picks[0] === picks[1], mine ? '' : (ready[side] ? '' : 'choosing…'));
  }
  // course + music (P1, the host, decides)
  const host = Net.role === 'host', st = host ? Net.stage : Net.theirStage, mu = host ? netMusic() : (Net.theirMusic || ROSTER[picks[0]]);
  [['COURSE', st === STAGE_LIST.length ? 'RANDOM' : STAGE_LIST[st || 0].name], ['MUSIC', TRACK_TITLE(mu)]].forEach(([k, v], j) => {
    const x = j ? W / 2 + 6 : W / 2 - 336, f = host && Net.focus === j + 1;
    slant(x, 167, 330, 24, 8, f ? 'rgba(255,255,255,.95)' : 'rgba(8,11,28,.92)');
    label(k, x + 14, 179, 13, f ? PAL.rose : PAL.dim, 'left', 900, true);
    label((f ? '◀ ' : '') + v + (f ? ' ▶' : ''), x + 76, 179, 14, f ? PAL.ink : PAL.gold, 'left', 800, true);
  });
  if (!host) label('course and music: P1 (host) picks', W / 2, 202, 12, PAL.dim, 'center');
  if (Net.theirBuild && Net.theirBuild !== BUILD) {
    panel(W / 2 - 330, 220, 660, 96, PAL.p2);
    txt('DIFFERENT GAME VERSIONS', W / 2, 248, 26, '#fff');
    label(`You have build ${BUILD}, your friend has build ${Net.theirBuild}.`, W / 2, 276, 15, '#ffd6dc', 'center', 700);
    label('Matches would desync: make sure you both open the same file.', W / 2, 298, 15, '#ffd6dc', 'center', 700);
  } else if (!Net.theirBuild) label('checking versions…', W / 2, 206, 14, '#cfd3ea', 'center', 700);
  hintBar(Net.role === 'host' ? (Net.myReady ? '↑ ↓ runner / course / music    ·    ← → change    ·    H unlock runner    ·    waiting for your friend…' : '↑ ↓ runner / course / music    ·    ← → change    ·    F / Enter lock in    ·    Esc leave')
    : (Net.myReady ? 'Waiting for your friend…    ·    H to change' : '← → choose    ·    F / J / Enter lock in    ·    Esc leave'));
}
function drawNetHUD() {
  const r = Net.rbFrames ? ` · rollback ${Net.rbFrames}f` : '';
  label(`ONLINE · ${Math.round(Net.ping)} ms · delay ${Net.delay}${r}`, W / 2, 84, 12, '#cfe3ff', 'center', 700);
  for (const sd of [0, 1]) { const n = netName(sd); if (n) label(n, sd === 0 ? 112 : W - 112, 84, 14, '#fff', sd === 0 ? 'left' : 'right', 900, true); }
  if (Net.waiting && Net.stalls > 20) txt('waiting for opponent…', W / 2, 104, 18, PAL.gold);
  if (Net.desync >= 0) txt(`DESYNC at frame ${Net.desync}: please report what happened`, W / 2, 124, 15, '#ff6b6b');
  if (Net.menu) {
    panel(W / 2 - 230, HGT / 2 - 60, 460, 120, PAL.rose);
    txt('Leave the match?', W / 2, HGT / 2 - 20, 32, '#fff');
    label('F / Enter = leave    ·    Esc / H = keep playing', W / 2, HGT / 2 + 24, 15, '#cfd3ea', 'center', 700);
  }
}
function drawOnlineBg() { menuBg(0.7); topBar('ONLINE', 'peer-to-peer · rollback netcode'); }

// ---------------------------------------------------------------- battle music select (after the course)
function drawMusicSelect() {
  menuBg(0.72);
  topBar('MUSIC SELECT', `${STAGE_LIST[UI.vsStage || 0].name}`);
  const n = THEME_IDS.length, cw = 102, gap = 8, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y = 250;
  label('BATTLE THEME', W / 2, 74, 16, PAL.gold, 'center', 900, true);
  const id = THEME_IDS[UI.musicIdx], c = CHARS[id];
  plate(W / 2 - 300, 96, 600, 64, c.color, 18);
  txt(TRACK_TITLE(id), W / 2 + 10, 128, 40, '#fff', 'center', PAL.ink);
  label(id === ROSTER[UI.sel[0]] ? 'P1\'s runner (default)' : 'swapped from P1\'s runner', W / 2, 180, 14, '#dfe3f5', 'center', 600);
  // equaliser while the preview plays
  for (let i = 0; i < 28; i++) { const h = 6 + Math.abs(Math.sin(UI.t / (6 + i % 5) + i)) * 26; ctx.fillStyle = i % 2 ? PAL.gold : PAL.rose; ctx.fillRect(W / 2 - 196 + i * 14, 236 - h, 9, h); }
  for (let k = 0; k < n; k++) {
    const x = x0 + k * (cw + gap), sel = k === UI.musicIdx, cid = THEME_IDS[k];
    rrect(x - 3, y - 3, cw + 6, 128, 6, sel ? PAL.gold : '#2a3150');
    ctx.fillStyle = vgradC(y, y + 122, sel ? CHARS[cid].color : '#1a2142', '#0b0f24'); ctx.fillRect(x, y, cw, 122);
    face(cid, false, x + 11, y + 14, 80, false);
    ctx.fillStyle = GATE[k][0]; ctx.fillRect(x, y, cw, 14); label(String(k + 1), x + cw / 2, y + 8, 13, GATE[k][1], 'center', 900, true);
    ctx.fillStyle = 'rgba(8,11,28,.85)'; ctx.fillRect(x, y + 98, cw, 24);
    label(nameOf(cid), x + cw / 2, y + 110, nameOf(cid).length > 12 ? 12 : 13.5, '#fff', 'center', 800, true);
    if (cid === ROSTER[UI.sel[0]]) { slant(x + 4, y + 18, 30, 16, 5, PAL.p1); label('P1', x + 19, y + 26, 12, '#fff', 'center', 900, true); }
  }
  label('A tied match switches to the Third Round Theme for the final round.', W / 2, 410, 14, PAL.dim, 'center', 600);
  hintBar('← → choose (preview plays)    ·    F / Enter confirm    ·    H / Esc back to courses');
}

// ---------------------------------------------------------------- sound test / audio options
const SOUND_ROWS = () => [{ k: 'music', label: 'Music volume' }, { k: 'sfx', label: 'Effects volume' }, { k: 'calm', label: 'Reduce flashes & shake' }, { k: 'full', label: 'Fullscreen' }, ...['menu', ...THEME_IDS, 'round3'].map(id => ({ k: 'track', id, label: TRACK_TITLE(id) })), { k: 'back', label: 'Back' }];
function drawSound() {
  menuBg(0.82);
  topBar('OPTIONS', 'saved in this browser');
  const rows = SOUND_ROWS();
  panel(40, 52, 540, 456, PAL.rose);
  rows.forEach((r, i) => {
    const y = 70 + i * 28, sel = i === UI.soundIdx;
    if (sel) slant(52, y - 13, 516, 26, 8, 'rgba(255,255,255,.95)');
    const col = sel ? PAL.ink : '#e6e9f8';
    if (r.k === 'music' || r.k === 'sfx') {
      label(r.label, 70, y, 17, col, 'left', 800, true);
      const v = r.k === 'music' ? Music.vol : Sfx.vol;
      meterBar(300, y - 7, 200, 14, Math.round(v * 5), PAL.turf);
      label(`${Math.round(v * 100)}%`, 548, y, 15, col, 'right', 800, true);
    } else if (r.k === 'calm' || r.k === 'full') {
      label(r.label, 70, y, 17, col, 'left', 800, true);
      label(r.k === 'calm' ? (SET.calm ? 'ON' : 'OFF') : (document.fullscreenElement ? 'ON' : 'OFF'), 548, y, 15, col, 'right', 900, true);
    } else if (r.k === 'track') {
      const playing = MD.jukebox === r.id && Music.cur === r.id;
      label((playing ? '♪ ' : '') + r.label, 70, y, 17, playing && !sel ? PAL.gold : col, 'left', 800, true);
      if (THEME_IDS.includes(r.id)) gateTag(gateOf(r.id), 514, y - 11, 22);
    } else label(r.label, 70, y, 17, sel ? PAL.ink : PAL.gold, 'left', 900, true);
  });
  // now playing
  const id = Music.cur;
  panel(604, 54, 316, 220, PAL.gold);
  label('NOW PLAYING', 624, 80, 15, PAL.gold, 'left', 900, true);
  if (id) {
    if (THEME_IDS.includes(id)) drawSpr(id, 'img', '800', Math.floor(UI.t / 9) % SPR[id].anims['800'][1], 762, 260, -1, 2.6);
    label(TRACK_TITLE(id), 624, 106, 20, '#fff', 'left', 900, true);
    const a = Music.els[id];
    if (a && a.duration) { const f = a.currentTime / a.duration; ctx.fillStyle = '#2a3150'; ctx.fillRect(624, 124, 276, 6); ctx.fillStyle = PAL.rose; ctx.fillRect(624, 124, 276 * f, 6);
      const m = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; label(`${m(a.currentTime)} / ${m(a.duration)}`, 900, 142, 13, PAL.dim, 'right', 600); }
  } else label('—', 624, 106, 20, PAL.dim, 'left', 900, true);
  if (Music.blocked) label('Press any key to allow audio', 624, 250, 14, PAL.gold, 'left', 700);
  hintBar('↑ ↓ choose    ·    ← → change volume    ·    F / Enter play a track    ·    Esc back');
}

// ---------------------------------------------------------------- account (Update 1.8)
function drawAccount() {
  menuBg(0.72);
  topBar('ACCOUNT', acctOn() ? 'signed in · settings saved to your account' : ACCT.on ? 'playing as a guest' : 'accounts are off in this copy');
  if (!acctOn()) { hintBar('Tab / click to move between boxes    ·    Enter to confirm    ·    Esc back'); return; }
  const p = ACCT.profile, st = ACCT.stats || {}, fav = (p && p.fav_runner) || 'spe', c = CHARS[fav];
  // ---- profile card
  panel(30, 60, 400, 412, c.color);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(230, 300, 96, 14, 0, 0, 7); ctx.fill();
  drawSpr(fav, 'img', '800', Math.floor(UI.t / 9) % SPR[fav].anims['800'][1], 230, 304, 1, 3.4);
  plate(50, 78, 360, 44, c.color, 14); label(p ? p.name : '…', 70, 101, 30, '#fff', 'left', 900, true);
  label(p ? 'joined ' + new Date(p.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '', 404, 140, 13, PAL.dim, 'right', 700);
  // stats
  const games = st.games || 0, wins = st.wins || 0, og = st.online_games || 0, ow = st.online_wins || 0;
  const boxes = [['MATCHES', String(games)], ['WINS', String(wins)], ['WIN RATE', games ? Math.round(100 * wins / games) + '%' : '—'], ['ONLINE', og ? `${ow}-${og - ow}` : '—']];
  boxes.forEach(([k, v], i) => { const x = 46 + i * 92; rrect(x, 322, 84, 58, 5, 'rgba(255,255,255,.06)'); label(k, x + 42, 336, 12, PAL.dim, 'center', 800, true); txt(v, x + 42, 362, 26, '#fff'); });
  if (st.main_runner) { label('MOST PLAYED', 50, 404, 12, PAL.dim, 'left', 800, true); face(st.main_runner, 0, 50, 414, 44); label(nameOf(st.main_runner), 102, 437, 18, '#fff', 'left', 900, true); }
  // ---- rows
  const rows = { fav: `Favourite runner   ◀ ${nameOf(fav)} ▶`, name: 'Change name', sync: 'Save settings now', out: 'Sign out', back: 'Back' };
  ACCT_ROWS.forEach((r, i) => {
    const y = 300 + i * 34, s = i === ACCT.idx, x = 458 + (s ? 10 : 0);
    slant(x, y, 470, 30, 10, s ? 'rgba(255,255,255,.96)' : 'rgba(12,17,38,.82)');
    if (s) slant(x - 6, y, 8, 30, 10, PAL.rose);
    label(rows[r], x + 20, y + 15, 18, s ? PAL.ink : '#fff', 'left', 900, true);
  });
  // ---- recent matches
  panel(458, 60, 472, 226, PAL.turf);
  label('RECENT MATCHES', 474, 80, 15, PAL.gold, 'left', 900, true);
  if (!ACCT.recent.length) label('Play online or VS CPU while signed in and your results show up here.', 474, 110, 14, '#cfd3ea', 'left', 600);
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
  const n = acctName();
  slant(-10, 10, 230, 28, 10, 'rgba(8,11,28,.78)');
  if (n) { face(ACCT.profile.fav_runner, 0, 10, 12, 24); label(n, 40, 25, 16, '#fff', 'left', 900, true); }
  else label('GUEST  ·  sign in from ACCOUNT', 14, 25, 13, PAL.dim, 'left', 800, true);
}
// online: show account names instead of P1/P2 when we have them
function netName(side) { if (G.mode !== 'online' && UI.screen !== 'netselect') return null; return side === Net.side ? acctName() : (Net.theirWho && Net.theirWho.name) || null; }
