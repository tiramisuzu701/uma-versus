// ============================================================================
//  CPU  —  runs outside the simulation and only produces inputs.
//  It perceives the opponent with a human-like reaction delay, blocks by
//  reading what it has seen, hit-confirms real combos from the trial lists,
//  punishes unsafe moves, anti-airs, and only uses supers to finish a
//  grounded combo or (sometimes) as a reversal that isn't frame-perfect.
// ============================================================================
'use strict';

const CPU_NAMES = ['', 'ROOKIE', 'NORMAL', 'HARD', 'G1'];
//               react  block  guess  punish  aa    reversal tech  combo  super  aggro
const CPU_LV = [null,
  { react: 24, block: 0.25, guess: 0.35, punish: 0.10, aa: 0.12, rev: 0.02, tech: 0.10, combo: 0, super: 0.0, aggro: 0.35, slop: 8, guard: 0.12, hop: 0.0 },
  { react: 17, block: 0.55, guess: 0.60, punish: 0.40, aa: 0.40, rev: 0.06, tech: 0.30, combo: 1, super: 0.3, aggro: 0.5, slop: 5, guard: 0.35, hop: 0.15 },
  { react: 12, block: 0.78, guess: 0.78, punish: 0.70, aa: 0.65, rev: 0.12, tech: 0.55, combo: 2, super: 0.6, aggro: 0.6, slop: 3, guard: 0.5, hop: 0.3 },
  { react: 8, block: 0.92, guess: 0.88, punish: 0.90, aa: 0.85, rev: 0.18, tech: 0.75, combo: 3, super: 0.85, aggro: 0.65, slop: 1, guard: 0.6, hop: 0.4 },
];
const INVINCIBLE_DP = { spe: true, kb: true, mm: true, suz: true };   // 623 with real invincibility

function aiState(me) {
  return me.ai || (me.ai = { mem: [], seq: [], run: null, plan: 0, walk: 0, crouch: 0, blockKey: '', blocking: false, low: false,
    aaKey: -1, wakeDone: -1, techKey: -1, punishKey: '', lastHitStun: -99, jumpIn: false });
}
// what the CPU "sees": the opponent as they were `react` frames ago
function aiPerceive(ai, o, react) {
  const m = o.state === 'attack' ? o.move : null;
  ai.mem.push({ state: o.state, id: m && m.id, t: o.t, start: o.frame - o.t, airborne: o.airborne, vy: o.vy,
    low: !!(m && m.hits && m.hits.some(h => h.guard === 'low')), high: !!(m && ((m.hits && m.hits.some(h => h.guard === 'high')) || m.air)),
    reach: m && m.hits ? Math.max(...m.hits.map(h => h.box[0] + h.box[2])) : 0, recovering: !!(m && o.t > m.lastActive && !(m.kind === 'super' && m.cine)),
    landRec: o.state === 'land' ? o.landRec - o.t : 0, kind: m && m.kind, thrown: m && m.kind === 'throw' });
  if (ai.mem.length > 40) ai.mem.shift();
  return ai.mem[Math.max(0, ai.mem.length - 1 - react)];
}
// ---------------------------------------------------------------- combo driver (same token rules as the trials demo)
function aiCombosFor(me, lv, o) {
  if (lv.combo === 0) return [];
  const nearWall = o.x < 300 || o.x > STAGE_W - 300;
  return trialsFor(me.cid).filter(t => {
    if (t.seq.startsWith('j.')) return false;
    if (lv.combo === 1 && (t.seq.includes('jc') || t.seq.includes(',') || t.seq.includes('dc') || t.level > 1)) return false;
    if (lv.combo === 2 && t.level > 1) return false;
    if (t.corner && !nearWall) return false;
    return true;
  });
}
const START_RANGE = { '5L': 105, '2L': 105, '5M': 150, '2M': 175, '5H': 120, '2H': 110, 'dL': 260, 'dM': 300 };
function aiStartRun(me, seq, lv) {
  const raw = seq.split(' '), toks = [], links = [];
  for (const t of raw) { if (t === ',') links[toks.length] = true; else toks.push(me.meter < 50 ? t.replace(/^(\d{3,5})H$/, '$1M') : t); }
  me.ai.run = { toks, links, ti: 0, queue: [], restarted: false, pMove: null, pT: 0, confirm: lv.combo >= 2 || rnd() < 0.7, hitOnce: false, age: 0 };
}
function aiRunInput(me, o, lv) {
  const R = me.ai.run, a = me;
  if (!R) return null;
  R.age++;
  if (['hit', 'airHit', 'block', 'thrown', 'down', 'cineHit'].includes(a.state) || R.age > 360) { me.ai.run = null; return null; }
  if (a.state === 'attack' && (a.move !== R.pMove || a.t < R.pT)) R.restarted = true;
  R.pMove = a.state === 'attack' ? a.move : null; R.pT = a.t;
  if (a.state === 'attack' && a.hitOK) R.hitOnce = true;
  // hit-confirm: the first move was blocked, stop here (a blocked string ends safely or not at all)
  if (R.ti > 0 && a.state === 'attack' && a.connected && !a.hitOK && R.confirm && R.ti < R.toks.length) { me.ai.run = null; return null; }
  // the combo dropped
  if (R.hitOnce && o.combo === 0 && !['hit', 'airHit'].includes(o.state) && R.ti < R.toks.length) { me.ai.run = null; return null; }
  const toks = R.toks, ti = R.ti, prev = toks[ti - 1];
  const ready = () => {
    if (R.queue.length) return false;
    if (R.links[ti]) return R.restarted && a.actionable() && a.state !== 'air' && !a.airborne;
    if (ti > 0 && prev !== 'jc' && prev !== 'dc' && (!R.restarted || a.state !== 'attack') && !(prev.startsWith('j.') && toks[ti] && !toks[ti].startsWith('j.'))) return false;
    if (ti === 0) return true;
    const next = toks[ti];
    if (prev === 'jc') return a.state === 'air' && a.t >= (next === 'j.L' ? 3 : 5);
    if (prev === 'dc') return a.state === 'dash' && a.t >= 2;
    if ((prev.startsWith('j.') && toks[ti - 2] === 'jc') || (prev.startsWith('j.') && next.startsWith('j.'))) return a.state === 'attack' && a.connected;
    if (prev.startsWith('j.') && !next.startsWith('j.')) return !a.airborne && ['idle', 'walk', 'crouch', 'land', 'attack'].includes(a.state) && (a.state !== 'attack' || a.connected);
    return a.state === 'attack' && a.connected && a.t >= a.move.first && (!(a.c.specialChain && a.move.kind === 'special') || a.hitDone.filter(Boolean).length >= (a.move.hits || []).length);
  };
  if (ti < toks.length && ready()) { R.queue = tokenInputs(a, toks[ti]); R.restarted = false; R.ti++; }
  // finish a combo with the super (on the ground, or on a low juggle the sprint can still reach)
  if (R.ti >= toks.length && !R.queue.length && a.state === 'attack' && a.connected && a.hitOK && a.meter >= 100 && !a.move.air && !a.airborne &&
      ((o.state === 'hit' && !o.airborne) || (o.state === 'airHit' && o.y > GY - 120 && o.jug < 8))) {
    if (R.superRoll === undefined) R.superRoll = o.hp < 4500 || rnd() < lv.super * 0.5;
    if (R.superRoll && lv.super > 0) { me.ai.run = null; return { ...NEUTRAL, S: 1, H: 1 }; }
  }
  let inp = R.queue.length ? R.queue.shift() : { ...NEUTRAL };
  if (toks[R.ti - 1] === 'jc' && !R.queue.length && a.state !== 'air') inp = { ...NEUTRAL, u: 1, [a.facing === 1 ? 'r' : 'l']: 1 };
  if (toks[R.ti - 1] === 'dc' && !R.queue.length) inp = { ...NEUTRAL, [a.facing === 1 ? 'r' : 'l']: 1 };
  if (R.ti >= toks.length && !R.queue.length && (a.state !== 'attack' || a.t > 30)) me.ai.run = null;
  return inp;
}
function aiTryCombo(me, o, lv, dist, pool) {
  const list = (pool || aiCombosFor(me, lv, o)).filter(t => { const f = t.seq.split(' ')[0]; return (START_RANGE[f] || 120) >= dist; });
  if (!list.length) return false;
  aiStartRun(me, list[Math.floor(rnd() * list.length)].seq, lv); return true;
}

// ---------------------------------------------------------------- main
function cpuInput(me, level) {
  const lv = CPU_LV[Math.max(1, Math.min(4, level || 2))], o = opp(me), out = { ...NEUTRAL }, ai = aiState(me);
  const fwdK = o.x > me.x ? 'r' : 'l', backK = fwdK === 'r' ? 'l' : 'r';
  const dist = Math.abs(o.x - me.x), seen = aiPerceive(ai, o, lv.react);
  const tap = b => { if (!me.inp[b]) out[b] = 1; };
  const apply = s => { for (const k in s) out[k === 'f' ? fwdK : k === 'b' ? backK : k] = s[k]; return out; };
  if (['intro', 'win', 'lose', 'cineHit'].includes(me.state) || G.phase !== 'fight') { ai.run = null; ai.seq = []; return out; }

  // ---- being thrown: tech if we notice in time
  if (me.state === 'thrown') {
    if (ai.techKey !== me.frame - me.t) { ai.techKey = me.frame - me.t; ai.techRoll = rnd() < lv.tech; ai.techAt = 2 + Math.floor(rnd() * Math.max(1, lv.react / 2)); }
    if (ai.techRoll && me.t >= ai.techAt && me.t <= 10) { out.L = out.M = 1; }
    return out;
  }
  // ---- knocked down / hit / juggled: nothing to do but plan the wake-up
  if (['down', 'wake', 'hit', 'airHit'].includes(me.state)) {
    ai.run = null; ai.seq = []; ai.lastHitStun = me.frame;
    ai.stunEnd = me.frame + (me.state === 'hit' ? me.hs : 20);
    if (me.state === 'down' && me.t === 9 && !me.hardKd && rnd() < 0.5) out.L = 1;   // quick rise sometimes
    if (me.state === 'wake' && ai.wakeDone !== me.frame - me.t) {
      ai.wakeDone = me.frame - me.t;
      const pressured = dist < 200 && !o.airborne, r = rnd();
      // reversal, with a few frames of human slop (it can come out late and get stuffed)
      const slop = Array(2 + lv.slop + Math.floor(rnd() * (lv.slop + 4))).fill({});   // never frame-perfect
      if (pressured && r < lv.rev && INVINCIBLE_DP[me.cid]) ai.seq = [...slop, ...tokenInputs(me, '623' + (me.meter >= 50 && rnd() < 0.5 ? 'H' : 'M')).map(x => ({ ...x }))];
      else if (pressured && r < lv.rev * 1.4 && me.meter >= 100) ai.seq = [...slop, { S: 1, H: 1 }];
      else if (pressured && r < lv.rev * 2.5) ai.seq = [...slop, { b: 1 }, {}, { b: 1 }];   // backdash
      else ai.seq = Array(14).fill({ b: 1 });                                               // block on wake-up
    }
    if (me.state !== 'wake') return out;
    return out;
  }
  // ---- blocking: hold the guard we chose; counter spurt out of heavy pressure now and then
  if (me.state === 'block') {
    ai.run = null; ai.stunEnd = me.frame + me.bs;
    if (me.meter >= 50 && me.bs > 4 && rnd() < lv.rev * 0.05) { out.S = out.H = 1; return out; }
    out[backK] = 1; if (ai.low) out.d = 1; return out;
  }
  // ---- scripted macro (wake-up options, dashes, jumps)
  if (ai.seq.length) { const s = ai.seq.shift(); return apply(s); }
  // ---- running a combo / string
  const ri = aiRunInput(me, o, lv);
  if (ri) return ri;
  if (me.state === 'attack') {
    // follow-ups (Golshi Rush) for CPUs without a scripted run
    if (me.move.follow && me.t >= me.move.follow.win[0] + 2 && me.t <= me.move.follow.win[1] && rnd() < 0.2) tap(dist < 110 ? ['H', 'L', 'M'][Math.floor(rnd() * 3)] : ['L', 'M', 'S'][Math.floor(rnd() * 3)]);
    // rookie: mash L on hit (auto-combo)
    if (lv.combo === 0 && me.connected && me.hitOK && rnd() < 0.5) tap('L');
    return out;
  }
  if (me.state === 'air') {
    // jump-in: press a heavy as we come down in range, then confirm into a ground combo on landing
    if (me.vy > 0 && dist < 125 && Math.abs(o.y - me.y) < 200 && !o.airborne && rnd() < 0.6) { tap(rnd() < 0.6 ? 'H' : 'M'); ai.jumpIn = true; }
    else if (me.vy > 0 && o.airborne && dist < 110 && rnd() < 0.3) tap('M');   // air-to-air
    if (me.cid === 'suz' && !me.airS && dist < 240 && me.vy > -3 && rnd() < 0.02 * (level || 2)) tap('S');
    return out;
  }
  // landed after a jump-in that hit: confirm
  if (ai.jumpIn && me.actionable()) { ai.jumpIn = false; if (o.state === 'hit' && lv.combo > 0 && aiTryCombo(me, o, lv, dist)) return aiRunInput(me, o, lv) || out; }

  // ---------------- defense (based on what we have seen)
  const projNear = G.projs.some(q => q.owner === o.side && Math.abs(q.x - me.x) < 260 && Math.sign(q.vx) === Math.sign(me.x - q.x));
  const threat = seen.state === 'attack' && seen.kind !== 'throw' && !seen.recovering && dist < seen.reach + 60;
  if (threat || projNear) {
    const key = threat ? 'a' + seen.start + seen.id : 'p' + (G.frameCount / 45 | 0);
    if (ai.blockKey !== key) {
      ai.blockKey = key; ai.blocking = rnd() < lv.block;
      ai.low = threat ? (seen.low && !seen.high ? rnd() < lv.guess : seen.high ? rnd() > lv.guess : rnd() < 0.35) : rnd() < 0.3;
      // jump over a slow fireball now and then
      if (projNear && !threat && dist > 180 && rnd() < lv.hop) { ai.blocking = false; ai.seq = [{ u: 1, f: 1 }]; }
    }
    if (ai.blocking) { out[backK] = 1; if (ai.low && !o.airborne) out.d = 1; return out; }
  }
  if (ai.sawShot && !projNear && dist > 220 && level >= 2 && rnd() < 0.5) { ai.sawShot = false; ai.seq = [{ f: 1 }, {}, ...Array(12).fill({ f: 1 })]; return out; }
  ai.sawShot = projNear || ai.sawShot && dist > 220;
  // anti-air
  if (seen.airborne && o.state !== 'airHit' && dist < 210 && dist > 30 && o.vy > -5) {
    const key = o.frame - o.t;
    if (ai.aaKey !== key) {
      ai.aaKey = key;
      if (rnd() < lv.aa) {
        if (dist < 140) ai.seq = [{ d: 1, H: 1 }];                                       // 2H anti-air
        else if (me.c.moves['4S']) ai.seq = tokenInputs(me, '623M').map(x => ({ ...x }));
        return out;
      }
    }
  }
  // punish a move we saw whiff or get blocked (recovery) or a long landing
  if ((seen.recovering || seen.landRec > 6) && !o.airborne && o.state !== 'hit') {
    const key = 'p' + seen.start;
    if (ai.punishKey !== key) {
      ai.punishKey = key;
      if (rnd() < lv.punish) {
        if (me.meter >= 100 && dist < (me.c.moves.SU && !me.c.moves.SU.cine ? 750 : 320) && me.frame - (ai.stunEnd || -99) >= 4 + lv.slop * 2 && rnd() < lv.super * 0.35) { out.S = out.H = 1; return out; }   // invincible super as a punish (never straight out of stun)
        if (lv.combo > 0 && aiTryCombo(me, o, lv, dist)) return aiRunInput(me, o, lv) || out;
        if (dist < 160) { tap(dist < 105 ? 'L' : 'M'); return out; }
      }
    }
  }

  // ---------------- archetype habits
  const r = rnd();
  if (me.c.ai === 'zoner') {
    const shots = G.projs.filter(q => q.owner === me.side).length, canShoot = shots < (me.c.projMax || 1);
    const incoming = G.projs.some(q => q.owner === o.side && Math.abs(q.x - me.x) < 150);
    if (incoming && r < lv.block * 0.15) { out[backK] = 1; out.S = 1; return out; }
    if (o.airborne && o.state !== 'airHit' && dist > 110 && dist < 330 && r < lv.aa * 0.1) { out.d = 1; out.S = 1; return out; }
    if (dist > 240 && canShoot && (ai.shotCd = (ai.shotCd || 0) - 1) <= 0 && r < 0.05 + 0.03 * (level || 2)) { ai.shotCd = 50 + Math.floor(rnd() * 50); if (rnd() < 0.65) tap('S'); else { out[fwdK] = 1; out.S = 1; } return out; }
    if (dist < 150 && r < 0.03 * (level || 2)) { ai.seq = [{ b: 1 }, {}, { b: 1 }]; return out; }
    // a projectile super is also a long-range tool: fire it when they commit to a dash or a jump from range
    if (me.meter >= 100 && me.c.moves.SU && !me.c.moves.SU.cine && dist > 260 && dist < 700 && (seen.state === 'dash' || (o.airborne && o.state !== 'airHit' && o.y > GY - 140)) && r < lv.super * 0.08) { out.S = out.H = 1; return out; }
  }
  if (me.cid === 'suz') {
    if (dist > 160 && dist < 300 && r < 0.06 * (level || 2) && skillReady(me, '5S')) { ai.seq = tokenInputs(me, me.meter >= 50 && rnd() < 0.3 ? '236H' : '236L').map(x => ({ ...x })); return out; }   // Great Escape in
    if (dist < 110 && o.state !== 'hit' && r < 0.04 * (level || 2)) { ai.seq = [{ b: 1 }, {}, { b: 1 }]; return out; }   // and away
  }
  if (me.c.ai === 'bait' && dist < 170 && seen.state === 'attack' && !seen.recovering && seen.kind !== 'throw' && r < lv.punish * 0.2 && skillReady(me, '2S')) { ai.seq = [{ d: 1, S: 1 }]; return out; }
  if (me.c.ai === 'vortex' && o.state === 'down' && o.t === 16 && dist < 260) {
    const k = rnd();
    if (k < 0.3) ai.seq = [{ d: 1, S: 1 }];
    else if (k < 0.55) ai.seq = [...Array(10).fill({ f: 1 }), { L: 1, M: 1 }];
    else if (k < 0.75) ai.seq = [...Array(12).fill({ f: 1 }), { d: 1, L: 1 }];
    else ai.seq = [...Array(8).fill({ f: 1 }), { f: 1, S: 1 }];
    return out;
  }

  // ---------------- neutral
  if (--ai.plan > 0) { if (ai.walk) out[ai.walk === 1 ? fwdK : backK] = 1; if (ai.crouch) out.d = 1; return out; }
  ai.plan = 8 + Math.floor(rnd() * (28 - (level || 2) * 4)); ai.walk = 0; ai.crouch = 0;
  // guard up: up close a real player holds back a lot (crouch-blocking by default, so overheads beat it)
  if (dist < 230 && !o.airborne && o.state !== 'hit' && r < lv.guard) { ai.walk = -1; ai.crouch = rnd() < 0.6 ? 1 : 0; ai.plan = 10 + Math.floor(rnd() * 14); out[backK] = 1; if (ai.crouch) out.d = 1; return out; }
  const vsZoner = o.c.ai === 'zoner' && dist > 240;
  if (vsZoner && r < 0.45 + lv.hop) { ai.seq = rnd() < 0.5 ? [{ u: 1, f: 1 }] : [{ f: 1 }, {}, ...Array(16).fill({ f: 1 })]; return out; }
  const fireball = me.c.moves['5S'] && me.c.moves['5S'].proj && !G.projs.some(q => q.owner === me.side);
  const aggro = lv.aggro + (me.c.arch === 'RUSHDOWN' || me.c.arch === 'GLASS CANNON' ? 0.15 : 0) - (me.c.ai === 'zoner' || me.c.ai === 'bait' ? 0.2 : 0);
  if (dist > 420) {
    if (fireball && r < 0.45) tap('S');
    else if (me.c.airDash && r < 0.35) ai.seq = [{ u: 1, f: 1 }, ...Array(10).fill({}), { f: 1 }, {}, { f: 1 }];
    else if (r < 0.35 + aggro * 0.3) ai.seq = [{ f: 1 }, {}, ...Array(14).fill({ f: 1 })];   // dash in
    else ai.walk = 1;
  } else if (dist > 200) {
    if (fireball && r < 0.3) tap('S');
    else if (r < 0.12 * aggro + 0.04) ai.seq = [{ u: 1, f: 1 }];                     // jump in
    else if (r < 0.22 && lv.combo > 0) { ai.seq = [{ f: 1 }, {}, ...Array(8).fill({ f: 1 })]; }   // dash up, then decide
    else if (r < 0.4 && me.c.moves['6S'] && !me.c.moves['6S'].air) ai.seq = [{ f: 1, S: 1 }];
    else if (r < 0.4 + aggro * 0.4) ai.walk = 1;
    else { ai.walk = -1; ai.plan = 12; }
  } else if (dist > 110) {
    if (r < 0.28) { if (lv.combo > 0 && rnd() < 0.5 && aiTryCombo(me, o, lv, dist)) return aiRunInput(me, o, lv) || out; tap('M'); }   // poke
    else if (r < 0.42) ai.seq = [{ d: 1, M: 1 }];
    else if (r < 0.42 + aggro * 0.25) ai.walk = 1;
    else if (r < 0.75) { ai.walk = -1; ai.plan = 10; }
    else { ai.crouch = 1; ai.plan = 14; }
  } else {
    if (r < 0.3 && lv.combo > 0 && aiTryCombo(me, o, lv, dist)) return aiRunInput(me, o, lv) || out;
    if (r < 0.45) tap('L');
    else if (r < 0.58) ai.seq = [{ d: 1, L: 1 }];
    else if (r < 0.58 + 0.1 * (level || 2) / 2 && o.state !== 'air') out.L = out.M = 1;   // throw
    else if (me.cid === 'gs' && r < 0.8) ai.seq = [{ d: 1, S: 1 }];
    else if (r < 0.85) ai.seq = [{ u: 1, b: 1 }];
    else { ai.walk = -1; ai.plan = 10; }
  }
  return out;
}
