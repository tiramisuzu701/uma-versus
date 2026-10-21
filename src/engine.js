// Simulation. Fixed 60 fps step; step() only reads game state and that
// frame's inputs, which is what makes replays and rollback work.
'use strict';

const W = 960, HGT = 540, GY = 470, STAGE_W = 1920, SC = 3;
const BUF = 9;            // input buffer (frames)
const JUG_MAX = 10;       // juggle points: normals cost 1, skills 2
const COMBO_HITS = 32;    // combo limit (hits), see also COMBO_TIME
const COMBO_TIME = 420;
const DECAY_AT = 120;     // hitstun decay starts after this many frames of combo
const ROUND_TIME = 99;

let rs = 1;
const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);

const NEUTRAL = { u: 0, d: 0, l: 0, r: 0, L: 0, M: 0, H: 0, S: 0 };
const BTNS = ['L', 'M', 'H', 'S'];

// -------------------------------------------------------------------- Fighter
class Fighter {
  constructor(side, cid, alt) {
    this.side = side; this.cid = cid; this.alt = alt; this.c = CHARS[cid];
    this.wins = 0;
    this.reset();
  }
  reset() {
    const c = this.c;
    this.x = this.side === 0 ? STAGE_W / 2 - 170 : STAGE_W / 2 + 170;
    this.y = GY; this.vx = 0; this.vy = 0;
    this.facing = this.side === 0 ? 1 : -1;
    this.hp = c.hp; this.dispHp = c.hp; this.redHp = c.hp;
    this.meter = this.meter || 0;
    this.state = 'intro'; this.t = 0;
    this.move = null; this.hitDone = []; this.connected = false; this.armorLeft = 0;
    this.hs = 0; this.bs = 0; this.crouchBlock = false;
    this.combo = 0; this.jug = 0; this.comboDmg = 0;
    this.inp = { ...NEUTRAL }; this.prev = { ...NEUTRAL };
    this.buf = { L: 0, M: 0, H: 0, S: 0 };
    this.bufDir = {}; this.bufHist = {};   // direction + motion history captured at each button press
    this.lastFwd = -99; this.lastBack = -99; this.frame = 0;
    this.jx = 0; this.airS = false; this.guts = 0; this.flash = 0;
    this.cs = 0; this.kd = false; this.downT = 0; this.landRec = 4;
    this.throwT = 0; this.throwBack = false; this.ai = null;
    this.trail = [];
    this.cd = {}; this.hist = []; this.simple = false; this.hardKd = false;
    this.upBuf = 0; this.dashTap = false; this.bdashTap = false; this.hitOK = false;
    this.walkDir = 0; this.prevState = ''; this.jumpBoost = 1; this.crouchHit = false; this.guarding = false; this.airAct = 0; this.adDir = 0; this.gold = 0; this.throwDmg = 1300; this.noTech = false; this.dashBuf = 0; this.hitLvl = 0; this.adLand = false; this.throwVx = 6; this.dashMin = 0; this.launched = false; this.chainUsed = []; this.miracle = false; this.prorate = 1; this.comboT = 0; this.gbUsed = false; this.wbUsed = false; this.bounce = null; this.limitHit = false;
  }
  get grounded() { return this.y >= GY && !['air', 'airHit', 'airdash'].includes(this.state) && !(this.state === 'attack' && this.move.air); }
  get airborne() { return this.y < GY || this.state === 'air' || this.state === 'airHit' || this.state === 'airdash' || (this.state === 'attack' && this.move && this.move.air); }

  // numpad direction relative to facing
  get dir() {
    const fx = ((this.inp.r ? 1 : 0) - (this.inp.l ? 1 : 0)) * this.facing;
    const row = this.inp.u ? 3 : this.inp.d ? -3 : 0;
    return 5 + row + fx;
  }
  actionable() {
    return ['idle', 'walk', 'crouch', 'dash', 'land0'].includes(this.state) || (this.state === 'air');
  }
  feed(inp, frozen) {
    this.prev = this.inp; this.inp = inp;
    this.hist.push(this.dir); if (this.hist.length > 24) this.hist.shift();
    for (const b of BTNS) {
      // a buffered press remembers what you were holding / had just input when you pressed it,
      // so releasing ↓ or finishing a motion during hitstop doesn't change what comes out
      if (inp[b] && !this.prev[b]) { this.buf[b] = 1; this.bufDir[b] = this.dir; this.bufHist[b] = this.hist.slice(); }
      else if (this.buf[b] > 0 && !frozen) this.buf[b]++;
      if (this.buf[b] > BUF) this.buf[b] = 0;
    }
    if (inp.u && !this.prev.u) this.upBuf = 1; else if (this.upBuf > 0 && !frozen) this.upBuf++;
    if (this.upBuf > BUF + 4) this.upBuf = 0;
    if (!frozen) this.frame++;
    // double-tap detection (relative to facing)
    const fwdKey = this.facing === 1 ? 'r' : 'l', backKey = this.facing === 1 ? 'l' : 'r';
    if (inp[fwdKey] && !this.prev[fwdKey]) { this.dashTap = this.frame - this.lastFwd <= 12; this.lastFwd = this.frame; } else this.dashTap = false;
    // keep a double-tap around for a few frames (so it survives hitstop) for dash cancels
    if (this.dashTap) this.dashBuf = 1; else if (this.dashBuf > 0 && !frozen) this.dashBuf++;
    if (this.dashBuf > BUF) this.dashBuf = 0;
    if (inp[backKey] && !this.prev[backKey]) { this.bdashTap = this.frame - this.lastBack <= 12; this.lastBack = this.frame; } else this.bdashTap = false;
  }
  has(b) { return this.buf[b] > 0; }
  take(b) { if (this.buf[b] > 0) { this.buf[b] = 0; return true; } return false; }
  takeBoth(a, b) {
    if (this.buf[a] > 0 && this.buf[b] > 0 && Math.abs(this.buf[a] - this.buf[b]) <= 4) { this.buf[a] = this.buf[b] = 0; return true; }
    return false;
  }
  setState(s) { this.state = s; this.t = 0; }
}

// ---------------------------------------------------------------- Game state
const G = {
  mode: 'versus', p: [], projs: [], fx: [], texts: [], freeze: 0, flashOwner: null, flashT: 0,
  shake: 0, cam: STAGE_W / 2, phase: 'intro', phaseT: 0, round: 1, timer: ROUND_TIME, timerSub: 0,
  slow: 0, adv: null, showBoxes: false, frameCount: 0,
  training: { dummy: 'stand', block: 'none', meter: true, cpuLevel: 2 },
};

function startMatch(mode, c1, c2) {
  G.mode = mode; rs = 7;
  const alt = c1 === c2;
  G.p = [new Fighter(0, c1, false), new Fighter(1, c2, alt)];
  G.p[0].meter = G.p[1].meter = 0;
  G.round = 1;
  startRound();
}
function startRound() {
  for (const p of G.p) { const m = p.meter; p.reset(); p.meter = m; }
  if (G.mode === 'training') { for (const p of G.p) { p.setState('idle'); p.meter = 100; } G.phase = 'fight'; }
  else G.phase = 'intro';
  G.phaseT = 0; G.projs = []; G.fx = []; G.texts = []; G.freeze = 0; G.timer = ROUND_TIME; G.timerSub = 0;
  G.cam = STAGE_W / 2; G.adv = null; G.flashOwner = null; G.slow = 0; G.posed = false; G.koType = null; G.roundWinner = -1;
}

// ---------------------------------------------------------------- Helpers
function opp(p) { return G.p[1 - p.side]; }
function rect(p, b) { // b = [fwd, up, w, h]
  const l = p.facing === 1 ? p.x + b[0] : p.x - b[0] - b[2];
  return { x: l, y: p.y + b[1], w: b[2], h: b[3] };
}
function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

function hurtbox(p) {
  const s = p.state;
  if (['down', 'wake', 'intro', 'win', 'thrown', 'cineHit', 'lose'].includes(s)) return null;
  if (s === 'attack' && p.move.invis && p.t >= p.move.invis[0] && p.t <= p.move.invis[1]) return null;
  if (s === 'attack' && p.move.hurt && p.t >= (p.move.hurtFrom || 0) && p.t <= (p.move.hurtTo || 999)) return rect(p, p.move.hurt);
  if (s === 'crouch' || (s === 'block' && p.crouchBlock) || (s === 'hit' && p.crouchHit) || (s === 'attack' && p.move.crouch))
    return rect(p, [-30, -88, 62, 88]);
  if (p.airborne) return rect(p, [-26, -125, 54, 100]);
  return rect(p, [-28, -130, 58, 130]);
}
function invulnerable(p, fromAir) {
  if (p.state === 'attack') {
    const m = p.move;
    if (m.inv && p.t >= m.inv[0] && p.t <= m.inv[1]) return true;
    if (fromAir && m.aaInv && p.t >= m.aaInv[0] && p.t <= m.aaInv[1]) return true;
  }
  if (p.state === 'backdash' && p.t <= ((p.c.backdash && p.c.backdash.inv) || 4)) return true;
  if (p.state === 'cine' || p.state === 'throwing') return true;
  if (p.state === 'airHit' && p.jug >= JUG_MAX) return true;
  return false;
}

function addText(txt, x, y, color, size = 28, life = 50) { if (G.resim) return; G.texts.push({ txt, x, y, color, size, life, t: 0 }); }
// Visual effects. None of this is game state: it's skipped during rollback
// re-simulation and never read by the simulation, so replays/netplay stay exact.
const ATTACHED_FX = ['speed', 'spiral', 'streak', 'dustTrail'];
function spawnFx(p, e) {
  if (G.resim) return;
  const L = p.c.look;
  G.fx.push({ ...e, type: 'vfx', kind: e.type, x: p.x + p.facing * (e.x || 0), y: p.y + (e.y || 0), ox: e.x || 0, oy: e.y || 0,
    facing: p.facing, owner: p.side, attached: ATTACHED_FX.includes(e.type), t: 0,
    life: e.dur || { swipe: 9, thrust: 8, ring: 16, pillar: 18, motif: 30, vanish: 18, bang: 34 }[e.type] || 14,
    color: e.color || L.fxColor, alt: L.fxAlt, motif: L.motif, seed: G.fx.length + G.frameCount });
  if (e.type === 'motif' || e.type === 'vanish') motifBurst(p.x + p.facing * (e.x || 0), p.y + (e.y || 0), L, e.n || 8, e.spread || 40);
}
function motifBurst(x, y, L, n, spread) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.5;
    G.fx.push({ type: 'mot', motif: L.motif, color: Math.random() < 0.5 ? L.fxColor : L.fxAlt, x: x + Math.cos(a) * spread * 0.3, y: y + Math.sin(a) * spread * 0.3,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, rot: Math.random() * 6, vr: (Math.random() - .5) * 0.4, t: 0, life: 24 + Math.random() * 14, size: 5 + Math.random() * 5 });
  }
}
const BANGS = ['!!', 'BAM!', 'DON!', 'WHAM!', 'POW!'];
function spark(x, y, kind, lvl, dir, att) {
  if (G.resim) return;
  if (att && kind !== 'block') {   // character signature on hits
    const L = att.c.look;
    motifBurst(x, y, L, 3 + lvl * 2, 30);
    if (L.motif === 'bang' && lvl >= 2) G.fx.push({ type: 'vfx', kind: 'bang', text: BANGS[G.frameCount % BANGS.length], x: x - dir * 10, y: y - 50, t: 0, life: 30, color: L.fxColor, alt: L.fxAlt, facing: 1, seed: G.frameCount });
  }
  G.fx.push({ type: 'spark', x, y, kind, lvl, dir, t: 0, life: 12 + lvl * 3, rot: Math.random() * 6 });
  const n = 5 + lvl * 4;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * (3 + lvl * 2);
    G.fx.push({ type: 'pt', x, y, vx: Math.cos(a) * sp + dir * 2, vy: Math.sin(a) * sp - 1, t: 0, life: 14 + Math.random() * 10, kind });
  }
}
function dust(x, y, dir) { if (G.resim) return; for (let i = 0; i < 5; i++) G.fx.push({ type: 'dust', x: x + (Math.random() - .5) * 30, y, vx: -dir * (0.5 + Math.random() * 2), vy: -Math.random() * 1.5, t: 0, life: 22 }); }

// ---------------------------------------------------------------- Motion inputs
// p.hist holds one numpad direction per frame (relative to facing).
// A motion is an ordered list of direction sets found as a subsequence within
// `win` frames; its final direction must be held now or within the last 3 frames.
const M_FWD = [6, 9], M_BACK = [4, 7];
const MOTIONS = {
  // 623: the → that starts it must be a fresh press (held ≤ 8 frames), so
  // walking forward into a quarter-circle still reads as 236, not a DP.
  // ...and it can't pass through neutral between → and ↓ (so tap →, let go, ↓↘→ is still 236).
  '623':   { sets: [M_FWD, [1, 2], [3]], last: [3, 6, 9], win: 16, freshFirst: 8, noNeutralAfterFirst: true },
  '41236': { sets: [M_BACK, [1, 2], [3], M_FWD], last: M_FWD, win: 24 },
  '236':   { sets: [[1, 2], [3], M_FWD], last: M_FWD, win: 16 },
  '214':   { sets: [[2, 3], [1], M_BACK], last: M_BACK, win: 16 },
  // 66 + L/M/H: dash attack straight from a double-tap (skill motions are checked first)
  '66':    { sets: [[6], [1, 2, 3, 4, 5, 7, 8], [6]], last: [6], win: 14 },
};
function matchMotion(h, name) {
  const mo = MOTIONS[name], n = h.length;
  let recent = false;
  for (let k = n - 1; k >= Math.max(0, n - 3); k--) if (mo.last.includes(h[k])) { recent = true; break; }
  if (!recent) return false;
  let i = mo.sets.length - 1, k = n - 1, firstAt = -1, secondAt = -1;
  for (; k >= Math.max(0, n - mo.win) && i >= 0; k--) if (mo.sets[i].includes(h[k])) { if (i === 1) secondAt = k; if (i === 0) firstAt = k; i--; }
  if (i >= 0) return false;
  if (mo.noNeutralAfterFirst) for (let j = firstAt + 1; j < secondAt; j++) if (h[j] === 5) return false;
  if (mo.freshFirst) {   // how long was the first direction held before the motion?
    let run = 0; for (let j = firstAt; j >= 0 && mo.sets[0].includes(h[j]); j--) run++;
    if (run > mo.freshFirst) return false;
  }
  return true;
}
// Priority: 41236 > 623 > 236 > 214. Returns the skill id or null.
function techSkill(p, air, hist) {
  hist = hist || p.hist;
  const order = air ? ['236', '214', '623'] : ['41236', '623', '236', '214'];
  for (const mo of order) {
    const id = p.c.techMap[(air ? 'a' : 'g') + mo];
    if (id && matchMotion(hist, mo)) return id;
  }
  return null;
}
const baseId = id => id.split(/[.X]/)[0];
function skillReady(p, id) { return !(p.cd[baseId(id)] > 0); }
function projBlocked(p, id) { const m = p.c.moves[baseId(id)]; return !!(m && m.proj) && G.projs.filter(q => q.owner === p.side).length >= (p.c.projMax || 1); }
// pick the move for a technical input: L -> light version, M -> base, H -> EX (if 50 Spurt, else M)
function techMove(p, id, btn) {
  if (btn === 'H') return p.meter >= 50 && p.c.moves[id + 'X'] ? id + 'X' : id;
  if (btn === 'L') return p.c.moves[id + '.L'] ? id + '.L' : id;
  return id;
}
function techOK(p, id) { return !projBlocked(p, id) && !(p.c.moves[id].cdAlways && !skillReady(p, id)); }

// ---------------------------------------------------------------- Actions
function startMove(p, id, tech) {
  const m = p.c.moves[id]; if (!m) return false;
  p.move = m; p.setState('attack'); p.hitDone = []; p.connected = false; p.hitOK = false; p.launched = false;
  p.simple = (m.kind === 'special' || m.special) && !tech;
  if (m.cd && (p.simple || m.cdAlways)) p.cd[baseId(id)] = m.cd;
  if (m.isEx) {
    p.meter -= 50; p.flash = 6; G.freeze = Math.max(G.freeze, 5);
    addText('EX', p.x, GY - 185, '#ffd24a', 24, 26); spark(p.x, GY - 90, 'armor', 1, 0); Sfx.play('power');
  } else if (m.kind === 'special' && tech && !m.followOf) addText('TECH', p.x, GY - 175, '#9ff', 13, 18);
  if (m.kind === 'gc') { p.meter -= 50; p.flash = 8; addText('COUNTER SPURT', p.x, GY - 210, p.c.color, 22, 40); Sfx.play('power'); }
  p.armorLeft = m.armor ? (m.armorHits || 1) : 0;
  if (m.kind === 'super') {
    p.meter -= 100; G.freeze = 38; G.flashOwner = p; G.flashT = 0; Sfx.play('super');
  }
  if (m.kind === 'special') Sfx.play('whoosh');
  if (!m.air) { p.vx = 0; }
  if (baseId(id) === 'jS') p.airS = true;
  if (m.kind === 'normal') p.meter = Math.min(100, p.meter + 0.4);
  return true;
}

function tryAttack(p) {
  const o = opp(p), dir = p.dir, air = p.state === 'air' || p.state === 'airdash';
  if (!air && p.c.moves.taunt && p.takeBoth('L', 'H')) return startMove(p, 'taunt');
  if (p.meter >= 100 && !air && p.takeBoth('S', 'H')) return startMove(p, 'SU');
  if (!air && p.takeBoth('L', 'M')) { p.throwBack = [1, 4, 7].includes(dir); return startMove(p, 'throw'); }
  // technical input: motion + L / M (free), motion + H = EX (50 Spurt; without it you get the M version)
  if (p.has('L') || p.has('M') || p.has('H')) {
    const b = p.has('H') ? 'H' : p.has('M') ? 'M' : 'L';
    const id = techSkill(p, air, p.bufHist[b]);
    if (id && !(air && p.airS) && techOK(p, id)) {
      p.take('L'); p.take('M'); p.take('H'); return startMove(p, techMove(p, id, b), true);
    }
    // dash attacks: while dashing, or 66 + button
    if (!air && (p.state === 'dash' || matchMotion(p.bufHist[b] || p.hist, '66'))) {
      if (p.c.moves['d' + b]) { p.take(b); return startMove(p, 'd' + b); }
    }
  }
  if (p.has('S')) {
    let id; const dir = p.bufDir.S ?? p.dir;
    if (air) id = p.airS ? null : 'jS';
    else if ([1, 2, 3].includes(dir)) id = '2S';
    else if (dir === 6 || dir === 9) id = '6S';
    else if (dir === 4 || dir === 7) id = '4S';
    else id = '5S';
    if (id && p.c.moves[id]) {
      p.take('S');
      if (id === 'jS' && p.airS) return false;
      if (projBlocked(p, id)) return false;
      if (!skillReady(p, id)) { addText('COOLDOWN', p.x, GY - 175, '#99a', 13, 20); return false; }
      return startMove(p, id);
    }
  }
  for (const b of ['H', 'M', 'L']) {
    if (p.has(b)) {
      p.take(b);
      const bd = p.bufDir[b] ?? dir;
      const id = air ? 'j' + b : [1, 2, 3].includes(bd) ? '2' + b : (b === 'M' && bd === 6) ? '6M' : '5' + b;
      return startMove(p, id);
    }
  }
  return false;
}

// cancel from a connected move
function tryCancel(p) {
  const m = p.move;
  if (!p.connected || p.t < m.first) return false;
  if (m.kind === 'super' || m.kind === 'throw') return false;
  if (p.meter >= 100 && !m.air && p.takeBoth('S', 'H')) return startMove(p, 'SU');
  // special chain (glass cannon): a special that HITS can cancel into a different special, each once per combo
  if (m.kind === 'special' && p.c.specialChain && p.hitOK && !m.air && p.hitDone.filter(Boolean).length >= (m.hits || []).length) {   // after the move's last hit
    let id = null, b = null;
    if (p.has('L') || p.has('M') || p.has('H')) { b = p.has('H') ? 'H' : p.has('M') ? 'M' : 'L'; id = techSkill(p, false, p.bufHist[b]); }
    if (!id && p.has('S')) { const d = p.bufDir.S ?? p.dir; id = [1, 2, 3].includes(d) ? '2S' : (d === 6 || d === 9) ? '6S' : (d === 4 || d === 7) ? '4S' : '5S'; }
    const cur = baseId(m.followOf || m.id);
    if (id && p.c.moves[id] && id !== cur && !p.chainUsed.includes(id) && techOK(p, id)) {
      if (!p.chainUsed.includes(cur)) p.chainUsed.push(cur);
      p.chainUsed.push(id);
      const tech = !!b; p.take('L'); p.take('M'); p.take('H'); p.take('S');
      addText('CHAIN', p.x, GY - 195, p.c.look.fxColor, 15, 20);
      return startMove(p, tech ? techMove(p, id, b) : id, tech);
    }
  }
  if (m.kind === 'special' || m.kind === 'gc' || m.noChain) return false;
  // technical / EX skill cancel
  if (!m.air && (p.has('L') || p.has('M') || p.has('H'))) {
    const b = p.has('H') ? 'H' : p.has('M') ? 'M' : 'L';
    const id = techSkill(p, false, p.bufHist[b]);
    if (id && techOK(p, id)) {
      p.take('L'); p.take('M'); p.take('H'); return startMove(p, techMove(p, id, b), true);
    }
  }
  // jump cancel: only off the launching hit
  if (m.jc && p.hitOK && p.launched && ([7, 8, 9].includes(p.dir) || p.upBuf > 0)) { p.upBuf = 0; jump(p); if (p.jx === 0) p.jx = p.inp.l || p.inp.r ? ((p.inp.r ? 1 : -1) * p.facing) : 1; return true; }
  if (p.has('S') && !m.air) return tryAttack(p);
  if (m.air) {
    for (const b of ['H', 'M', 'L']) if (p.has(b) && ({ L: 1, M: 2, H: 3 })[b] > m.str) { p.take(b); return startMove(p, 'j' + b); }
    return false;
  }
  // dash cancel (rushdown): →→ during a connected normal, 10 Spurt
  if (p.c.dashCancel && m.kind === 'normal' && !m.air && p.dashBuf > 0 && p.meter >= 10) {
    p.dashBuf = 0; p.meter -= 10; p.setState('dash'); p.dashMin = 8; p.vx = p.c.dash * p.facing; dust(p.x, GY, p.facing);
    addText('DASH CANCEL', p.x, GY - 180, p.c.color, 14, 22); return true;
  }
  // crouching light chains into itself (rushdown)
  if (p.c.lightChain && m.str === 1 && m.kind === 'normal' && !m.air && p.has('L') && [1, 2, 3].includes(p.bufDir.L ?? p.dir)) { p.take('L'); return startMove(p, '2L'); }
  // auto-combo: mash L  -> 5L > 5M > 5H > 5S
  if (p.has('L')) {
    const next = { '5L': '5M', '2L': '5M', 'dL': '5M', '5M': '5H', '2M': '5H', 'dM': '5H', '5H': '5S', '2H': '5S' }[m.id];
    if (next) { p.take('L'); return startMove(p, next); }
  }
  for (const b of ['H', 'M']) {
    if (p.has(b) && ({ M: 2, H: 3 })[b] > m.str) {
      p.take(b); return startMove(p, ([1, 2, 3].includes(p.bufDir[b] ?? p.dir) ? '2' : '5') + b);
    }
  }
  return false;
}

function jump(p) {
  p.setState('jsquat');
  const d = p.dir;
  p.jx = d === 9 ? 1 : d === 7 ? -1 : 0;
  p.jumpBoost = p.prevState === 'dash' ? 1.4 : 1;
}

// ---------------------------------------------------------------- Per-fighter update
function updateFighter(p) {
  const o = opp(p), c = p.c;
  p.t++;
  if (p.combo > 0 && ['hit', 'airHit', 'cineHit', 'down'].includes(p.state)) p.comboT++;
  for (const k in p.cd) if (p.cd[k] > 0) p.cd[k]--;
  if (p.guts > 0) p.guts--;
  if (p.gold > 0) p.gold--;
  const spd = p.gold > 0 ? 1.25 : 1;   // Golshi Mode
  if (p.flash > 0) p.flash--;
  const faceOpp = () => { if (o.x !== p.x) p.facing = o.x > p.x ? 1 : -1; };

  switch (p.state) {
    case 'intro': p.vx = 0; break;
    case 'win': case 'lose': p.vx = 0; break;

    case 'idle': case 'walk': case 'crouch': case 'dash': case 'land0': {
      if (p.state !== 'dash') faceOpp();
      p.combo = 0; p.jug = 0; p.airS = false; if (p.chainUsed.length) p.chainUsed = [];
      p.comboT = 0; p.prorate = 1; p.gbUsed = p.wbUsed = false; p.bounce = null; p.limitHit = false;
      if (G.phase !== 'fight') { p.vx = 0; p.setState('idle'); break; }
      if (tryAttack(p)) break;
      const d = p.dir;
      if ([7, 8, 9].includes(d)) { p.prevState = p.state; jump(p); break; }
      if (p.state === 'dash') {
        if (d === 6 || d === 3 || p.t < p.dashMin) { p.vx = c.dash * spd * p.facing; if (p.t % 8 === 0) dust(p.x, GY, p.facing); break; }
        p.vx *= 0.5; if (p.t > 0) p.setState('idle'); break;
      }
      if (p.dashTap && d === 6) { p.dashMin = 0; p.setState('dash'); p.vx = c.dash * spd * p.facing; dust(p.x, GY, p.facing); break; }
      if (p.bdashTap && d === 4) { const bd = c.backdash || {}; p.setState('backdash'); p.vy = bd.vy || -5; p.vx = -(bd.vx || 7) * p.facing; break; }
      if ([1, 2, 3].includes(d)) { if (p.state !== 'crouch') p.setState('crouch'); p.vx = 0; }
      else if (d === 6) { if (p.state !== 'walk') p.setState('walk'); p.vx = c.walk * spd * p.facing; p.walkDir = 1; }
      else if (d === 4) { if (p.state !== 'walk') p.setState('walk'); p.vx = -c.back * spd * p.facing; p.walkDir = -1; }
      else { if (p.state !== 'idle') p.setState('idle'); p.vx = 0; }
      break;
    }
    case 'jsquat':
      p.vx = 0;
      if (p.t >= 4) {
        p.setState('air'); p.vy = c.jumpV; p.airAct = (c.airDash || c.doubleJump) ? 1 : 0; p.adLand = false;
        p.vx = p.jx * c.jumpX * p.facing * (p.jumpBoost || 1);
      }
      break;
    case 'air':
      // double jump / air dash, once per jump
      if (p.airAct > 0 && p.t > 3) {
        if (c.doubleJump && p.inp.u && !p.prev.u) {
          const fx = (p.inp.r ? 1 : 0) - (p.inp.l ? 1 : 0);
          p.airAct--; p.vy = c.jumpV * 0.82; p.vx = fx * c.jumpX; p.jx = fx * p.facing; p.t = 0;
          dust(p.x, p.y, 1); dust(p.x, p.y, -1); break;
        }
        if (c.airDash && (p.dashTap || p.bdashTap) && p.y < GY - 80) {
          p.airAct--; p.adDir = p.dashTap ? 1 : -1; p.setState('airdash'); break;
        }
      }
      p.vy += c.grav;
      tryAttack(p);
      break;
    case 'airdash':
      p.vy = 0.6; p.vx = p.adDir * (p.adDir > 0 ? 9.5 : 7.5) * p.facing;
      if (p.t > 8 && tryAttack(p)) break;
      if (p.t >= 14) { p.setState('air'); p.t = 10; p.vx *= 0.5; p.adLand = true; }
      break;
    case 'land':
      p.vx *= 0.6;
      if (p.t >= p.landRec) p.setState('idle');
      break;
    case 'backdash':
      p.vy += 0.9;
      if (p.y >= GY && p.t > 2) { p.y = GY; p.vy = 0; p.vx = 0; if (p.t >= ((c.backdash && c.backdash.total) || 22)) p.setState('idle'); }
      break;

    case 'attack': {
      const m = p.move;
      // follow-ups (e.g. Golshi Rush): press a button during the window to branch
      if (m.follow && p.t >= m.follow.win[0] && p.t <= m.follow.win[1]) {
        const fb = ['S', 'H', 'M', 'L'].find(b => p.has(b) && m.follow[b]);
        if (fb) {
          p.take(fb);
          if (m.follow[fb] === 'stop') { p.vx *= 0.25; p.setState('idle'); dust(p.x, GY, p.facing); }
          else { const keep = p.vx; startMove(p, m.follow[fb], true); p.vx = keep * 0.6; }
          break;
        }
      }
      if (tryCancel(p)) break;
      let moved = false, vySet = false;
      if (m.vel) for (const v of m.vel) if (p.t >= v[0] && p.t <= v[1]) {
        p.vx = v[2] * p.facing; if (v[3] !== undefined) { p.vy = v[3]; vySet = true; } moved = true;
      }
      if (!moved && !m.air) p.vx *= 0.75;
      // don't keep upward speed from a cancelled move (Dropkick into super used to fly off screen)
      if (!m.air && !vySet) { if (p.y < GY) p.vy += c.grav; else p.vy = 0; }
      if (m.air && !moved) p.vy += c.grav;
      if (m.ev && m.ev[p.t]) doEvent(p, m.ev[p.t]);
      if (m.fxAll && !G.resim) for (const e of m.fxAll) if (e.t === p.t) spawnFx(p, e);
      if (m.grab && p.t >= m.grab[0] && p.t <= m.grab[1]) tryGrab(p);
      if (p.state !== 'attack') break;
      if (m.air && p.y >= GY && p.t > 1) { p.y = GY; p.vy = 0; p.landRec = m.landRec || 5; p.setState('land'); dust(p.x, GY, p.facing); break; }
      if (p.t >= m.total) {
        if (m.air) { p.setState('air'); }
        else p.setState(m.crouch ? 'crouch' : 'idle');
      }
      break;
    }
    case 'hit':
      p.vx *= 0.88;
      if (--p.hs <= 0) p.setState(p.crouchHit ? 'crouch' : 'idle');
      break;
    case 'block':
      if (p.meter >= 50 && p.takeBoth('S', 'H')) { startMove(p, 'GC'); break; }
      p.vx *= 0.85;
      if (--p.bs <= 0) p.setState(p.crouchBlock ? 'crouch' : 'idle');
      break;
    case 'airHit':
      p.vy += 0.56 + (p.comboT > DECAY_AT ? Math.min(0.35, (p.comboT - DECAY_AT) / 500) : 0);
      if (p.bounce === 'wb' && (p.x + p.vx <= 41 || p.x + p.vx >= STAGE_W - 41 || Math.abs(p.x + p.vx - o.x) >= W - 91)) {   // wall bounce (corner or screen edge)
        p.bounce = null; p.wbUsed = true; p.vx = -p.vx * 0.4; p.vy = Math.min(p.vy, -10.5); p.jug++;
        spark(p.x, p.y - 80, 'hit', 2, -Math.sign(p.vx || 1)); G.shake = Math.max(G.shake, 6); G.freeze = Math.max(G.freeze, 6); Sfx.play('heavy');
        addText('WALL BOUNCE', p.x, p.y - 150, '#ffd24a', 18, 30); break;
      }
      if (p.y >= GY && p.vy > 0 && p.bounce === 'gb') {   // ground bounce
        p.bounce = null; p.gbUsed = true; p.y = GY - 1; p.vy = -9.5; p.vx *= 0.45; p.jug++;
        dust(p.x, GY, 1); dust(p.x, GY, -1); G.shake = Math.max(G.shake, 6); Sfx.play('thud');
        addText('GROUND BOUNCE', p.x, GY - 150, '#ffd24a', 18, 30); break;
      }
      if (p.y >= GY && p.vy > 0) {
        p.bounce = null;
        p.y = GY; p.vy = 0; p.vx *= 0.3; p.setState('down'); dust(p.x, GY, 1); dust(p.x, GY, -1);
        G.shake = Math.max(G.shake, 4); Sfx.play('thud');
      }
      break;
    case 'down': {
      p.vx *= 0.8;
      if (p.hp <= 0) break;
      // quick rise: hold any attack button; delayed rise: hold down. Not after hard knockdowns.
      if (p.t === 10 && !p.hardKd && (p.inp.L || p.inp.M || p.inp.H || p.inp.S)) {
        p.setState('wake'); addText('QUICK RISE', p.x, GY - 120, '#cfe3ff', 14, 24); break;
      }
      if (p.t >= (p.inp.d && !p.hardKd ? 56 : 34)) p.setState('wake');
      break;
    }
    case 'wake':
      p.vx = 0;
      if (p.t >= 14) { faceOpp(); p.setState('idle'); }
      break;
    case 'throwing': {
      p.vx = 0;
      if (p.t === 22) {
        if (p.throwBack) { const tx = o.x; o.x = p.x - p.facing * 70; p.facing = -p.facing; }
      }
      if (p.t === 26) {
        o.comboDmg = 0; dealDamage(p, o, p.throwDmg, 1); o.combo = 1; noteDamage(o, p.throwDmg);
        o.setState('airHit'); o.kd = true; o.hardKd = true; o.vx = p.throwVx * p.facing; o.vy = -9; o.y = GY - 1;
        spark(o.x, GY - 90, 'hit', 2, p.facing, p); G.freeze = 10; G.shake = 8; Sfx.play('heavy'); o.hitLvl = 2;
        contact(p, o);
      }
      if (p.t >= 40) p.setState('idle');
      break;
    }
    case 'thrown':
      if (o.state !== 'throwing') { p.setState('airHit'); p.kd = true; p.vy = -4; p.vx = 0; p.y = Math.min(p.y, GY - 1); break; }   // throw got interrupted
      p.x = o.x + o.facing * 62;
      if (p.t <= 10 && !o.noTech && p.takeBoth('L', 'M')) { // tech!
        p.setState('tech'); o.setState('tech');
        p.vx = -8 * o.facing; o.vx = 8 * o.facing;
        addText('THROW TECH', (p.x + o.x) / 2, GY - 210, '#9cf', 24); spark((p.x + o.x) / 2, GY - 90, 'block', 2, 0); Sfx.play('block');
      }
      break;
    case 'tech':
      p.vx *= 0.85; if (p.t >= 18) p.setState('idle');
      break;
    case 'cine': if (p.y < GY) p.vy += c.grav; else p.vy = 0; updateCine(p); break;
    case 'cineHit':
      p.vx = 0; p.vy = 0; if (p.y < GY) p.y = Math.min(GY, p.y + Math.max(4, (GY - p.y) * 0.3));   // a juggled opponent is pulled down into the cinematic
      if (o.state !== 'cine') { p.setState('airHit'); p.kd = true; p.vy = -4; p.vx = 0; p.y = Math.min(p.y, GY - 1); }   // cinematic ended early
      break;
  }

  // physics
  if (!['cineHit', 'thrown'].includes(p.state)) {
    p.x += p.vx; p.y += p.vy;
    if ((p.state === 'air' || p.state === 'airdash') && p.y >= GY) { p.y = GY; p.vy = 0; p.vx = 0; p.landRec = p.adLand ? 7 : 4; p.adLand = false; p.setState('land'); dust(p.x, GY, p.facing); }
    if (p.y > GY) p.y = GY;
  }
  if (p.hp <= 0 && p.state === 'idle') p.setState('down');
}

function doEvent(p, ev) {
  if (ev === 'guts') {
    p.guts = 360; p.meter = Math.min(100, p.meter + 15); p.flash = 10;
    addText('GUTS!', p.x, GY - 220, p.c.color, 30); Sfx.play('power');
  }
  if (ev === 'gutsEx') {
    p.guts = 600; p.hp = Math.min(p.c.hp, p.hp + 600); p.flash = 12;
    addText('GUTS!! +600', p.x, GY - 220, p.c.color, 30); Sfx.play('power');
  }
  if (ev === 'tpBehind' || ev === 'tpFront' || ev === 'tpAway') {
    const o = opp(p), toward = o.x >= p.x ? 1 : -1;
    if (ev === 'tpBehind') p.x = o.x + toward * 80;
    if (ev === 'tpFront') p.x = o.x - toward * 85;
    if (ev === 'tpAway') p.x = p.x - toward * 260;
    p.x = Math.max(40, Math.min(STAGE_W - 40, p.x));
    p.facing = o.x >= p.x ? 1 : -1;
  }
  if (ev === 'gold' || ev === 'goldEx') {
    p.gold = ev === 'goldEx' ? 600 : 360; p.flash = 10; Sfx.play('power');
  }
  if (ev === 'taunt') {
    p.meter = Math.min(100, p.meter + 8);
    if (p.c.look.tauntLine) addText(p.c.look.tauntLine, p.x, GY - 215, p.c.look.fxColor, 22, 45);
  }
  if (ev === 'proj' || ev === 'proj2' || ev.startsWith('shot')) {
    const pj = ev === 'proj' ? p.move.proj : ev === 'proj2' ? p.move.proj2 : p.move.shots[+ev.slice(4)];
    // projectile position is its CENTER; box is relative to the center
    G.projs.push({ owner: p.side, simple: p.simple, style: pj.style || 'wind', hitsLeft: pj.hits || 1, cool: 0,
      x: p.x + p.facing * (pj.x0 ?? 60), y: p.y + (pj.y0 ?? -92), facing: p.facing, vx: pj.vx * p.facing, vy: pj.vy || 0,
      life: pj.life, box: pj.box, hit: pj.hit, t: 0, dead: false, sup: !!pj.sup, size: pj.size || 1 });
    Sfx.play(pj.sup ? (pj.size > 1 ? 'heavy' : 'whoosh') : 'wind');
  }
}

function tryGrab(p) {
  const o = opp(p);
  if (Math.abs(o.x - p.x) > p.move.range || o.airborne || !hurtbox(o)) return;
  if (['hit', 'block', 'down', 'wake', 'airHit', 'thrown', 'throwing', 'cineHit', 'jsquat', 'backdash'].includes(o.state)) return;
  if (o.state === 'attack' && o.move.kind === 'throw' && o.t <= o.move.grab[1]) { // simultaneous throws -> tech
    p.setState('tech'); o.setState('tech'); p.vx = -8 * p.facing; o.vx = -8 * o.facing;
    addText('THROW TECH', (p.x + o.x) / 2, GY - 210, '#9cf', 24); return;
  }
  p.throwDmg = p.move.throwDmg || 1300; p.noTech = !!p.move.noTech; p.throwVx = p.move.throwVx ?? 6;
  if (p.noTech) addText(p.move.name.toUpperCase(), p.x, GY - 210, p.c.color, 22, 36);
  p.setState('throwing'); o.setState('thrown'); o.facing = -p.facing;
  Sfx.play('grab');
}

// ---------------------------------------------------------------- Cinematic supers
function updateCine(p) {
  const o = opp(p), script = p.move.cine;
  const step = script[p.cs];
  if (!step) { p.setState('land'); p.landRec = 14; return; }
  if (p.t === 1) {
    p.vx = 0;
    o.x = Math.max(40, Math.min(STAGE_W - 40, p.x + p.facing * 70));
    if (step[3]) {
      const fin = step[4] === 'fin';
      const scale = Math.max(0.5, comboScale(o));
      const miracle = !!p.c.lowHpBoost && p.hp <= p.c.hp * 0.3;
      const dmg = Math.round(step[3] * scale * (p.guts ? 1.15 : 1) * (p.c.dmgMul || 1) * (miracle ? 1.15 : 1));   // same multipliers as normal hits
      dealDamage(p, o, dmg, 0);
      o.combo++; o.flash = 4;
      noteDamage(o, dmg);
      spark(o.x - p.facing * 10, GY - 90 - (fin ? 40 : 0), 'super', fin ? 3 : 1, p.facing, p);
      G.freeze = fin ? 22 : 4; G.shake = fin ? 14 : 4;
      Sfx.play(fin ? 'heavy' : 'hit');
      if (fin) {
        o.setState('airHit'); o.kd = true; o.hardKd = true; o.vx = 7 * p.facing; o.vy = -14; o.y = GY - 1; o.jug = JUG_MAX;
      }
    }
  }
  if (p.t >= step[2]) { p.cs++; p.t = 0; }
}

// ---------------------------------------------------------------- Damage
// damage scaling: the first hit is full damage; after that the starter's proration (lights 80%, mediums 90%,
// heavies / counter hits / punishes 100%) times a per-hit decay of 13% from the 3rd hit, down to 25%
function comboScale(d) { return d.combo === 0 ? 1 : (d.prorate || 1) * (d.combo < 2 ? 1 : Math.max(0.25, 1 - 0.13 * (d.combo - 1))); }
function dealDamage(a, d, dmg, chip) {
  d.hp = Math.max(0, d.hp - dmg);
  if (d.c.lowHpBoost && !d.miracle && d.hp > 0 && d.hp <= d.c.hp * 0.3) { d.miracle = true; d.flash = 14; addText('MIRACLE MODE', d.x, GY - 230, d.c.look.fxColor, 24, 60); }
  d.comboDmg += dmg;
  a.meter = Math.min(100, a.meter + dmg / 70);
  d.meter = Math.min(100, d.meter + dmg / 140);
}
function noteDamage(d, dmg) {
  if (G.mode === 'training' && !G.resim) G.dmgInfo = { last: dmg, combo: d.comboDmg, hits: d.combo, t: 0 };
}
function contact(a, d) {
  if (G.mode === 'training') G.adv = { a, d, aFree: -1, dFree: -1, t: 0, val: null };
}

function isHoldingBack(d, fromX) {
  return fromX > d.x ? d.inp.l : fromX < d.x ? d.inp.r : (d.facing === 1 ? d.inp.l : d.inp.r);
}
function canBlock(d) {
  // holding back cancels a dash (UNI-style)
  return ['idle', 'walk', 'crouch', 'block', 'land0', 'dash'].includes(d.state) || (d.state === 'land' && d.t > 1);
}

// returns 'hit' | 'block' | null
function resolveHit(a, d, h, srcX, fromAir, proj) {
  if (!hurtboxOK(d)) return null;
  if (invulnerable(d, fromAir)) return null;
  if (proj && d.state === 'attack' && d.move.projInv && d.t >= d.move.projInv[0] && d.t <= d.move.projInv[1]) return null;   // passes through projectiles
  // ------ counter stance: a strike that lands during the window is caught and answered
  const cw = d.state === 'attack' && d.move.counter;
  if (cw && d.t >= cw.f[0] && d.t <= cw.f[1] && !h.cine && (!proj || cw.proj)) {
    if (proj) { spark(proj.x, proj.y, 'block', 2, 0); addText('PARRY', d.x, GY - 200, d.c.look.fxColor, 20, 28); Sfx.play('block'); return 'block'; }
    if (a.airborne) { a.setState('airHit'); a.kd = false; a.hardKd = false; a.vy = -5; a.vx = a.x < d.x ? -3 : 3; a.y = Math.min(a.y, GY - 1); }
    else { a.setState('hit'); a.hs = cw.stun || 30; a.crouchHit = false; a.vx = 0; }
    a.combo = 0; a.comboDmg = 0; a.jug = 0;
    d.facing = a.x >= d.x ? 1 : -1;
    startMove(d, cw.to, true);
    spark((a.x + d.x) / 2, GY - 100, 'counter', 3, d.facing); G.freeze = 16; G.shake = 6; d.flash = 10;
    addText('COUNTER!', d.x, GY - 210, d.c.look.fxColor, 28, 40); Sfx.play('armor');
    return 'block';
  }
  const dirSign = srcX < d.x ? 1 : -1; // push direction for defender
  const crouching = d.inp.d;
  // ------ block
  if (canBlock(d) && isHoldingBack(d, srcX) && !d.airborne) {
    const okLow = h.guard !== 'low' || crouching;
    const okHigh = h.guard !== 'high' || !crouching;
    if (okLow && okHigh) {
      d.setState('block'); d.bs = h.bs + (a.gold > 0 ? 2 : 0); d.crouchBlock = !!crouching;
      d.vx = dirSign * h.push * 1.2;
      if (h.chip) dealDamage(a, d, Math.min(d.hp - (h.cine ? 0 : 1), Math.round(h.dmg * h.chip)), 1);
      d.meter = Math.min(100, d.meter + 1.5); a.meter = Math.min(100, a.meter + 1);
      spark(d.x - dirSign * 25, GY - (crouching ? 55 : 95), 'block', Math.min(h.lvl, 2), -dirSign);
      G.freeze = 6 + h.lvl * 2; Sfx.play('block');
      a.connected = true; a.hitOK = false;
      if (h.cine) { a.connected = true; }
      contact(a, d);
      return 'block';
    }
  }
  // ------ armor
  if (d.state === 'attack' && d.armorLeft > 0 && d.move.armor && d.t >= d.move.armor[0] && d.t <= d.move.armor[1]) {
    d.armorLeft--; dealDamage(a, d, Math.round(h.dmg * 0.5), 0); d.flash = 8;
    spark(d.x - dirSign * 20, GY - 90, 'armor', 2, -dirSign); G.freeze = 10; Sfx.play('armor');
    addText('ARMOR', d.x, GY - 200, '#ffd24a', 20, 30);
    a.connected = true; a.hitOK = false; return 'block';
  }
  // ------ combo limit: past the cap, hits pass through and the opponent drops out
  if (['hit', 'airHit'].includes(d.state) && d.combo > 0 && (d.combo >= COMBO_HITS || d.comboT >= COMBO_TIME)) {
    if (!d.limitHit) { d.limitHit = true; addText('COMBO LIMIT', d.x, GY - 210, '#9fe3ff', 22, 40); }
    return null;
  }
  // ------ hit
  const counter = d.state === 'attack' && d.t < d.move.first && d.move.kind !== 'throw';
  if (!(['hit', 'airHit'].includes(d.state))) { d.combo = 0; d.comboDmg = 0; d.jug = 0; d.comboT = 0; d.gbUsed = d.wbUsed = false; d.bounce = null; d.limitHit = false; }
  // punish (bait & punish): hitting someone stuck in the recovery of their move or a long landing
  const punish = !!a.c.punisher && d.combo === 0 && ((d.state === 'attack' && d.move.kind !== 'taunt' && d.t > d.move.lastActive) || (d.state === 'land' && d.landRec >= 7));
  if (d.combo === 0) d.prorate = counter || punish ? 1 : h.lvl === 0 ? 0.8 : h.lvl === 1 ? 0.9 : 1;
  let scale = comboScale(d);
  if ((a.state === 'attack' && a.move.kind === 'super') || (proj && proj.sup)) scale = Math.max(scale, 0.5);   // supers always keep half their damage
  const simple = proj ? proj.simple : (a.state === 'attack' && a.simple);
  const miracle = !!a.c.lowHpBoost && a.hp <= a.c.hp * 0.3;
  let dmg = Math.round(h.dmg * scale * (counter ? 1.1 : 1) * (a.guts ? 1.15 : 1) * (simple ? 0.9 : 1) * (a.gold > 0 ? 1.08 : 1) * (a.c.dmgMul || 1) * (punish ? 1.2 : 1) * (miracle ? 1.15 : 1));
  dealDamage(a, d, dmg, 0);
  d.combo++; d.flash = 3;
  noteDamage(d, dmg);
  const decay = d.comboT > DECAY_AT ? Math.max(0.45, 1 - (d.comboT - DECAY_AT) / 320) : 1;   // hitstun decay in long combos
  const hs = Math.round((h.hs * (counter ? 1.4 : 1) + (a.state === 'attack' && a.move.kind === 'normal' ? 1 : 0) + (punish ? 8 : 0)) * decay);
  if (punish) addText('PUNISH!', d.x, GY - 200, a.c.look.fxColor, 24, 38);
  else if (counter) addText('COUNTER', d.x, GY - 200, '#ff5a5a', 22, 35);

  if (h.cine && !proj) { // super cinematic
    a.setState('cine'); a.cs = 0; d.setState('cineHit'); d.x = Math.max(40, Math.min(STAGE_W - 40, a.x + a.facing * 70));
    spark(d.x, GY - 90, 'super', 2, a.facing); G.freeze = 12; Sfx.play('heavy');
    a.connected = true; return 'hit';
  }
  const spike = h.spike && d.airborne && d.combo > 1 && !d.gbUsed;   // j.H in an air combo slams them into a ground bounce
  if (d.airborne || h.launch || h.kd || d.hp <= 0) {
    const L = spike ? [1.5, 10] : h.launch || [3, -6];
    if (spike) d.bounce = 'gb'; else if (h.wb && !d.wbUsed) d.bounce = 'wb';
    d.setState('airHit'); d.kd = !!h.kd; d.hardKd = !!h.hard;
    d.vx = dirSign * L[0]; d.vy = L[1] * (d.airborne ? Math.max(0.55, 1 - d.jug * 0.08) : 1);
    if (d.hp <= 0) { d.vy = Math.min(d.vy, -9); d.vx = dirSign * 5; }
    d.y = Math.min(d.y, GY - 1); d.jug += proj && proj.sup ? 0 : proj || (a.state === 'attack' && a.move.kind !== 'normal') ? 2 : 1;
  } else {
    d.setState('hit'); d.hs = hs; d.crouchHit = !!crouching && h.guard !== 'high';
    d.vx = dirSign * h.push * 0.75;
  }
  // corner push-back goes to the attacker
  if (!proj && (d.x < 60 || d.x > STAGE_W - 60 || Math.abs(d.x - G.cam) > W / 2 - 60)) a.vx = -dirSign * h.push * 0.9;
  spark(d.x - dirSign * 22, (d.airborne ? d.y : GY) - 90, counter ? 'counter' : 'hit', h.lvl, -dirSign, a);
  d.hitLvl = h.lvl;
  G.freeze = [7, 9, 11, 14][h.lvl] + (counter ? 4 : 0);
  G.shake = h.lvl >= 2 ? 3 + h.lvl * 2 : 0;
  Sfx.play(h.lvl >= 2 ? 'heavy' : 'hit');
  a.connected = true; a.hitOK = true; a.launched = !!h.launch;
  contact(a, d);
  return 'hit';
}
function hurtboxOK(d) { return !!hurtbox(d); }

function checkHits(a) {
  if (a.state !== 'attack' || !a.move.hits) return null;
  const d = opp(a), hb = hurtbox(d); if (!hb) return null;
  const res = [];
  a.move.hits.forEach((h, i) => {
    if (a.hitDone[i] || a.t < h.f[0] || a.t > h.f[1]) return;
    if (overlap(rect(a, h.box), hb)) res.push([i, h]);
  });
  return res.length ? res[0] : null;
}

// ---------------------------------------------------------------- Projectiles
function projRect(q) { const b = q.box; return { x: q.x + b[0], y: q.y + b[1], w: b[2], h: b[3] }; }
function updateProjs() {
  for (const q of G.projs) {
    q.x += q.vx; q.y += q.vy || 0; q.t++; if (q.cool > 0) q.cool--;
    if (q.vy > 0 && q.y >= GY - 12) { q.dead = true; dust(q.x, GY, 1); continue; }   // air shots end on the ground
    if (--q.life <= 0 || q.x < -100 || q.x > STAGE_W + 100) q.dead = true;
  }
  // reflectors
  for (const p of G.p) {
    const m = p.state === 'attack' && p.move.reflect;
    if (!m || p.t < m.f[0] || p.t > m.f[1]) continue;
    const r = rect(p, m.box);
    for (const q of G.projs) if (q.owner !== p.side && !q.dead && !q.sup && overlap(projRect(q), r)) {
      q.owner = p.side; q.vx = -q.vx * 1.15; q.vy = -(q.vy || 0); q.facing = -q.facing; q.life = Math.max(q.life, 60);
      spark(q.x, q.y, 'block', 2, 0); addText('REFLECT', q.x, q.y - 40, p.c.look.fxColor, 18, 26); Sfx.play('block');
    }
  }
  // clash
  for (let i = 0; i < G.projs.length; i++) for (let j = i + 1; j < G.projs.length; j++) {
    const A = G.projs[i], B = G.projs[j];
    if (A.owner !== B.owner && !A.dead && !B.dead && overlap(projRect(A), projRect(B))) {
      if (A.sup !== B.sup) (A.sup ? B : A).dead = true; else A.dead = B.dead = true;   // super shots win clashes
      spark((A.x + B.x) / 2, (A.y + B.y) / 2, 'block', 2, 0); Sfx.play('block');
    }
  }
  for (const q of G.projs) {
    if (q.dead || q.cool > 0) continue;
    const d = opp(G.p[q.owner]), hb = hurtbox(d);
    if (hb && overlap(projRect(q), hb)) {
      const r = resolveHit(G.p[q.owner], d, q.hit, q.x - q.vx * 4, false, q);
      if (r) { if (--q.hitsLeft > 0) { q.cool = 7; q.vx *= 0.6; } else q.dead = true; }
    }
  }
  G.projs = G.projs.filter(q => !q.dead);
}

// ---------------------------------------------------------------- Main step
function step(inputs) {
  G.frameCount++;
  const frozen = G.freeze > 0;
  G.p.forEach((p, i) => p.feed(inputs[i], frozen));
  if (G.freeze > 0) { G.freeze--; if (G.freeze === 0) G.flashOwner = null; updateFx(true); return; }
  if (G.slow > 0) { G.slow--; if (G.slow % 2) { updateFx(); return; } }

  phaseLogic();
  const [a, b] = G.p;
  updateFighter(a); updateFighter(b);

  // pushboxes
  const pushOn = p => !(p.state === 'attack' && p.move.noPush && p.t >= p.move.noPush[0] && p.t <= p.move.noPush[1]) &&
    !['down', 'wake', 'thrown', 'cineHit', 'airHit'].includes(p.state);
  if (pushOn(a) && pushOn(b) && Math.abs(a.y - b.y) < 110) {
    const ov = 52 - Math.abs(a.x - b.x);
    if (ov > 0) {
      let s = a.x < b.x ? -1 : a.x > b.x ? 1 : -a.facing;
      a.x += s * ov / 2; b.x -= s * ov / 2;
    }
  }
  // stage bounds + camera leash
  for (const p of G.p) {
    const o = opp(p);
    p.x = Math.max(40, Math.min(STAGE_W - 40, p.x));
    const lim = W - 90;
    if (p.x - o.x > lim) p.x = o.x + lim;
    if (o.x - p.x > lim) p.x = o.x - lim;
  }
  // hits (simultaneous => trades)
  const ha = checkHits(a), hb = checkHits(b);
  if (ha) { a.hitDone[ha[0]] = true; }
  if (hb) { b.hitDone[hb[0]] = true; }
  if (ha) resolveHit(a, b, ha[1], a.x, a.airborne, false);
  if (hb) resolveHit(b, a, hb[1], b.x, b.airborne, false);
  updateProjs();

  // camera
  const mid = (a.x + b.x) / 2;
  G.cam += (Math.max(W / 2, Math.min(STAGE_W - W / 2, mid)) - G.cam) * 0.2;

  // training conveniences & frame advantage
  if (G.mode === 'training') {
    for (const p of G.p) {
      if (p.actionable() && p.state !== 'air') { if (p.hp < p.c.hp && p.combo === 0 && opp(p).actionable()) p.hp = p.c.hp; }
      if (G.training.meter && p.actionable()) p.meter = 100;
    }
    const A = G.adv;
    if (A && A.val === null) {
      A.t++;
      if (A.aFree < 0 && A.a.actionable() && A.a.state !== 'air') A.aFree = A.t;
      if (A.dFree < 0 && A.d.actionable() && A.d.state !== 'air') A.dFree = A.t;
      if (A.aFree >= 0 && A.dFree >= 0) A.val = A.dFree - A.aFree;
      if (A.t > 240) G.adv = null;
    }
  }
  updateFx();
}

function updateFx(frozen) {
  for (const f of G.fx) {
    if (frozen && f.type === 'vfx' && f.kind !== 'bang') continue;   // move effects freeze during hitstop
    f.t++; if (f.vx !== undefined) { f.x += f.vx; f.y += f.vy; if (f.type === 'pt') f.vy += 0.25; } }
  G.fx = G.fx.filter(f => f.t < f.life);
  for (const t of G.texts) t.t++;
  G.texts = G.texts.filter(t => t.t < t.life);
  if (G.shake > 0) G.shake *= 0.85, G.shake < 0.5 && (G.shake = 0);
  if (G.resim) return;
  for (const p of G.p) {
    p.dispHp += (p.hp - p.dispHp) * 0.5;
    if (p.combo === 0 || !['hit', 'airHit', 'down', 'cineHit'].includes(p.state)) p.redHp += (p.hp - p.redHp) * 0.08;
    // afterimages
    const fast = p.state === 'dash' || p.state === 'airdash' || p.state === 'cine' ||
      (p.state === 'attack' && (p.move.kind === 'super' || (p.move.vel && p.move.vel.some(v => v[2] >= 10 && p.t >= v[0] && p.t <= v[1]))));
    if (fast && G.frameCount % 3 === 0) p.trail.push({ x: p.x, y: p.y, f: frameOf(p), facing: p.facing, t: 0 });
    for (const tr of p.trail) tr.t++;
    p.trail = p.trail.filter(t => t.t < 12);
  }
}

// ---------------------------------------------------------------- Round flow
function phaseLogic() {
  G.phaseT++;
  const [a, b] = G.p;
  if (G.phase === 'intro') {
    if (G.phaseT === 1) Sfx.play('bell');
    if (G.phaseT === 60) Sfx.play('ready');
    if (G.phaseT === 85) Sfx.play('gate');
    if (G.phaseT >= 100) { G.phase = 'fight'; G.phaseT = 0; a.setState('idle'); b.setState('idle'); }
  } else if (G.phase === 'fight') {
    if (G.mode !== 'training') {
      if (++G.timerSub >= 60) { G.timerSub = 0; G.timer = Math.max(0, G.timer - 1); }
      const koA = a.hp <= 0, koB = b.hp <= 0;
      if (koA || koB || G.timer === 0) {
        G.phase = 'ko'; G.phaseT = 0;
        G.koType = (koA || koB) ? 'ko' : 'time';
        G.roundWinner = koA && koB ? -1 : koA ? 1 : koB ? 0 : (a.hp / a.c.hp > b.hp / b.c.hp ? 0 : a.hp / a.c.hp < b.hp / b.c.hp ? 1 : -1);
        if (G.koType === 'ko') { G.slow = 70; Sfx.play('ko'); Sfx.play('crowd'); }
      }
    }
  } else if (G.phase === 'ko') {
    const w = G.roundWinner;
    const settled = G.p.every(p => !['attack', 'hit', 'airHit', 'block', 'cine', 'cineHit', 'throwing', 'thrown', 'jsquat', 'air', 'land'].includes(p.state));
    if (G.phaseT > 90 && settled && !G.posed) {
      G.posed = true; G.phaseT = 90;
      if (w >= 0) { G.p[w].wins++; G.p[w].setState('win'); if (G.p[1 - w].hp > 0) G.p[1 - w].setState('lose'); }
      else { G.p.forEach(p => { p.wins++; if (p.hp > 0) p.setState('lose'); }); }
    }
    if (G.posed && G.phaseT > 230) {
      G.posed = false;
      if (G.p.some(p => p.wins >= 2)) { G.phase = 'match'; G.phaseT = 0; Sfx.play('fanfare'); }
      else { G.round++; startRound(); }
    }
  }
}
