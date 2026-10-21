// Replays. The sim is deterministic, so a replay is just the build id, the
// characters and both players' inputs for every frame.
'use strict';

const REPLAY_KEY = 'umavs.replays';
const REPLAY_KEEP = 8;
const Rec = { on: false, mode: '', c: [], frames: [] };   // recorder
let lastReplay = null;

function recStart(mode, c1, c2) { Object.assign(Rec, { on: true, mode, c: [c1, c2], frames: [] }); }
function recFrame(ins) { if (Rec.on) Rec.frames.push(encIn(ins[0]), encIn(ins[1])); }
function recStop() { Rec.on = false; }

function bytesToB64(arr) { let s = ''; for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode.apply(null, arr.slice(i, i + 0x8000)); return btoa(s); }
function b64ToBytes(b) { const s = atob(b); const a = new Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

function makeReplay(mode, c, frames) {
  const w = G.p.map(p => p.wins);
  return {
    format: 'umavs-replay', v: 2, build: BUILD, date: new Date().toISOString(), mode, c, stage: G.stage || 0, music: G.music || c[0],
    names: c.map(id => CHARS[id] ? CHARS[id].name : id),
    winner: w[0] >= 2 && w[1] >= 2 ? -1 : w[0] >= 2 ? 0 : w[1] >= 2 ? 1 : -1,
    nframes: frames.length / 2, data: bytesToB64(frames.flatMap(v => [v & 255, v >> 8])),
  };
}
// local modes: called when the match reaches the results screen
function recFinish() {
  if (!Rec.on) return;
  recStop();
  lastReplay = makeReplay(Rec.mode, Rec.c, Rec.frames);
  storeReplay(lastReplay);
}
// online: rebuild from the confirmed input history (identical on both sides)
function recFinishOnline() {
  let end = Net.F - 1;
  for (let f = 0; f < Net.F; f++) if (Net.phaseAt[f] === 'match') { end = f; break; }
  const frames = [];
  for (let f = 0; f <= end; f++) {
    const mine = Net.local[f] ?? 0, theirs = Net.remote[f] ?? 0;
    if (Net.side === 0) frames.push(mine, theirs); else frames.push(theirs, mine);
  }
  lastReplay = makeReplay('online', [...G.p.map(p => p.cid)], frames);
  storeReplay(lastReplay);
}

// ------------------------------------------------------------------ storage (per-browser convenience)
function loadStored() { try { return JSON.parse(localStorage.getItem(REPLAY_KEY) || '[]'); } catch (e) { return []; } }
function storeReplay(r) {
  try {
    const list = loadStored(); list.unshift(r);
    localStorage.setItem(REPLAY_KEY, JSON.stringify(list.slice(0, REPLAY_KEEP)));
  } catch (e) { /* storage blocked or full: the in-memory "last match" still works */ }
}
function downloadReplay(r) {
  if (!r) return;
  try {
    const blob = new Blob([JSON.stringify(r)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `umavs_${r.c[0]}-vs-${r.c[1]}_${r.date.slice(0, 16).replace(/[:T]/g, '-')}.umarep`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Replay saved to your downloads');
  } catch (e) { toast('Downloads are blocked here. Open the game in a normal browser tab.'); }
}
function pickReplayFile() {
  const inp = document.getElementById('repFile');
  inp.value = '';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    f.text().then(t => {
      try {
        const r = JSON.parse(t);
        if (r.format !== 'umavs-replay') throw new Error('not a replay');
        storeReplay(r); playReplay(r);
      } catch (e) { toast('That file is not an Uma Versus replay'); }
    });
  };
  inp.click();
}
let toastMsg = '', toastT = 0;
function toast(s) { toastMsg = s; toastT = 180; }

// ------------------------------------------------------------------ playback
const RP = { rep: null, frames: null, idx: 0, speed: 1, paused: false, acc: 0, snaps: {}, n: 0, warn: '' };
const SPEEDS = [0.25, 0.5, 1, 2, 4];
function playReplay(r) {
  if (!CHARS[r.c[0]] || !CHARS[r.c[1]]) { toast('This replay uses a character this version doesn\'t have'); return; }
  const raw = b64ToBytes(r.data);
  const vals = r.v >= 2 ? raw.filter((_, i) => i % 2 === 0).map((lo, i) => lo | (raw[i * 2 + 1] << 8)) : raw;
  Object.assign(RP, { rep: r, frames: vals, idx: 0, speed: 1, paused: false, acc: 0, snaps: {}, n: r.nframes,
    warn: r.build !== BUILD ? `Recorded on build ${r.build} (you have ${BUILD}), so it may not play back right` : '' });
  startMatch('replay', r.c[0], r.c[1]);
  G.stage = r.stage || 0; G.music = r.music || r.c[0];
  RP.snaps[0] = snapshot();
  UI.screen = 'replay'; UI.paused = false;
}
function replayInputs(i) { return [decIn(RP.frames[i * 2]), decIn(RP.frames[i * 2 + 1])]; }
function replayStep() {
  if (RP.idx >= RP.n) return false;
  if (RP.idx % 120 === 0 && !RP.snaps[RP.idx]) RP.snaps[RP.idx] = snapshot();
  step(replayInputs(RP.idx)); RP.idx++;
  return true;
}
function replaySeek(target) {
  target = Math.max(0, Math.min(RP.n, target));
  let base = 0;
  for (const k in RP.snaps) if (+k <= target && +k > base) base = +k;
  if (target < RP.idx || base > RP.idx) { restore(RP.snaps[base]); RP.idx = base; }
  G.resim = true;
  while (RP.idx < target && replayStep());
  G.resim = false;
  G.fx = []; G.texts = []; for (const p of G.p) { p.dispHp = p.redHp = p.hp; p.trail = []; }
}
function replayTick(e, edges, esc) {
  const has = k => edges.includes(k);
  if (esc || e.H) { UI.screen = Net.connected ? 'netselect' : 'replays'; return; }
  if (has('Space') || has('Enter') || e.L || e.S) RP.paused = !RP.paused;
  if (e.u) RP.speed = SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(RP.speed) + 1)];
  if (e.d) RP.speed = SPEEDS[Math.max(0, SPEEDS.indexOf(RP.speed) - 1)];
  if (e.l) replaySeek(RP.idx - 300);
  if (e.r) replaySeek(RP.idx + 300);
  if (has('Home') || has('KeyR')) replaySeek(0);
  if (has('Period') || e.M) { RP.paused = true; replayStep(); }
  if (has('Backquote') || has('Digit3')) G.showBoxes = !G.showBoxes;
  if (has('KeyD')) downloadReplay(RP.rep);
  if (RP.paused) return;
  RP.acc += RP.speed;
  while (RP.acc >= 1) { RP.acc--; if (!replayStep()) { RP.paused = true; break; } }
}

// ------------------------------------------------------------------ replays menu
const RM = { idx: 0 };
function replayMenuItems() {
  const items = [];
  if (lastReplay) items.push({ label: 'Watch last match', sub: describe(lastReplay), act: () => playReplay(lastReplay), rep: lastReplay });
  for (const r of loadStored()) if (!lastReplay || r.date !== lastReplay.date) items.push({ label: describe(r), sub: new Date(r.date).toLocaleString(), act: () => playReplay(r), rep: r });
  items.push({ label: 'Load a replay file…', sub: '.umarep files from friends', act: pickReplayFile });
  items.push({ label: 'Back', act: () => { UI.screen = 'mode'; Sfx.play('back'); } });
  return items;
}
function describe(r) {
  const w = r.winner >= 0 ? ` · ${r.winner === 0 ? 'P1' : 'P2'} won` : '';
  return `${r.names[0]} vs ${r.names[1]} (${r.mode})${w}`;
}
function replaysMenuTick(e, enter, esc, edges) {
  const items = replayMenuItems();
  RM.idx = Math.min(RM.idx, items.length - 1);
  if (e.u) { RM.idx = (RM.idx + items.length - 1) % items.length; Sfx.play('menu'); }
  if (e.d) { RM.idx = (RM.idx + 1) % items.length; Sfx.play('menu'); }
  if (e.L || e.S || enter) { Sfx.play('ok'); items[RM.idx].act(); }
  if (edges.includes('KeyD') && items[RM.idx].rep) downloadReplay(items[RM.idx].rep);
  if (esc || e.H) { UI.screen = 'mode'; Sfx.play('back'); }
}
