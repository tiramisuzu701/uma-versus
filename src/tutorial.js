// Tutorial: short lessons that watch what you do and tick off each step. Runs on top of Training
// (Special Week against a scripted Kitasan Black), so none of it touches the sim.
'use strict';

const TUT_KEY = 'umavs.tutorial';
// each step: what to do, how many times, which dummy script runs, and a test over this frame's events
const LESSONS = [
  { title: 'MOVING', steps: [
    { text: 'Walk forward: hold →', need: 40, unit: 'f', test: e => e.walkF },
    { text: 'Walk back: hold ←', need: 40, unit: 'f', test: e => e.walkB },
    { text: 'Jump: press ↑ (↗ and ↖ jump forward and back)', need: 2, test: e => e.jump },
    { text: 'Crouch: hold ↓', need: 30, unit: 'f', test: e => e.crouch },
    { text: 'Dash: tap → twice', need: 2, test: e => e.dash },
    { text: 'Backdash: tap ← twice', need: 2, test: e => e.backdash },
  ] },
  { title: 'ATTACKING', steps: [
    { text: 'Light, Medium and Heavy: press L, M and H', need: 3, distinct: true, test: e => ['5L', '5M', '5H'].includes(e.move) && e.move },
    { text: 'Hit the dummy 3 times', need: 3, test: e => e.hit },
    { text: 'Auto-combo: stand close and mash L', need: 1, test: e => e.combo >= 4 && e.comboMoves.slice(0, 3).join() === '5L,5M,5H' },
    { text: 'Crouching attacks: hold ↓ and press L or M', need: 2, test: e => e.move === '2L' || e.move === '2M' },
  ] },
  { title: 'BLOCKING', steps: [
    { text: 'Hold ← (away from her) to block her attacks', need: 3, dummy: 'mid', test: e => e.block },
    { text: 'Low attacks: hold ↙ (down and away) to block them', need: 3, dummy: 'low', test: e => e.block && e.blockLow },
    { text: 'Overheads hit crouchers: block these standing (just ←)', need: 2, dummy: 'high', test: e => e.block && !e.blockLow },
    { text: 'Now it\'s mixed up: block 5 in a row', need: 5, dummy: 'mix', streak: true, test: e => e.block },
  ] },
  { title: 'THROWS', steps: [
    { text: 'Walk right up to her and press L + M to throw', need: 2, test: e => e.threw },
    { text: 'She\'ll try to throw you: press L + M as she grabs you to tech it', need: 2, dummy: 'throw', test: e => e.teched },
  ] },
  { title: 'SKILLS', steps: [
    { text: 'Skill shortcut: S on its own, or S + a direction', need: 3, distinct: true, test: e => e.simple && e.base },
    { text: 'Motion input: ↓ ↘ → + M. No cooldown, more damage', need: 2, test: e => e.tech && e.base === '5S' },
    { text: 'Uppercut: → ↓ ↘ + M (invincible, great against jumps)', need: 1, test: e => e.tech && e.base === '4S' },
    { text: 'EX skill: any motion + H, for 50 Spurt', need: 2, test: e => e.ex },
  ] },
  { title: 'COMBOS', steps: [
    { text: 'Chain: 5L, then 5M, then 5H, each as the last one hits', need: 1, test: e => e.hit && e.comboMoves.slice(-3).join() === '5L,5M,5H' },
    { text: 'Cancel: 5M, then ↓ ↘ → + M while 5M hits', need: 1, test: e => e.hit && /^5M,5S/.test(e.comboMoves.slice(-2).join()) },
    { text: 'Launcher: 2H, hold ↑ as it hits, then j.M and j.H in the air', need: 1, test: e => e.hit && e.comboMoves.includes('2H') && e.comboMoves.includes('jH') },
  ] },
  { title: 'SPURT', steps: [
    { text: 'Super: S + H with a full Spurt gauge. Land it on her', need: 1, test: e => e.superHit },
    { text: 'Counter Spurt: while blocking her string, press Counter Spurt (V or LT by default)', need: 1, dummy: 'string', test: e => e.move === 'GC' },
  ] },
];
const TUT = { on: false, li: 0, si: 0, n: 0, seen: [], done: false, doneT: 0, prev: null, dm: { cd: 0, q: [] }, all: false };
let tutDone = [];
try { tutDone = JSON.parse(localStorage.getItem(TUT_KEY) || '[]'); } catch (e) { tutDone = []; }
function tutMark(i) { if (!tutDone.includes(i)) tutDone.push(i); try { localStorage.setItem(TUT_KEY, JSON.stringify(tutDone)); } catch (e) { } }

function tutStart(li) {
  UI.pendingMode = 'training'; UI.sel = [ROSTER.indexOf('spe'), ROSTER.indexOf('kb')]; UI.pal = [0, 0]; UI.vsStage = 0; UI.musicIdx = THEME_IDS.indexOf('spe');
  beginLocalMatch();
  G.training.dummy = 'stand'; G.training.block = 'none'; G.showBoxes = false;
  TUT.on = true; TUT.all = false; tutLesson(li);
}
function tutLesson(li) {
  TUT.li = Math.max(0, Math.min(LESSONS.length - 1, li)); TUT.si = 0; TUT.n = 0; TUT.seen = []; TUT.done = false; TUT.doneT = 0; TUT.prev = null; TUT.dm = { cd: 40, q: [] };
  resetTraining(); const [a, d] = G.p; a.x = 860; d.x = 1060; G.cam = 960;
}
function tutStep() { return LESSONS[TUT.li].steps[TUT.si]; }

// what happened this frame, worked out from the state before and after the step
function tutEvents() {
  const [a, d] = G.p, P = TUT.prev || { a: a.state, at: a.t, am: a.move, ds: d.state, dc: 0, bs: 0, moves: [] }, e = {};
  if (a.state === 'walk') { e.walkF = a.walkDir > 0; e.walkB = a.walkDir < 0; }
  e.crouch = a.state === 'crouch';
  e.jump = a.state === 'jsquat' && P.a !== 'jsquat';
  e.dash = a.state === 'dash' && P.a !== 'dash';
  e.backdash = a.state === 'backdash' && P.a !== 'backdash';
  if (a.state === 'attack' && (a.move !== P.am || a.t < P.at)) {
    const m = a.move; e.move = m.id; e.base = baseId(m.followOf || m.id);
    e.simple = (m.kind === 'special' || m.special) && a.simple; e.tech = m.kind === 'special' && !a.simple; e.ex = !!m.isEx;
  }
  let moves = d.combo === 0 ? [] : P.moves;
  if (d.combo > P.dc) { e.hit = true; moves = [...moves, a.state === 'attack' ? baseId(a.move.followOf || a.move.id).replace(/[.X].*$/, '') : a.state === 'cine' ? 'SU' : '?']; }
  e.combo = d.combo; e.comboMoves = moves;
  e.superHit = (a.state === 'cine' && P.a !== 'cine') || (e.hit && a.state === 'attack' && a.move.kind === 'super');
  e.block = a.state === 'block' && (P.a !== 'block' || a.bs > P.bs + 1); e.blockLow = e.block && a.crouchBlock;
  e.gotHit = ['hit', 'airHit'].includes(a.state) && !['hit', 'airHit'].includes(P.a);
  e.threw = d.state === 'thrown' && P.ds !== 'thrown';
  e.teched = a.state === 'tech' && P.a === 'thrown';
  TUT.prev = { a: a.state, at: a.t, am: a.state === 'attack' ? a.move : null, ds: d.state, dc: d.combo, bs: a.bs, moves };
  return e;
}
function tutAfterStep() {
  if (!TUT.on) return;
  const e = tutEvents();
  if (TUT.done) {
    if (++TUT.doneT === 130) {
      if (TUT.li < LESSONS.length - 1) { tutLesson(TUT.li + 1); Sfx.play('page'); } else { TUT.all = true; }
    }
    return;
  }
  const s = tutStep(), r = s.test(e);
  if (s.streak && e.gotHit) TUT.n = 0;
  if (r) {
    if (s.distinct) { if (!TUT.seen.includes(r === true ? e.move : r)) { TUT.seen.push(r === true ? e.move : r); TUT.n++; Sfx.play('ok'); } }
    else { TUT.n++; if (!s.unit) Sfx.play('ok'); }
  }
  if (TUT.n >= s.need) {
    TUT.si++; TUT.n = 0; TUT.seen = [];
    if (TUT.si >= LESSONS[TUT.li].steps.length) { TUT.done = true; TUT.doneT = 0; tutMark(TUT.li); Sfx.play('fanfare'); }
    else { Sfx.play('stamp'); TUT.dm = { cd: 50, q: [] }; }
  }
}
// the dummy's script for the current step
function tutDummy() {
  const [a, d] = G.p, s = TUT.done ? {} : tutStep(), D = TUT.dm, dist = Math.abs(a.x - d.x);
  const f = a.x > d.x ? 'r' : 'l', i = { ...NEUTRAL };
  if (D.q.length) return { ...i, ...D.q.shift() };
  const kind = s.dummy === 'mix' ? ['mid', 'low', 'high'][(G.frameCount >> 6) % 3] : s.dummy;
  if (!kind) return i;
  if (!['idle', 'walk', 'crouch'].includes(d.state)) return i;
  if (kind === 'throw' ? dist > 70 : dist > 120) { i[f] = 1; return i; }
  if (--D.cd > 0) return i;
  D.cd = kind === 'string' ? 110 : 70;
  const press = (o, n = 1) => Array(n).fill(o);
  if (kind === 'mid') D.q = [{ M: 1 }];
  if (kind === 'low') D.q = [{ d: 1, M: 1 }];
  if (kind === 'high') D.q = [{ [f]: 1, M: 1 }];
  if (kind === 'throw') D.q = [{ L: 1, M: 1 }];
  if (kind === 'string') D.q = [{ L: 1 }, ...press({}, 9), { M: 1 }, ...press({}, 14), { H: 1 }];
  return i;
}
function tutPauseItems(items) {
  items.push(['Restart lesson', () => { tutLesson(TUT.li); UI.paused = false; }]);
  if (TUT.li < LESSONS.length - 1) items.push(['Next lesson', () => { tutLesson(TUT.li + 1); UI.paused = false; }]);
  if (TUT.li > 0) items.push(['Previous lesson', () => { tutLesson(TUT.li - 1); UI.paused = false; }]);
  items.push(['Leave the tutorial', () => { TUT.on = false; UI.screen = 'mode'; UI.paused = false; }]);
}
function drawTutHUD() {
  if (!TUT.on) return;
  const L = LESSONS[TUT.li], x = 14, y0 = 100;
  panel(x - 4, y0 - 8, 372, 46 + L.steps.length * 24, TUT.done ? PAL.turf : PAL.gold);
  label(`LESSON ${TUT.li + 1} / ${LESSONS.length}`, x + 8, y0 + 6, 13, PAL.gold, 'left', 900, true);
  label(L.title, x + 8, y0 + 24, 19, '#fff', 'left', 900, true);
  L.steps.forEach((s, k) => {
    const y = y0 + 48 + k * 24, ok = k < TUT.si || TUT.done, cur = k === TUT.si && !TUT.done;
    if (cur) slant(x + 2, y - 11, 352, 22, 6, 'rgba(255,255,255,.12)');
    label(ok ? '✓' : String(k + 1), x + 16, y, 14, ok ? '#7dff9a' : PAL.dim, 'center', 900, true);
    ctx.save(); ctx.font = font(14, 700, false); const w = ctx.measureText(s.text).width, kx = Math.min(1, 270 / w);
    ctx.translate(x + 32, y); ctx.scale(kx, 1); label(s.text, 0, 0, 14, ok ? '#7dff9a' : cur ? '#fff' : '#b0a3d2', 'left', 700); ctx.restore();
    if (cur) label(s.unit ? `${Math.min(100, Math.round(100 * TUT.n / s.need))}%` : `${TUT.n} / ${s.need}`, x + 350, y, 14, PAL.gold, 'right', 900, true);
  });
  if (TUT.done) {
    ctx.save(); ctx.translate(W / 2, 220); ctx.rotate(-0.06); rrect(-170, -34, 340, 68, 8, PAL.gold);
    txt(TUT.all ? 'TUTORIAL COMPLETE' : 'LESSON CLEAR', 0, 2, TUT.all ? 34 : 44, PAL.ink, 'center', null); ctx.restore();
    if (TUT.all) label('You know the basics. Combo Trials and Training are next.', W / 2, 270, 16, '#fff', 'center', 700);
  }
  label('Esc: pause (restart, skip or leave)', W - 14, 100, 12, PAL.dim, 'right', 600);
}
