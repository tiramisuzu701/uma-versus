// Training tools: combo trials (with demos), input display, frame meter and
// dummy recording. None of it runs online.
'use strict';

// advanced routes on top of each runner's listed starter combos ("," = link: wait until you recover)
const TRIAL_EXTRA = {
  spe: [{ name: 'Ground bounce relaunch', seq: '2M 2H jc j.M j.H 2H 623M', note: 'j.H in an air combo slams them into a ground bounce. Relaunch with 2H' },
        { name: 'Corner wall bounce', seq: '5M 5H 41236H , 5M 5H', note: 'EX Last Spurt Tackle wall-bounces in the corner. Link 5M after you recover', corner: true }],
  suz: [{ name: 'Double air combo', seq: '2M 2H jc j.M j.H 2H jc j.M j.H', note: 'Ground bounce off j.H, then launch and jump again' }],
  gs: [{ name: 'Dash cancel string', seq: '5M dc dL 5M dc dL 5H', note: 'Two dash cancels (10 Spurt each) before the heavy' },
       { name: 'Corner dropkick bounce', seq: '5L 5M 5H 623H , 5H 623M', note: 'EX Golshi Dropkick!! wall-bounces. Land, 5H, dropkick again', corner: true }],
  vo: [{ name: 'Double air combo', seq: '5M 5H jc j.M j.H 2H jc j.M j.H', note: 'Ground bounce off j.H, relaunch with 2H, air combo again' },
       { name: 'Corner throttle bounce', seq: '5M 5H 236H , 5H jc j.M j.H', note: 'EX Full Throttle wall-bounces. 5H launches for an air combo', corner: true }],
  ds: [{ name: 'Relaunch', seq: '2H jc j.M j.H 2H', note: 'Ground bounce off j.H, then 2H again' },
       { name: 'Barrier wall bounce', seq: '5L 5M 623H , 5H jc j.M j.H', note: 'EX Rose Barrier wall-bounces them back to you', corner: true }],
  mm: [{ name: 'Ground bounce relaunch', seq: '2H jc j.M j.H 2H', note: 'Ground bounce off j.H, then 2H again' },
       { name: 'Lance wall bounce', seq: '5M 236H , 5H', note: 'EX Stayer\'s Lance wall-bounces in the corner', corner: true }],
  tt: [{ name: 'Step chain finisher', seq: '5M 236M 214M 623M', note: 'Three skills in a row, each after the last hit of the one before' },
       { name: 'Double air combo', seq: '2M 2H jc j.M j.H 2H jc j.M j.H', note: 'Ground bounce off j.H, then launch and jump again' },
       { name: 'Step wall bounce', seq: '5M 236H , 2H', note: 'EX Teio Step wall-bounces in the corner', corner: true }],
  kb: [{ name: 'Ground bounce uppercut', seq: '2M 2H jc j.M j.H 2H 623M', note: 'Ground bounce, relaunch, then Matsuri Uppercut' },
       { name: 'Straight wall bounce', seq: '5M 41236H , 5H 623M', note: 'EX Kitasan Straight wall-bounces in the corner', corner: true }],
  jp: [{ name: 'Ground bounce relaunch', seq: '2M 2H jc j.M j.H 2H', note: 'Ground bounce off j.H, then 2H again' },
       { name: 'Charge wall bounce', seq: '5M 5H 214H , 2H', note: 'EX Lion Charge wall-bounces them back over you: catch them with 2H', corner: true }],
  at: [{ name: 'Ground bounce spark', seq: '2M 2H jc j.M j.H 2H 623M', note: 'Ground bounce, relaunch, then Overdose Spark' },
       { name: 'Relaunch', seq: '2H jc j.M j.H 2H', note: 'Launch, air combo, then 2H again' }],
  mc: [{ name: 'Friend link', seq: '5M 236M , 5M 5H', note: 'The Friend\'s rush hits after Cafe has recovered: link 5M' },
       { name: 'Ground bounce shade', seq: '2M 2H jc j.M j.H 2H 623M', note: 'Ground bounce, relaunch, then Rising Shade' }],
  df: [{ name: 'Twist juggle', seq: '2M 236M fS , 2H jc j.M j.H', note: 'Flame Twist launches: land, then 2H for an air combo' },
       { name: 'Cheese platter', seq: '2L 2M 214H', note: 'EX Cheese Wheel: the wedge and the wheel both hit' }],
};
function trialsFor(cid) {
  return [...CHARS[cid].combos.map(c => ({ ...c, level: 1 })), ...(TRIAL_EXTRA[cid] || []).map(c => ({ ...c, level: 2 }))];
}
const TRIAL_KEY = 'umavs.trials';
let trialDone = {};
try { trialDone = JSON.parse(localStorage.getItem(TRIAL_KEY) || '{}'); } catch (e) { trialDone = {}; }
function markTrial(cid, i) { (trialDone[cid] = trialDone[cid] || []); if (!trialDone[cid].includes(i)) trialDone[cid].push(i); try { localStorage.setItem(TRIAL_KEY, JSON.stringify(trialDone)); } catch (e) { } }

// token -> the move id it should produce
function tokenMove(c, tok) {
  if (tok === 'jc' || tok === 'dc' || tok === ',') return null;
  if (tok === 'fS') return Object.keys(c.moves).find(k => /~F$/.test(k)) || tok;   // a skill's on-hit follow-up
  let m = tok.match(/^(\d{3,5})([LMH])$/);
  if (m) { const id = c.techMap['g' + m[1]]; if (!id) return tok; return m[2] === 'H' && c.moves[id + 'X'] ? id + 'X' : m[2] === 'L' && c.moves[id + '.L'] ? id + '.L' : id; }
  m = tok.match(/^j\.([LMH])$/); if (m) return 'j' + m[1];
  return tok;
}
function seqView(seq) { return seq.split(' ').filter(t => t !== ','); }

// ---------------------------------------------------------------- trial tracker
const TR = { on: false, cid: null, idx: 0, list: [], exp: [], hits: [], inst: null, lastMove: null, lastT: 0, prevCombo: 0, progress: 0, done: false, doneT: 0, demo: null };
function trialStart(cid, idx) {
  TR.on = true; TR.cid = cid; TR.list = trialsFor(cid); TR.idx = (idx + TR.list.length) % TR.list.length;
  const t = TR.list[TR.idx];
  TR.exp = t.seq.split(' ').map(x => tokenMove(CHARS[cid], x)).filter(Boolean);
  TR.hits = []; TR.progress = 0; TR.done = false; TR.doneT = 0; TR.demo = null;
  trialReset();
}
function trialReset() {
  resetTraining();
  const [a, d] = G.p, t = TR.list[TR.idx];
  a.x = t.corner ? 1650 : 900; d.x = a.x + 85; a.facing = 1; d.facing = -1; G.cam = Math.max(W / 2, Math.min(STAGE_W - W / 2, (a.x + d.x) / 2));
  G.training.dummy = 'stand'; G.training.block = 'none'; G.training.meter = true;
  TR.hits = []; TR.progress = 0; TR.inst = null;
}
function trialTrack() {
  if (!TR.on) return;
  const [a, d] = G.p;
  if (a.state === 'attack' && (a.move !== TR.lastMove || a.t < TR.lastT)) TR.inst = { id: a.move.id, hit: false };
  TR.lastMove = a.state === 'attack' ? a.move : null; TR.lastT = a.t;
  if (d.combo > 0 && TR.prevCombo === 0) TR.hits = [];
  if (d.combo > TR.prevCombo && TR.inst && !TR.inst.hit) { TR.inst.hit = true; TR.hits.push(TR.inst.id); }
  let k = 0; while (k < TR.hits.length && k < TR.exp.length && TR.hits[k] === TR.exp[k]) k++;
  TR.progress = TR.hits.length > k ? 0 : k;   // a wrong move breaks the attempt
  if (!TR.done && TR.progress === TR.exp.length && TR.exp.length) {
    TR.done = true; TR.doneT = 0; if (!TR.demo) markTrial(TR.cid, TR.idx); Sfx.play('fanfare');
  }
  if (TR.done && ++TR.doneT === 150) { if (TR.demo) { TR.demo = null; trialStart(TR.cid, TR.idx); } else trialStart(TR.cid, TR.idx + 1); }
  if (d.combo === 0 && TR.prevCombo > 0 && !TR.done) TR.hits = [];
  TR.prevCombo = d.combo;
}

// ---------------------------------------------------------------- demo: the game performs the combo
const N0 = () => ({ ...NEUTRAL });
function dirInput(a, ch) { const f = a.facing === 1 ? 'r' : 'l', b = f === 'r' ? 'l' : 'r'; return ({ '6': { [f]: 1 }, '4': { [b]: 1 }, '2': { d: 1 }, '3': { d: 1, [f]: 1 }, '1': { d: 1, [b]: 1 }, '8': { u: 1 }, '9': { u: 1, [f]: 1 }, '7': { u: 1, [b]: 1 } })[ch] || {}; }
function tokenInputs(a, tok) {
  const f = a.facing === 1 ? 'r' : 'l';
  if (tok === 'jc') return [{ ...N0(), u: 1, [f]: 1 }, { ...N0(), u: 1, [f]: 1 }];
  if (tok === 'dc') return [{ ...N0(), [f]: 1 }, N0(), { ...N0(), [f]: 1 }, { ...N0(), [f]: 1 }];
  if (tok === 'fS') return [{ ...N0(), S: 1 }];
  let m = tok.match(/^(\d{3,5})([LMH])$/);
  if (m) { const out = []; for (const ch of m[1]) out.push({ ...N0(), ...dirInput(a, ch) }, { ...N0(), ...dirInput(a, ch) }); out[out.length - 1][m[2]] = 1; return out; }
  m = tok.match(/^d([LMH])$/);
  if (m) return a.state === 'dash' ? [{ ...N0(), [f]: 1, [m[1]]: 1 }] : [{ ...N0(), [f]: 1 }, N0(), { ...N0(), [f]: 1, [m[1]]: 1 }];
  m = tok.match(/^(j\.|2|5|6)([LMH])$/);
  if (m) { const pre = m[1] === '2' ? { d: 1 } : m[1] === '6' ? { [f]: 1 } : {}; return [{ ...N0(), ...pre, [m[2]]: 1 }]; }
  return [N0()];
}
function demoStart() {
  trialStart(TR.cid, TR.idx);
  const raw = TR.list[TR.idx].seq.split(' '), toks = [], links = [];
  for (const t of raw) { if (t === ',') links[toks.length] = true; else toks.push(t); }
  TR.demo = { toks, links, ti: 0, queue: [], restarted: false, pMove: null, pT: 0, wait: 30, air: toks[0].startsWith('j.') };
}
function demoInput() {
  const D = TR.demo, [a, d] = G.p;
  if (!D) return null;
  if (D.wait > 0) {
    if (--D.wait === 0 && D.air) { a.x -= 110; a.setState('air'); a.y = GY - 160; a.vx = 4.2 * a.facing; a.vy = -2; }   // jump-in combos start mid-jump
    return N0();
  }
  const toks = D.toks, ti = D.ti, prev = toks[ti - 1];
  const ready = () => {
    if (D.queue.length) return false;
    if (D.links[ti]) return D.restarted && a.actionable() && a.state !== 'air' && !a.airborne;
    if (ti > 0 && prev !== 'jc' && prev !== 'dc' && (!D.restarted || a.state !== 'attack') && !(prev.startsWith('j.') && toks[ti] && !toks[ti].startsWith('j.'))) return false;
    if (ti === 0) return toks[0].startsWith('j.') ? (a.vy > 1 && Math.abs(a.x - d.x) < 130) : true;
    const next = toks[ti];
    if (prev === 'jc') return a.state === 'air' && a.t >= (next === 'j.L' ? 3 : 5);
    if (prev === 'dc') return a.state === 'dash' && a.t >= 2;
    if ((prev.startsWith('j.') && toks[ti - 2] === 'jc') || (prev.startsWith('j.') && next.startsWith('j.'))) return a.state === 'attack' && a.connected;
    if (prev.startsWith('j.') && !next.startsWith('j.')) return !a.airborne && ['idle', 'walk', 'crouch', 'land', 'attack'].includes(a.state) && (a.state !== 'attack' || a.connected);
    return a.state === 'attack' && a.connected && a.t >= a.move.first && (!(a.c.specialChain && a.move.kind === 'special') || a.hitDone.filter(Boolean).length >= (a.move.hits || []).length);
  };
  if (ti < toks.length && ready()) { D.queue = tokenInputs(a, toks[ti]); D.restarted = false; D.ti++; }
  let inp = D.queue.length ? D.queue.shift() : N0();
  if (toks[D.ti - 1] === 'jc' && !D.queue.length && a.state !== 'air') inp = { ...N0(), u: 1, [a.facing === 1 ? 'r' : 'l']: 1 };
  if (toks[D.ti - 1] === 'dc' && !D.queue.length) inp = { ...N0(), [a.facing === 1 ? 'r' : 'l']: 1 };   // keep holding forward through the dash
  if (D.queue.length && /^d[LMH]$/.test(toks[D.ti - 1] || '') && toks[D.ti - 2] === 'dc') inp[a.facing === 1 ? 'r' : 'l'] = 1;
  return inp;
}
function demoAfterStep() {
  const D = TR.demo; if (!D) return;
  const a = G.p[0];
  if (a.state === 'attack' && (a.move !== D.pMove || a.t < D.pT)) D.restarted = true;
  D.pMove = a.state === 'attack' ? a.move : null; D.pT = a.t;
}

// ---------------------------------------------------------------- input display + frame meter (training only)
const TOOLS = { inputs: true, meter: true, hist: [[], []], fm: [[], []], fmIdle: 99, rec: null, recState: 'off', recIdx: 0 };
function toolsAfterStep() {
  // input history: one row per change, with how long it was held
  G.p.forEach((p, i) => {
    const inp = p.inp, d = p.dir, btn = ['L', 'M', 'H', 'S'].filter(b => inp[b]).join('');
    const h = TOOLS.hist[i], top = h[0];
    if (top && top.d === d && top.b === btn) top.n++;
    else { h.unshift({ d, b: btn, n: 1 }); if (h.length > 12) h.pop(); }
  });
  // frame meter: one cell per frame per player while something is happening
  const cls = p => {
    if (p.state === 'attack') {
      const m = p.move, t = p.t, ev = m.ev ? Object.keys(m.ev).map(Number) : [];
      const act = (m.hits || []).some(h => t >= h.f[0] && t <= h.f[1]) || (m.grab && t >= m.grab[0] && t <= m.grab[1]) || ev.includes(t) || (m.counter && t >= m.counter.f[0] && t <= m.counter.f[1]);
      const first = Math.min(m.first, ...ev, m.counter ? m.counter.f[0] : 999);
      return act ? 2 : t < first ? 1 : 3;
    }
    if (['hit', 'block', 'airHit', 'thrown', 'cineHit'].includes(p.state)) return 4;
    if (['down', 'wake'].includes(p.state)) return 6;
    if (['jsquat', 'land', 'backdash', 'airdash', 'tech', 'throwing', 'cine'].includes(p.state)) return 5;
    if (p.state === 'air') return 7;
    return 0;
  };
  const c = G.p.map(cls), busy = c.some(v => v !== 0 && v !== 7);
  if (busy) { if (TOOLS.fmIdle > 20) TOOLS.fm = [[], []]; TOOLS.fmIdle = 0; }
  else TOOLS.fmIdle++;
  if (TOOLS.fmIdle <= 6) G.p.forEach((p, i) => { TOOLS.fm[i].push(c[i] | (invulnerable(p, false) ? 8 : 0)); if (TOOLS.fm[i].length > 120) TOOLS.fm[i].shift(); });
}
const ARW = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '•', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
const BTN_COL = { L: '#7fb8ff', M: '#ffd24a', H: '#ff6b6b', S: '#7dff9a' };
function drawInputDisplay() {
  if (!TOOLS.inputs) return;
  TOOLS.hist.forEach((h, i) => {
    if (TR.on && i === 1) return;   // trials: only your inputs, on the right (the trial list is on the left)
    const x = i === 0 && !TR.on ? 14 : W - 104, y0 = 232;
    ctx.fillStyle = 'rgba(24,11,42,.55)'; ctx.fillRect(x - 4, y0 - 14, 94, h.length * 16 + 8);
    h.forEach((e, k) => {
      const y = y0 + k * 16, a = 1 - k * 0.04; ctx.globalAlpha = Math.max(0.35, a);
      label(String(Math.min(99, e.n)), x + 18, y, 12, PAL.dim, 'right', 600);
      // the display shows directions as the player sees them (P2 facing left is mirrored back)
      label(ARW[e.d] || '•', x + 30, y, 15, '#fff', 'center', 700);
      [...e.b].forEach((b, j) => label(b, x + 46 + j * 11, y, 13, BTN_COL[b], 'center', 900, true));
      ctx.globalAlpha = 1;
    });
  });
}
const FM_COL = ['#3a4166', '#2fae5b', '#ff4d5e', '#3d7cf2', '#f6c343', '#8a6bff', '#7a5a9a', '#3a2a5c'];
function drawFrameMeter() {
  if (!TOOLS.meter || !TOOLS.fm[0].length) return;
  const n = 90, cw = 7, x0 = W / 2 - (n * cw) / 2, y0 = 446;
  ctx.fillStyle = 'rgba(24,11,42,.8)'; ctx.fillRect(x0 - 70, y0 - 6, n * cw + 140, 40);
  TOOLS.fm.forEach((row, i) => {
    const y = y0 + i * 15, off = Math.max(0, row.length - n);
    label(i === 0 ? 'P1' : 'P2', x0 - 54, y + 6, 12, i === 0 ? PAL.p1 : PAL.p2, 'left', 900, true);
    for (let k = 0; k < n; k++) {
      const v = row[off + k]; if (v === undefined) break;
      ctx.fillStyle = FM_COL[v & 7]; ctx.fillRect(x0 + k * cw, y, cw - 1, 12);
      if (v & 8) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x0 + k * cw + 0.5, y + 0.5, cw - 2, 11); }
    }
  });
  // startup of P1's first attack in this exchange + frame advantage
  const r = TOOLS.fm[0]; let s = 0; while (s < r.length && (r[s] & 7) !== 1) s++;
  let e = s; while (e < r.length && (r[e] & 7) === 1) e++;
  const startup = s < r.length ? e - s + 1 : null;
  label(startup ? `startup ${startup}f` : '', x0 + n * cw + 8, y0 + 5, 12, '#ddd2f0', 'left', 700);
  if (G.adv && G.adv.val !== null) label(`${G.adv.a.side === 0 ? 'P1' : 'P2'} ${G.adv.val >= 0 ? '+' : ''}${G.adv.val}`, x0 + n * cw + 8, y0 + 21, 13, G.adv.val > 0 ? '#7dff9a' : G.adv.val < 0 ? '#ff7d7d' : '#fff', 'left', 900, true);
  const keys = [['startup', 1], ['active', 2], ['recovery', 3], ['stun', 4], ['invuln', 8]];
  keys.forEach(([t, v], k) => { const x = x0 + k * 90; if (v === 8) { ctx.strokeStyle = '#fff'; ctx.strokeRect(x + 0.5, y0 + 30.5, 9, 7); } else { ctx.fillStyle = FM_COL[v]; ctx.fillRect(x, y0 + 30, 10, 8); } label(t, x + 14, y0 + 34, 11, PAL.dim, 'left', 600); });
}

// ---------------------------------------------------------------- dummy record & playback
// Inputs are stored relative to the dummy's facing, so a recording works from either side.
function recToggle() {
  if (TOOLS.recState === 'recording') { TOOLS.recState = TOOLS.rec && TOOLS.rec.length ? 'ready' : 'off'; toast(TOOLS.rec && TOOLS.rec.length ? `Recorded ${(TOOLS.rec.length / 60).toFixed(1)}s · press 8 to play it back` : 'Nothing recorded'); }
  else { TOOLS.rec = []; TOOLS.recState = 'recording'; toast('Recording the dummy: you now control P2 · press 7 to stop'); }
  Sfx.play('menu');
}
function playToggle() {
  if (!TOOLS.rec || !TOOLS.rec.length) { toast('Record something first (7)'); Sfx.play('deny'); return; }
  TOOLS.recState = TOOLS.recState === 'playing' ? 'ready' : 'playing'; TOOLS.recIdx = 0;
  toast(TOOLS.recState === 'playing' ? 'Dummy playback: looping your recording · 8 to stop' : 'Playback stopped'); Sfx.play('menu');
}
function relOf(inp, facing) { const f = facing === 1 ? 'r' : 'l', b = f === 'r' ? 'l' : 'r'; return { u: inp.u, d: inp.d, f: inp[f], b: inp[b], L: inp.L, M: inp.M, H: inp.H, S: inp.S }; }
function absOf(rel, facing) { const o = { ...NEUTRAL, u: rel.u, d: rel.d, L: rel.L, M: rel.M, H: rel.H, S: rel.S }; o[facing === 1 ? 'r' : 'l'] = rel.f; o[facing === 1 ? 'l' : 'r'] = rel.b; return o; }
// returns [p1, p2] inputs when the recorder is in charge, or null
function recInputs(p1raw) {
  const d = G.p[1];
  if (TOOLS.recState === 'recording') { if (TOOLS.rec.length < 600) TOOLS.rec.push(relOf(p1raw, d.facing)); else recToggle(); return [{ ...NEUTRAL }, p1raw]; }
  if (TOOLS.recState === 'playing') { const r = TOOLS.rec[TOOLS.recIdx++ % TOOLS.rec.length]; return [p1raw, absOf(r, d.facing)]; }
  return null;
}

// ---------------------------------------------------------------- trials menu + HUD
const TM = { char: 0, idx: 0 };
function drawTrialsMenu() {
  menuBg(0.82);
  topBar('COMBO TRIALS', '← → runner    ·    ↑ ↓ trial');
  const cid = ROSTER[TM.char], c = CHARS[cid], list = trialsFor(cid), done = trialDone[cid] || [];
  plate(24, 52, 420, 36, c.color, 12); gateTag(gateOf(cid), 34, 57, 26);
  label(nameOf(cid), 70, 71, 26, '#fff', 'left', 900, true);
  label(`${done.length} / ${list.length} CLEARED`, W - 40, 71, 18, done.length === list.length ? PAL.gold : '#efe8fb', 'right', 900, true);
  drawSpr(cid, 0, '800', Math.floor(UI.t / 9) % SPR[cid].anims['800'][1], 800, 470, -1, 3.6);
  list.forEach((t, i) => {
    const y = 104 + i * 50, s = i === TM.idx;
    rowSlant(30 + (s ? 10 : 0), y, 600, 42, 10, s, 'rgba(34,17,60,.86)');
    gateTag(i, 42 + (s ? 10 : 0), y + 8, 26);
    label(t.name + (t.level > 1 ? '  ★' : ''), 80 + (s ? 10 : 0), y + 14, 18, s ? PAL.ink : '#fff', 'left', 900, true);
    label(comboText(t.seq), 80 + (s ? 10 : 0), y + 31, 14, s ? '#2a4a8a' : '#7fe0ff', 'left', 800, true);
    if (done.includes(i)) { rrect(570 + (s ? 10 : 0), y + 10, 48, 22, 4, PAL.turf); label('CLEAR', 594 + (s ? 10 : 0), y + 22, 13, '#fff', 'center', 900, true); }
    if (t.corner) label('CORNER', 560 + (s ? 10 : 0), y + 21, 12, s ? PAL.rose : PAL.dim, 'right', 900, true);
  });
  hintBar('F / Enter start    ·    in a trial: 9 watch demo · 0 next trial · 4 reset    ·    Esc back');
}
function drawTrialHUD() {
  if (!TR.on) return;
  const t = TR.list[TR.idx], toks = seqView(t.seq), x = 14, y0 = 214;
  const steps = toks.filter(x => x !== 'jc' && x !== 'dc');
  panel(x - 4, y0 - 8, 300, 84 + steps.length * 22, TR.done ? PAL.turf : PAL.rose);
  label(`TRIAL ${TR.idx + 1} / ${TR.list.length}`, x + 8, y0 + 6, 13, PAL.gold, 'left', 900, true);
  label(t.name, x + 8, y0 + 24, 17, '#fff', 'left', 900, true);
  let k = 0;
  toks.forEach(tok => {
    if (tok === 'jc' || tok === 'dc') return;
    const y = y0 + 46 + k * 22, ok = k < TR.progress, cur = k === TR.progress && !TR.done;
    if (cur) slant(x + 2, y - 10, 280, 20, 6, 'rgba(255,255,255,.12)');
    label(ok ? '✓' : String(k + 1), x + 16, y, 14, ok ? '#7dff9a' : PAL.dim, 'center', 900, true);
    const pre = k > 0 && toks[toks.indexOf(tok) - 1] === 'jc' ? '(jump) ' : '';
    label(pre + comboText(tok), x + 34, y, 16, ok ? '#7dff9a' : cur ? '#fff' : '#b0a3d2', 'left', 800, true);
    k++;
  });
  ctx.font = font(12.5, 600, false); ctx.fillStyle = PAL.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  wrap(t.note || '', x + 8, y0 + 50 + steps.length * 22, 280, 15);
  if (TR.demo) ledText('DEMO', W / 2, 186, 3, PAL.led);
  if (TR.done) { ctx.save(); ctx.translate(W / 2, 230); ctx.rotate(-0.08); rrect(-120, -30, 240, 60, 8, PAL.gold); txt(TR.demo ? 'DEMO' : 'CLEAR!', 0, 2, 44, PAL.ink, 'center', null); ctx.restore(); }
}
