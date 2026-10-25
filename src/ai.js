// CPU opponent. Runs outside the sim and only produces inputs: it sees the
// opponent with a reaction delay, guesses when blocking, and confirms combos
// from the trial lists.
'use strict';

const CPU_NAMES = ['', 'ROOKIE', 'NORMAL', 'HARD', 'G1'];
// tech: chance it guesses a throw is coming when you get close (people tech by guessing, not by reacting)
// gc: chance of Counter Spurt when it's pressured (cornered, or blocking a long string); save: keeps 50 Spurt for it
// pick: how it chooses a combo (any = random from what fits, top2 = one of the two best, best = the most damage)
// space: how far off its sense of distance can be (px) · footsie: how often it steps in and out at its range
const CPU_LV = [null,
  { react: 24, block: 0.25, guess: 0.35, punish: 0.10, aa: 0.12, rev: 0.02, tech: 0.05, combo: 0, super: 0.0, aggro: 0.35, slop: 8, guard: 0.12, hop: 0.0, gc: 0, save: false, pick: 'any', space: 60, footsie: 0.2, whiffOK: 0.5 },
  { react: 17, block: 0.55, guess: 0.60, punish: 0.40, aa: 0.40, rev: 0.06, tech: 0.20, combo: 1, super: 0.3, aggro: 0.5, slop: 5, guard: 0.35, hop: 0.15, gc: 0.12, save: false, pick: 'any', space: 30, footsie: 0.4, whiffOK: 0.2 },
  { react: 12, block: 0.78, guess: 0.75, punish: 0.75, aa: 0.65, rev: 0.12, tech: 0.33, combo: 2, super: 0.6, aggro: 0.6, slop: 3, guard: 0.3, hop: 0.3, gc: 0.3, save: true, pick: 'top2', space: 14, footsie: 0.6, whiffOK: 0.05 },
  { react: 8, block: 0.93, guess: 0.88, punish: 0.95, aa: 0.88, rev: 0.2, tech: 0.50, combo: 3, super: 0.9, aggro: 0.7, slop: 1, guard: 0.3, hop: 0.4, gc: 0.45, save: true, pick: 'best', space: 4, footsie: 0.8, whiffOK: 0 },
];
// where each runner wants to stand (px between the two), from her game plan
const PREF = { spe: 150, suz: 185, gs: 85, vo: 95, ds: 330, mm: 185, tt: 110, kb: 150, jp: 70, at: 250, mc: 210, df: 175 };
const exOK = (me, lv) => me.meter >= (lv.save ? 100 : 50);   // Hard and G1 hold 50 Spurt back for Counter Spurt
const INVINCIBLE_DP = { spe: true, kb: true, mm: true, suz: true };   // 623 with real invincibility

function aiState(me) {
  return me.ai || (me.ai = { mem: [], seq: [], run: null, plan: 0, walk: 0, crouch: 0, blockKey: '', blocking: false, low: false,
    aaKey: -1, wakeDone: -1, techKey: -1, punishKey: '', lastHitStun: -99, jumpIn: false, techUntil: -1, techNext: 0, blockRun: 0, blockGap: 0, gcKey: -1 });
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
// how far away each route can start and still connect every hit (measured by tools/combo_ranges.py)
function comboEntry(cid, seq) { return typeof COMBO_RANGE !== 'undefined' && COMBO_RANGE[cid] && COMBO_RANGE[cid][seq]; }
function comboRange(cid, seq, me, lv) {
  const e = comboEntry(cid, seq);
  if (!e) return (START_RANGE[seq.split(' ')[0]] || 120) * 0.7;
  if (typeof e === 'number') return e;
  const r = e.ex && me && lv && exOK(me, lv) ? e.rx : e.r, o = me && opp(me);
  return o && e.rc !== undefined && (o.state === 'crouch' || (o.state === 'block' && o.crouchBlock) || o.inp.d) ? Math.min(r, e.rc) : r;   // some routes only work on someone standing
}
function comboDmg(cid, seq, me, lv) {
  const e = comboEntry(cid, seq); if (!e || typeof e === 'number') return 1000;
  return e.ex && me && lv && exOK(me, lv) ? e.dmgx : e.dmg;
}
// startup of a route's first move, for punishes
function starterFirst(me, seq) { const id = tokenMove(me.c, seq.split(' ')[0]), m = id && me.c.moves[id]; return m ? (m.first || 6) : 8; }
function aiCombosFor(me, lv, o) {
  if (lv.combo === 0) return [];
  const nearWall = o.x < 300 || o.x > STAGE_W - 300;
  return trialsFor(me.cid).filter(t => {
    if (t.seq.startsWith('j.')) return false;
    if (lv.combo === 1 && (t.seq.includes('jc') || t.seq.includes(',') || t.seq.includes('dc') || t.level > 1)) return false;
    if (lv.combo === 2 && t.level > 1 && t.seq.includes(',')) return false;   // Hard skips the link routes
    if (t.corner && !nearWall) return false;
    if (t.seq.includes('dc') && me.meter < 10 * t.seq.split(' dc').length) return false;   // dash cancels cost 10 Spurt each
    return comboRange(me.cid, t.seq, me, lv) > 0;
  });
}
// choose from routes that fit: G1 always the most damage, Hard one of the two best, lower levels anything
function aiPickCombo(me, lv, list) {
  if (!list.length) return null;
  const by = [...list].sort((a, b) => comboDmg(me.cid, b.seq, me, lv) - comboDmg(me.cid, a.seq, me, lv));
  if (lv.pick === 'best') return by[0];
  if (lv.pick === 'top2') return by[Math.floor(rnd() * Math.min(2, by.length))];
  return list[Math.floor(rnd() * list.length)];
}
const START_RANGE = { '5L': 105, '2L': 105, '5M': 150, '2M': 175, '5H': 120, '2H': 110, 'dL': 260, 'dM': 300 };
function aiStartRun(me, seq, lv) {
  const raw = seq.split(' '), toks = [], links = [];
  for (const t of raw) { if (t === ',') links[toks.length] = true; else toks.push(!exOK(me, lv) ? t.replace(/^(\d{3,5})H$/, '$1M') : t); }
  me.ai.run = { toks, links, ti: 0, queue: [], restarted: false, pMove: null, pT: 0, confirm: lv.combo >= 2 || rnd() < 0.7, hitOnce: false, age: 0, idle: 0 };
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
  // the route is dead if we're standing around with nothing queued (the opener whiffed, or knocked them down):
  // give up instead of waiting on it, which used to leave the CPU frozen for seconds
  if (a.actionable() && a.state !== 'air' && !R.queue.length && ti > 0 && prev !== 'jc' && prev !== 'dc') {
    if (++R.idle > (R.links[ti] ? 14 : 3)) { me.ai.run = null; return null; }
  } else R.idle = 0;
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
  const SU = a.c.moves.SU, grabSU = SU && SU.grab;
  if (R.ti >= toks.length && !R.queue.length && a.state === 'attack' && a.connected && a.hitOK && a.meter >= 100 && !a.move.air && !a.airborne &&
      (grabSU ? o.state === 'hit' && !o.airborne && Math.abs(o.x - a.x) < (SU.range || 110) - 10   // a grab super only catches someone on the ground
              : (o.state === 'hit' && !o.airborne) || (o.state === 'airHit' && o.y > GY - 120 && o.jug < 8))) {
    if (R.superRoll === undefined) R.superRoll = o.hp < 4500 || rnd() < lv.super * (lv.pick === 'best' ? 1 : 0.5);
    if (R.superRoll && lv.super > 0) { me.ai.run = null; return { ...NEUTRAL, S: 1, H: 1 }; }
  }
  let inp = R.queue.length ? R.queue.shift() : { ...NEUTRAL };
  if (toks[R.ti - 1] === 'jc' && !R.queue.length && a.state !== 'air') inp = { ...NEUTRAL, u: 1, [a.facing === 1 ? 'r' : 'l']: 1 };
  if (toks[R.ti - 1] === 'dc' && !R.queue.length) inp = { ...NEUTRAL, [a.facing === 1 ? 'r' : 'l']: 1 };
  if (R.ti >= toks.length && !R.queue.length && (a.state !== 'attack' || a.t > 30)) me.ai.run = null;
  return inp;
}
function aiTryCombo(me, o, lv, dist, pool, maxStartup) {
  // where they'll be when the first hit comes out (they may be walking away or in), plus a small safety margin;
  // lower levels misjudge the distance a little instead
  const away = Math.sign(o.x - me.x) * (o.vx || 0);
  const at = seq => dist + Math.max(0, away) * starterFirst(me, seq) + (lv.pick === 'best' ? 12 : lv.pick === 'top2' ? 8 : 0) + (rnd() - 0.5) * lv.space;
  const list = (pool || aiCombosFor(me, lv, o)).filter(t => comboRange(me.cid, t.seq, me, lv) >= at(t.seq) && (maxStartup === undefined || starterFirst(me, t.seq) <= maxStartup));
  const t = aiPickCombo(me, lv, list);
  if (!t) return false;
  aiStartRun(me, t.seq, lv); return true;
}
// reach of a single move (hitbox front edge, or grab range), for "can this even hit from here"
// a skill's motion as inputs: Hard and G1 type it one frame per direction, like a practised player
function aiMotion(me, tok, lv) {
  const seq = tokenInputs(me, tok).map(x => ({ ...x }));
  if (!lv || lv.combo < 2) return seq;
  return seq.filter((x, i) => i === seq.length - 1 || i % 2 === 1);
}
function moveReach(me, id) {
  const m = me.c.moves[id]; if (!m) return 0;
  if (m.grab) return (m.range || 90) + (m.vel ? m.vel.reduce((s, v) => s + (v[1] - v[0]) * v[2], 0) * 0.8 : 0);
  if (m.proj || m.ev) return 900;
  let r = m.hits ? Math.max(...m.hits.map(h => h.box[0] + h.box[2])) : 0;
  if (m.vel) r += m.vel.reduce((s, v) => s + Math.max(0, (Math.min(v[1], m.lastActive || v[1]) - v[0])) * v[2], 0);
  return r;
}

// ---------------------------------------------------------------- main
function cpuInput(me, level) {
  const lv = CPU_LV[Math.max(1, Math.min(4, level || 2))], o = opp(me), out = { ...NEUTRAL }, ai = aiState(me);
  const fwdK = o.x > me.x ? 'r' : 'l', backK = fwdK === 'r' ? 'l' : 'r';
  const dist = Math.abs(o.x - me.x), seen = aiPerceive(ai, o, lv.react);
  const tap = b => { if (!me.inp[b]) out[b] = 1; };
  const apply = s => { for (const k in s) out[k === 'f' ? fwdK : k === 'b' ? backK : k] = s[k]; return out; };
  if (['intro', 'win', 'lose', 'cineHit'].includes(me.state) || G.phase !== 'fight') { ai.run = null; ai.seq = []; return out; }

  // ---- being thrown: tech only if we'd already guessed a throw was coming (see "throw guess" below)
  if (me.state === 'thrown') {
    if (ai.techKey !== me.frame - me.t) { ai.techKey = me.frame - me.t; ai.techRoll = me.frame <= ai.techUntil; ai.techAt = 1 + Math.floor(rnd() * 4); }
    if (ai.techRoll && me.t >= ai.techAt && me.t <= 10) {
      if (!G.p[1 - me.side].noTech) out.L = out.M = 1;
      else if (me.meter >= 50 && lv.tech > 0.1) out.S = out.H = 1;   // a command grab: only Counter Spurt gets out
    }
    return out;
  }
  // throw guess: while they're close, decide every 45 frames whether we expect a throw (and right away when
  // they walk in or a blockstring ends)
  if (dist > 160) ai.techNext = 0;
  else if (dist < 125 && !o.airborne && me.frame >= (ai.techNext || 0)) { ai.techNext = me.frame + 45; ai.techUntil = rnd() < lv.tech ? me.frame + 45 : -1; }
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
      if (pressured && r < lv.rev && INVINCIBLE_DP[me.cid]) ai.seq = [...slop, ...tokenInputs(me, '623' + (exOK(me, lv) && rnd() < 0.5 ? 'H' : 'M')).map(x => ({ ...x }))];
      else if (pressured && r < lv.rev * 1.4 && me.meter >= 100 && (!me.c.moves.SU.grab || dist < 110)) ai.seq = [...slop, { S: 1, H: 1 }];
      else if (pressured && r < lv.rev * 2.5) ai.seq = [...slop, { b: 1 }, {}, { b: 1 }];   // backdash
      else ai.seq = Array(14).fill({ b: 1 });                                               // block on wake-up
    }
    if (me.state !== 'wake') return out;
    return out;
  }
  // ---- blocking: hold the guard we chose. Counter Spurt when actually pressured: cornered, or a long string
  if (me.state === 'block') {
    ai.run = null; ai.stunEnd = me.frame + me.bs;
    const key = me.frame - me.t;
    if (ai.gcKey !== key) {   // a new blocked hit
      ai.gcKey = key; ai.blockRun++; ai.blockGap = 0;
      const cornered = me.x < 220 || me.x > STAGE_W - 220, pressured = cornered ? ai.blockRun >= 2 : ai.blockRun >= 4;
      ai.gcAt = pressured && me.meter >= 50 && rnd() < lv.gc ? 2 + Math.floor(rnd() * 4) : -1;
    }
    if (ai.gcAt >= 0 && me.t >= ai.gcAt && me.meter >= 50) { ai.gcAt = -1; out.S = out.H = 1; return out; }
    out[backK] = 1; if (ai.low) out.d = 1; return out;
  }
  if (++ai.blockGap > 20) ai.blockRun = 0;
  if (ai.blockGap === 3 && ai.blockRun) ai.techNext = 0;   // blockstring over: a throw could be next
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

  if (o.state === 'block') ai.oBlockT = me.frame; ai.oBlocked = me.frame - (ai.oBlockT || -99) < 20;
  // ---------------- defense (based on what we have seen)
  const projNear = G.projs.some(q => q.owner === o.side && !q.trap && Math.abs(q.x - me.x) < 260 && Math.sign(q.vx) === Math.sign(me.x - q.x));
  // Cafe's Friend attacking nearby counts as an attack to block (it's low or high depending on the move)
  const pm = o.c.puppet && o.pupState === 'act' && pupMoveOf(o), pupThreat = !!pm && Math.abs(o.pupX - me.x) < 230;
  const trapNear = G.projs.some(q => q.owner === o.side && q.trap && q.phase === 'set' && q.cool <= 4 && Math.abs(q.x - me.x) < 75);
  const threat = (seen.state === 'attack' && seen.kind !== 'throw' && !seen.recovering && dist < seen.reach + 60);
  if (threat || projNear || pupThreat || trapNear) {
    const key = threat ? 'a' + seen.start + seen.id : pupThreat ? 'u' + o.pupMove + (o.frame - o.pupT) : trapNear ? 't' + (G.frameCount / 30 | 0) : 'p' + (G.frameCount / 45 | 0);
    if (ai.blockKey !== key) {
      ai.blockKey = key; ai.blocking = rnd() < lv.block;
      const pLow = pupThreat && pm.hits && pm.hits.some(h => h.guard === 'low'), pHigh = pupThreat && pm.hits && pm.hits.some(h => h.guard === 'high');
      ai.low = threat ? (seen.low && !seen.high ? rnd() < lv.guess : seen.high ? rnd() > lv.guess : rnd() < 0.35)
        : pupThreat ? (pLow ? rnd() < lv.guess : pHigh ? rnd() > lv.guess : rnd() < 0.3) : rnd() < 0.3;
      // jump over a slow fireball now and then
      if (projNear && !threat && dist > 180 && rnd() < lv.hop) { ai.blocking = false; ai.seq = [{ u: 1, f: 1 }]; }
    }
    if (ai.blocking) { out[backK] = 1; if (ai.low && !o.airborne) out.d = 1; return out; }
  }
  if (ai.sawShot && !projNear && dist > 220 && level >= 2 && rnd() < 0.5) { ai.sawShot = false; ai.seq = [{ f: 1 }, {}, ...Array(12).fill({ f: 1 })]; return out; }
  ai.sawShot = projNear || ai.sawShot && dist > 220;
  // anti-air
  // (only on someone really in the air now, jumping or attacking from a jump: never on someone knocked down)
  if (seen.airborne && o.airborne && ['air', 'airdash', 'attack'].includes(o.state) && dist < 210 && dist > 30 && o.vy > -5) {
    const key = o.frame - o.t, aa = me.c.moves['4S'];
    if (ai.aaKey !== key) {
      ai.aaKey = key;
      if (rnd() < lv.aa) {
        if (dist < 140) ai.seq = [{ d: 1, H: 1 }];                                       // 2H anti-air
        else if (aa && !aa.pup && skillReady(me, '4S') && (!aa.grabAir || dist < (aa.range || 112))) ai.seq = aiMotion(me, '623M', lv);
        return out;
      }
    }
  }
  // punish a move we saw whiff or get blocked (recovery) or a long landing: the biggest combo whose first hit
  // is fast enough for the gap and reaches from here (frame data, not a guess)
  if ((seen.recovering || seen.landRec > 6) && !o.airborne && o.state !== 'hit') {
    const key = 'p' + seen.start;
    if (ai.punishKey !== key) {
      ai.punishKey = key;
      const rem = o.state === 'attack' ? (o.move.total || 30) - o.t : o.state === 'land' ? Math.max(0, o.landRec - o.t) : 0;
      if (rem > 1 && rnd() < lv.punish) {
        const SU = me.c.moves.SU;
        if (me.meter >= 100 && SU && me.frame - (ai.stunEnd || -99) >= 4 + lv.slop * 2 && (SU.first || 10) <= rem + 2 &&
            dist < (SU.grab ? (SU.range || 110) - 6 : !SU.cine ? 750 : 320) && (o.hp < 3200 || rnd() < lv.super * 0.35)) { out.S = out.H = 1; return out; }
        if (lv.combo > 0 && aiTryCombo(me, o, lv, dist, null, rem + 1)) return aiRunInput(me, o, lv) || out;
        // no combo reaches: the hardest-hitting single move that gets there in time (long pokes, running grabs, dashes)
        const opts = [];
        for (const tk of ['5L', '2L', '5M', '2M', '5H', '2H', 'dL', 'dM']) { const id = tk, m = me.c.moves[id]; if (m && (m.first || 6) + (tk[0] === 'd' ? 6 : 0) <= rem && moveReach(me, id) >= dist) opts.push({ tk, dmg: (m.hits || []).reduce((a, h) => a + h.dmg, 0) }); }
        for (const b of ['5S', '6S', '2S', '4S']) {
          const m = me.c.moves[b]; if (!m || !m.motion || m.air || m.grabAir || m.pup || !skillReady(me, b)) continue;
          if ((m.first || m.grab && m.grab[0] || 10) <= rem && moveReach(me, b) >= dist) opts.push({ tk: m.motion + 'M', dmg: m.throwDmg || (m.hits || []).reduce((a, h) => a + h.dmg, 0) || 600 });
        }
        if (opts.length) { opts.sort((a, b) => b.dmg - a.dmg); const pick = lv.pick === 'any' ? opts[Math.floor(rnd() * opts.length)] : opts[0]; ai.seq = tokenInputs(me, pick.tk).map(x => ({ ...x })); return out; }
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
    if (dist > 160 && dist < 300 && r < 0.06 * (level || 2) && skillReady(me, '5S')) { ai.seq = tokenInputs(me, exOK(me, lv) && rnd() < 0.3 ? '236H' : '236L').map(x => ({ ...x })); return out; }   // Great Escape in
    if (dist < 110 && o.state !== 'hit' && r < 0.04 * (level || 2)) { ai.seq = [{ b: 1 }, {}, { b: 1 }]; return out; }   // and away
  }
  if (me.c.ai === 'bait' && dist < 170 && seen.state === 'attack' && !seen.recovering && seen.kind !== 'throw' && r < lv.punish * 0.2 && skillReady(me, '2S')) { ai.seq = [{ d: 1, S: 1 }]; return out; }
  const motion = tok => { ai.seq = aiMotion(me, tok, lv); return out; };
  const L = level || 2;
  // grappler: walk them down, grab when they stand still or block, catch jumps, armor through pokes
  if (me.c.ai === 'grapple') {
    const pb = me.c.moves['6S'], wc = me.c.moves['4S'], grounded = !o.airborne && !['hit', 'airHit', 'down', 'wake', 'thrown', 'cineHit', 'block'].includes(o.state);
    const oActive = seen.state === 'attack' && !seen.recovering && seen.kind !== 'throw';
    if (wc && o.airborne && o.state !== 'airHit' && dist < (wc.range || 112) + 30 && me.y - o.y < (wc.grabH || 230) - 30 && o.vy > -3 && r < lv.aa * 0.6 && skillReady(me, '4S'))
      return motion('623' + (exOK(me, lv) && rnd() < 0.3 ? 'H' : 'M'));
    if (pb && grounded && !oActive && skillReady(me, '6S')) {
      const rL = (pb.v && pb.v.L && pb.v.L.range) || 84, rM = pb.range || 100, rX = 124, ex = exOK(me, lv) && rnd() < 0.35;
      const away = Math.max(0, Math.sign(o.x - me.x) * (o.vx || 0)), lead = (lv.combo >= 2 ? 6 : 11) + 5;   // motion + startup
      const reach = ex ? rX : rM, est = dist + away * lead + (rnd() - 0.5) * lv.space;
      if (est <= reach - 6 && r < 0.05 * L + (ai.oBlocked ? 0.15 : 0)) return motion('41236' + (ex ? 'H' : est <= rL - 6 && rnd() < 0.5 ? 'L' : 'M'));
    }
    if (oActive && dist > 120 && dist < moveReach(me, '2S') + 30 && r < lv.punish * 0.06 && skillReady(me, '2S')) return motion('214M');   // armor through their poke
    if (grounded && !oActive && dist > 150 && dist < moveReach(me, '5S') - 20 && r < 0.008 * L && skillReady(me, '5S')) return motion('236M');   // the running grab, now and then
  }
  // set-play: keep potions on the floor between you and them, then set them off when they're on top of one
  if (me.c.ai === 'setplay') {
    const traps = G.projs.filter(q => q.owner === me.side && q.trap), mine = traps.length;
    if (traps.some(q => q.phase === 'set' && q.cool <= 0 && Math.abs(q.x - o.x) < 70) && r < 0.1 * L && skillReady(me, '6S')) return motion('41236M');
    if (mine < 3 && dist > 220 && r < 0.035 * L && skillReady(me, '5S')) return motion(dist > 330 ? '236M' : '236L');
    if (mine < 3 && (o.state === 'down' || o.state === 'airHit') && dist < 260 && r < 0.3 && skillReady(me, '2S')) return motion(dist < 140 ? '214L' : '214M');
    if (dist < 130 && r < 0.025 * L) { ai.seq = [{ b: 1 }, {}, { b: 1 }]; return out; }
  }
  // puppet: send the Friend in from range, mix the overhead drop with lows up close
  if (me.c.ai === 'puppet' && me.pupState === 'idle') {
    if (o.airborne && o.state !== 'airHit' && dist < 200 && r < lv.aa * 0.4 && skillReady(me, '4S')) return motion('623M');
    if (dist > 160 && dist < 340 && r < 0.035 * L && skillReady(me, '5S')) return motion(dist > 250 ? '236M' : '236L');
    if (dist < 170 && !o.airborne && r < 0.03 * L) { const k = rnd(); if (k < 0.5 && skillReady(me, '6S')) return motion('41236M'); if (skillReady(me, '2S')) return motion(dist < 110 ? '214L' : '214M'); }
  }
  // footsies: dance at the edge of the poke, poke the tip, whiff-punish with it and confirm the follow-up
  if (me.c.ai === 'footsies') {
    if (seen.state === 'attack' && seen.recovering && dist > 120 && dist < 240 && r < lv.punish && skillReady(me, '5S')) { ai.seq = [...tokenInputs(me, '236M').map(x => ({ ...x })), ...Array(10).fill({}), { S: 1 }]; return out; }
    if (dist > 170 && dist < 215 && r < 0.03 * L && skillReady(me, '5S')) { ai.seq = [...tokenInputs(me, '236M').map(x => ({ ...x })), ...Array(10).fill({}), { S: 1 }]; return out; }
    if (dist > 150 && dist < 280 && r < 0.02 * L && skillReady(me, '2S')) return motion('214M');
    if (dist > 140 && dist < 240 && r < 0.5) { ai.walk = rnd() < 0.5 ? 1 : -1; ai.plan = 6 + Math.floor(rnd() * 8); }   // in and out
  }
  if (me.c.ai === 'vortex' && o.state === 'down' && o.t === 16 && dist < 260) {
    const k = rnd();
    if (k < 0.3) ai.seq = [{ d: 1, S: 1 }];
    else if (k < 0.55) ai.seq = [...Array(10).fill({ f: 1 }), { L: 1, M: 1 }];
    else if (k < 0.75) ai.seq = [...Array(12).fill({ f: 1 }), { d: 1, L: 1 }];
    else ai.seq = [...Array(8).fill({ f: 1 }), { f: 1, S: 1 }];
    return out;
  }

  // ---------------- neutral: get to this runner's distance, then only attack with things that reach
  // don't walk onto an armed trap: break it with a low poke, or jump it, rather than walking in
  const trapAhead = G.projs.some(q => q.owner === o.side && q.trap && q.phase === 'set' && Math.sign(q.x - me.x) === Math.sign(o.x - me.x) && Math.abs(q.x - me.x) < 130);
  if (trapAhead) {
    const k = rnd();
    if (k < 0.08 * L) { ai.seq = [{ d: 1, M: 1 }]; return out; }
    if (k < 0.1 * L) { ai.seq = [{ u: 1, f: 1 }]; return out; }
    if (ai.walk === 1) ai.walk = 0;
  }
  if (--ai.plan > 0) { if (ai.walk) out[ai.walk === 1 ? fwdK : backK] = 1; if (ai.crouch) out.d = 1; return out; }
  ai.plan = 6 + Math.floor(rnd() * (26 - L * 4)); ai.walk = 0; ai.crouch = 0;
  const pref = (PREF[me.cid] || 150) + (rnd() - 0.5) * lv.space * 2, cornered = me.x < 160 || me.x > STAGE_W - 160;
  const keepAway = ['zoner', 'setplay', 'puppet', 'bait', 'footsies'].includes(me.c.ai) || me.cid === 'suz';
  const reachOK = id => moveReach(me, id) >= dist - (rnd() < lv.whiffOK ? 60 : 0);   // low levels sometimes swing from too far
  const oActive = seen.state === 'attack' && !seen.recovering;
  // guard up when they're close and it's their turn (grapplers and rushdown hold back less)
  const guard = lv.guard * (dist < 170 ? 1 : 0.25) * (me.c.ai === 'grapple' || me.c.arch === 'RUSHDOWN' ? 0.5 : 1) * (ai.oBlocked ? 0.3 : 1);
  if (dist < 230 && !o.airborne && o.state !== 'hit' && r < guard) { ai.walk = -1; ai.crouch = rnd() < 0.6 ? 1 : 0; ai.plan = 8 + Math.floor(rnd() * 10); out[backK] = 1; if (ai.crouch) out.d = 1; return out; }
  const vsZoner = o.c.ai === 'zoner' && dist > 240;
  if (vsZoner && r < 0.35 + lv.hop) { ai.seq = rnd() < 0.5 ? [{ u: 1, f: 1 }] : [{ f: 1 }, {}, ...Array(16).fill({ f: 1 })]; return out; }
  const fireball = me.c.moves['5S'] && me.c.moves['5S'].proj && !G.projs.some(q => q.owner === me.side);
  const aggro = lv.aggro + (me.c.arch === 'RUSHDOWN' || me.c.arch === 'GLASS CANNON' || me.c.ai === 'grapple' ? 0.15 : 0) - (keepAway ? 0.2 : 0);
  if (dist <= 115) {
    // our range up close: strings that confirm into a combo, throws, the odd low or overhead
    const k = rnd();
    if (keepAway && dist < pref - 60 && !cornered && k < 0.35) { ai.seq = rnd() < 0.5 ? [{ b: 1 }, {}, { b: 1 }] : Array(10).fill({ b: 1 }); return out; }
    if (k < 0.42 && lv.combo > 0 && aiTryCombo(me, o, lv, dist)) return aiRunInput(me, o, lv) || out;
    if (k < 0.55 && reachOK('5L')) { tap('L'); return out; }
    if (k < 0.55 + 0.05 * L && o.state !== 'block' && !o.airborne && dist < 95) { out.L = out.M = 1; return out; }   // throw
    if (k < 0.72 && reachOK('2L')) { ai.seq = [{ d: 1, L: 1 }]; return out; }
    if (k < 0.8 && me.c.moves['6M'] && L >= 2) { ai.seq = [{ f: 1, M: 1 }]; return out; }   // hop overhead
    if (me.cid === 'gs' && k < 0.88) { ai.seq = [{ d: 1, S: 1 }]; return out; }
    ai.walk = keepAway ? -1 : 1; ai.plan = 8; return out;
  }
  if (dist <= pref + 40) {
    // at our range: poke with something that reaches (confirming into a combo on hit), or step in and out
    const k = rnd();
    if (k < 0.2 + 0.06 * L && !oActive) {
      if (lv.combo > 0 && aiTryCombo(me, o, lv, dist)) return aiRunInput(me, o, lv) || out;
      if (reachOK('2M') && rnd() < 0.5) { ai.seq = [{ d: 1, M: 1 }]; return out; }
      if (reachOK('5M')) { tap('M'); return out; }
    }
    if (keepAway && dist < pref - 40 && !cornered) { ai.walk = -1; ai.plan = 10; return out; }
    if (fireball && dist > 200 && k < 0.45) { tap('S'); return out; }
    if (k < 0.3 + lv.footsie * 0.4) { ai.walk = rnd() < 0.5 + (keepAway ? -0.1 : 0.15) ? 1 : -1; ai.plan = 5 + Math.floor(rnd() * 8); return out; }   // in and out at the edge
    if (k < 0.92 - 0.06 * L) { ai.crouch = 1; ai.plan = 8 + Math.floor(rnd() * 8); return out; }   // wait in crouch-guard
    ai.walk = 1; return out;
  }
  // too far: close the gap the way this runner does it
  if (dist > 420) {
    if (fireball && r < 0.45) tap('S');
    else if (me.c.airDash && r < 0.35) ai.seq = [{ u: 1, f: 1 }, ...Array(10).fill({}), { f: 1 }, {}, { f: 1 }];
    else if (!keepAway && r < 0.35 + aggro * 0.3) ai.seq = [{ f: 1 }, {}, ...Array(14).fill({ f: 1 })];   // dash in
    else ai.walk = 1;
    return out;
  }
  if (fireball && r < 0.3) { tap('S'); return out; }
  if (dist < 270 && r < (0.1 * aggro + 0.03) * (L >= 4 ? 0.6 : 1)) { ai.seq = [{ u: 1, f: 1 }]; return out; }   // jump in (G1 jumps less: it gets anti-aired)
  if (!keepAway && dist > pref + 120 && r < 0.25 + aggro * 0.2) { ai.seq = [{ f: 1 }, {}, ...Array(8).fill({ f: 1 })]; return out; }   // dash up, then decide
  ai.walk = 1;
  return out;
}
