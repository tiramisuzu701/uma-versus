// Character data. Frames are at 60 fps. Boxes are [forward, up, width, height]
// in pixels from the fighter's feet (negative up = above the ground).
// seq: [spriteFrame, duration, animId?]
// hits: f:[first, last], dmg, hs (hitstun), bs (blockstun), guard 'mid'|'low'|'high',
//       launch:[vx, vy], kd (knockdown)
'use strict';

const H = o => Object.assign({ dmg: 500, hs: 16, bs: 10, push: 6, lvl: 1, guard: 'mid' }, o);

// Shared normals; each character overrides what differs.
function baseNormals(o) {
  return {
    '5L': { kind: 'normal', str: 1, anim: '820', seq: [[0, 4], [1, 11]],
      hits: [H({ f: [5, 7], box: [25, -102, 72, 30], dmg: 300, hs: 13, bs: 9, lvl: 0, push: 5 })] },
    '5M': { kind: 'normal', str: 2, anim: '870', seq: [[0, 7], [1, 14]], vel: [[3, 8, 4]],
      hits: [H({ f: [8, 11], box: [30, -100, 90, 32], dmg: 650, hs: 17, bs: 10, lvl: 1 })] },
    '5H': { kind: 'normal', str: 3, anim: '930', seq: [[0, 5], [1, 4], [2, 4], [3, 5], [4, 5], [5, 16]], vel: [[6, 12, 3]], jc: true,
      hits: [H({ f: [10, 13], box: [30, -105, 80, 34], dmg: 700, hs: 18, bs: 12, lvl: 2, push: 2 }),
             H({ f: [19, 22], box: [0, -185, 85, 140], dmg: 500, hs: 22, bs: 12, lvl: 2, launch: [2, -12.5] })] },
    '2L': { kind: 'normal', str: 1, crouch: true, anim: '821', seq: [[0, 3], [1, 10]],
      hits: [H({ f: [4, 6], box: [25, -62, 72, 26], dmg: 260, hs: 12, bs: 8, lvl: 0, guard: 'low', push: 5 })] },
    '2M': { kind: 'normal', str: 2, crouch: true, anim: '300', seq: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [7, 5]],
      vel: [[4, 13, 7]], hurt: [-35, -60, 95, 60],
      hits: [H({ f: [7, 14], box: [10, -55, 88, 45], dmg: 600, hs: 18, bs: 12, lvl: 1, guard: 'low', push: 4 })] },
    '2H': { kind: 'normal', str: 3, anim: '880', seq: [[0, 4, '840'], [1, 4, '840'], [0, 6], [1, 18]], aaInv: [6, 16], jc: true,
      hits: [H({ f: [9, 14], box: [5, -205, 70, 190], dmg: 950, hs: 20, bs: 14, lvl: 2, launch: [2, -13] })] },
    'jL': { kind: 'normal', str: 1, air: true, anim: '860', seq: [[0, 4], [0, 14]],
      hits: [H({ f: [4, 10], box: [10, -80, 58, 48], dmg: 300, hs: 12, bs: 8, lvl: 0, guard: 'high' })] },
    'jM': { kind: 'normal', str: 2, air: true, anim: '850', seq: [[0, 4], [1, 8], [1, 10]],
      hits: [H({ f: [5, 11], box: [25, -112, 72, 64], dmg: 600, hs: 15, bs: 10, lvl: 1, guard: 'high' })] },
    'jH': { kind: 'normal', str: 3, air: true, anim: '850', seq: [[0, 5], [2, 4], [3, 9], [3, 12]],
      hits: [H({ f: [10, 17], box: [0, -80, 88, 78], dmg: 900, hs: 18, bs: 12, lvl: 2, guard: 'high', spike: true })] },
    'throw': { kind: 'throw', anim: '820', seq: [[0, 3], [1, 22]], grab: [3, 5], range: 92 },
    // Hop overhead: must be blocked standing, low attacks beat it (you're airborne).
    '6M': { kind: 'normal', str: 2, air: true, noChain: true, anim: '850', seq: [[0, 6], [1, 8], [2, 6], [3, 12]],
      vel: [[1, 1, 2.5, -8]], landRec: 8,
      hits: [H({ f: [14, 21], box: [20, -110, 78, 72], dmg: 600, hs: 17, bs: 10, lvl: 1, guard: 'high' })] },
    // Dash attacks: press L/M/H while dashing, or input 66 + L/M/H.
    'dL': { kind: 'normal', str: 1, name: 'Dash Jab', seq: [[0, 3, '900'], [1, 2, '900'], [0, 4, '820'], [1, 12, '820']], vel: [[1, 8, 8]],
      hits: [H({ f: [6, 9], box: [20, -104, 80, 32], dmg: 400, hs: 15, bs: 10, lvl: 1, push: 6 })] },
    'dM': { kind: 'normal', str: 2, name: 'Running Lunge', seq: [[2, 3, '900'], [3, 3, '900'], [0, 5, '870'], [1, 17, '870']], vel: [[1, 10, 9]],
      hits: [H({ f: [8, 12], box: [25, -102, 100, 36], dmg: 750, hs: 19, bs: 12, lvl: 2, push: 8 })] },
    'dH': { kind: 'normal', str: 3, name: 'Flying Kick', air: true, noChain: true, seq: [[0, 6, '160'], [3, 40, '163']], vel: [[1, 1, 8, -9]], landRec: 12,
      hits: [H({ f: [10, 40], box: [10, -95, 82, 72], dmg: 1050, hs: 22, bs: 14, lvl: 3, guard: 'high', kd: true, launch: [4, -6] })] },
    // Guard cancel: S+H while blocking, costs 50 Spurt. Invincible push-away.
    'GC': { kind: 'gc', anim: '330', seq: [[0, 4], [1, 4], [2, 6], [0, 18, '800']], inv: [1, 16],
      hits: [H({ f: [7, 12], box: [-10, -150, 115, 150], dmg: 300, hs: 20, bs: 16, lvl: 2, kd: true, launch: [9, -6], push: 10 })] },
    ...o,
  };
}

// Spurt Tornado builder: `spins` hits travelling at `speed`. The hurtbox is
// raised while spinning, so low attacks pass underneath.
function tornado(spins, speed, dmg) {
  const seq = [[0, 4, '850'], [1, 3, '850']], hits = [];
  let f = 7;
  for (let i = 0; i < spins; i++) {
    seq.push([2, 4, '850'], [3, 4, '850']);
    hits.push(H({ f: [f + 2, f + 4], box: [5, -140, 85, 80], dmg, hs: 18, bs: 10, lvl: 1, push: 2, chip: 0.1 }));
    f += 8;
  }
  seq.push([1, 12, '850']);
  Object.assign(hits[hits.length - 1], { kd: true, launch: [4, -8], lvl: 2 });
  return { seq, hits, vel: [[5, f, speed]], hurtFrom: 5, hurtTo: f, hurt: [-26, -155, 52, 95] };
}

// Gold Ship helpers ---------------------------------------------------------
// Barrage: `n` quick jabs then a shove. finalBs controls how plus it is on block.
function barrage(n, mul, finalBs) {
  const seq = [], hits = []; let f = 0;
  for (let i = 0; i < n; i++) {
    const a = i % 2 ? '920' : '820';
    seq.push([0, 3, a], [1, 3, a]);
    hits.push(H({ f: [f + 4, f + 5], box: [20, -108, 82, 40], dmg: Math.round(180 * mul), hs: 16, bs: 12, lvl: 1, push: 1 }));
    f += 6;
  }
  seq.push([3, 4, '930'], [4, 9, '930']);
  hits.push(H({ f: [f + 4, f + 7], box: [15, -150, 90, 100], dmg: Math.round(420 * mul), hs: 22, bs: finalBs, lvl: 2, push: 7, kd: true, launch: [6, -6] }));
  return { seq, hits };
}
// Dropkick arc. Not invincible, but the upper body beats air attacks.
function dropkick(sp, mul) {
  return {
    seq: [[3, 4, '162'], [0, 4, '160'], [3, 14, '163'], [0, 12, '139'], [2, 10, '139']],
    vel: [[5, 8, 6 * sp, -8], [9, 12, 7 * sp, -2], [13, 16, 7 * sp, 3], [17, 20, 6 * sp, 8], [21, 21, 0, 0]],
    aaInv: [5, 18], hurtFrom: 22, hurt: [-40, -40, 90, 40],
    hits: [H({ f: [8, 19], box: [10, -115, 98, 85], dmg: Math.round(1400 * mul), hs: 30, bs: 14, lvl: 3, kd: true, launch: [9, -9], chip: 0.1 })],
  };
}

// Arc helper for grounded moves that leave the ground (vel entries set vy).
// dir: +1 forward, -1 backward; sp scales distance.
function arc(from, dir, sp) {
  return [[from, from + 3, 7 * sp * dir, -6], [from + 4, from + 7, 7.5 * sp * dir, -1], [from + 8, from + 11, 7 * sp * dir, 3],
          [from + 12, from + 15, 6 * sp * dir, 7], [from + 16, from + 16, 0, 0]];
}
// Cinematic super shared shape: flash pose, sprint, then a scripted combo.
function superMove(name, flash, cine) {
  return { kind: 'super', name, input: 'S + H (full Spurt)',
    seq: [[flash[1], 10, flash[0]], [0, 3, '701'], [1, 3, '701'], [2, 3, '701'], [3, 3, '701'], [4, 3, '701'], [5, 3, '701'], [6, 3, '701'], [7, 3, '701'], [0, 3, '701'], [1, 3, '701'], [0, 20, '800']],
    vel: [[11, 40, 15]], inv: [1, 18],
    hits: [H({ f: [11, 40], box: [0, -140, 98, 140], dmg: 300, hs: 20, bs: 20, lvl: 2, cine: true, chip: 0.5 })], cine };
}


// Kitasan helpers ------------------------------------------------------------
// Festival Whirlwind: spinning kicks on her turn animation (802). The hurtbox is
// raised while spinning so lows pass underneath. `air` makes the airborne version.
function whirl(spins, speed, dmg, air) {
  const seq = [[0, 5, '860']], hits = [];
  let f = 5;
  for (let i = 0; i < spins; i++) {
    seq.push([0, 2, '802'], [1, 2, '802'], [2, 2, '802'], [3, 2, '802']);
    hits.push(H({ f: [f + 1, f + 4], box: air ? [0, -80, 92, 98] : [5, -135, 92, 78], dmg, hs: 18, bs: 10, lvl: 1, push: 2, chip: 0.1, guard: air ? 'high' : 'mid' }));
    f += 8;
  }
  seq.push([2, 12, '850']);
  Object.assign(hits[hits.length - 1], { kd: true, launch: [4, -8], lvl: 2 });
  const o = { seq, hits, hurtFrom: 5, hurtTo: f, hurt: [-26, -155, 52, 95] };
  if (air) Object.assign(o, { air: true, vel: [[1, f, speed, 2.2]], landRec: 9, hurt: [-26, -125, 54, 100] });
  else o.vel = [[5, f, speed]];
  return o;
}
// McQueen: Noble Riposte, the automatic answer to a caught strike
function riposte(d1, d2, extra) {
  return { kind: 'special', followOf: '2S', name: 'Noble Riposte', inv: [1, 24],
    seq: [[0, 3, '920'], [1, 3, '920'], [2, 4, '920'], [3, 4, '930'], [4, 5, '930'], [5, 16, '930']],
    hits: [H({ f: [3, 6], box: [10, -125, 100, 60], dmg: d1, hs: 26, bs: 12, lvl: 2, push: 2 }),
           H({ f: [13, 17], box: [0, -190, 100, 170], dmg: d2, hs: 30, bs: 16, lvl: 3, kd: true, launch: [4, -12], ...(extra || {}) })] };
}

const CHARS = {
  // ---- Special Week (all-rounder)
  spe: {
    name: 'SPECIAL WEEK', short: 'SPE', arch: 'ALL-ROUNDER', color: '#e45ba8', color2: '#ffd1ea',
    blurb: 'All-rounder. Has a fireball, an uppercut, an advancing spin kick and an armored tackle.',
    hp: 10000, walk: 3.2, back: 2.7, dash: 8.8, jumpV: -15, jumpX: 4.3, grav: 0.75,
    throwAnim: '840', win: '600', winFrames: 8, intro: '940',
    look: {
      idleSpeed: 9, walkSpeed: 6, runSpeed: 4, idle2: '601', squash: 1,
      taunt: '510', tauntLine: 'NUMBER ONE!', intros: ['940', '540'], wins: ['600', '520'],
      fxColor: '#ff7ac0', fxAlt: '#fff2a8', motif: 'stars',
      fx: {
        '5S': [{ t: 12, type: 'ring', x: 62, y: -95, r: 42 }, { t: 12, type: 'motif', x: 62, y: -95, n: 6 }],
        '4S': [{ t: 5, type: 'pillar', x: 22, w: 54, h: 250 }, { t: 6, type: 'motif', x: 22, y: -130, n: 10, spread: 90 }],
        '6S': [{ t: 6, type: 'spiral', dur: 26, y: -95, r: 62 }],
        '2S': [{ t: 1, type: 'ring', y: -80, r: 70 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Starter', seq: '5L 5M 5H 236M', note: 'Chain light > medium > heavy, cancel into Dream Shot' },
      { name: 'Low into tornado', seq: '2L 2M 214M', note: 'Both lows, then the advancing spin for a knockdown' },
      { name: 'Launcher air combo', seq: '2M 2H jc j.M j.H', note: 'Jump-cancel the launcher (hold ↑ on hit)' },
      { name: 'Uppercut finish', seq: '5M 5H 623M', note: 'Rising Dream after the heavy' },
      { name: 'Meter dump', seq: '2M 5H 236H', note: 'EX Dream Shot (50 Spurt) knocks down' },
    ],
    moves: baseNormals({
      '5S': { kind: 'special', name: 'Dream Shot', input: 'S', motion: '236', cd: 90, note: 'Projectile', vnote: 'L slow · M fast',
        anim: '870', seq: [[0, 9], [1, 6], [1, 22]], ev: { 12: 'proj' },
        proj: { style: 'orb', vx: 8, life: 150, box: [-26, -26, 52, 52], hit: H({ dmg: 600, hs: 18, bs: 12, lvl: 1, chip: 0.1 }) },
        v: { L: { proj: { vx: 5 } } },
        ex: { note: 'Fast 2-hit fireball that knocks down', proj: { vx: 10, hits: 2 }, hit: { kd: true, launch: [4, -8], hs: 22 } } },
      '4S': { kind: 'special', name: 'Rising Dream', input: '← + S', motion: '623', cd: 240, note: 'Invincible anti-air', vnote: 'L less invincible, safer',
        seq: [[0, 3, '840'], [1, 2, '840'], [0, 8, '880'], [1, 26, '880']], inv: [1, 9],
        hits: [H({ f: [6, 13], box: [0, -215, 78, 210], dmg: 1200, hs: 30, bs: 18, lvl: 3, kd: true, launch: [3, -15], chip: 0.1 })],
        v: { L: { inv: [1, 4], dmgMul: 0.75, seq: [[0, 3, '840'], [1, 2, '840'], [0, 8, '880'], [1, 18, '880']], hit: { launch: [3, -12] } } },
        ex: { note: 'Invincible until it hits, big damage', inv: [1, 14], dmgMul: 1.4, hit: { launch: [3, -18] } } },
      '6S': { kind: 'special', name: 'Spurt Tornado', input: '→ + S', motion: '214', cd: 150, note: 'Advancing spin kick, passes over lows', vnote: 'L 2 hits · M 3 hits',
        ...tornado(3, 6, 320),
        v: { L: tornado(2, 4.5, 320) },
        ex: { note: '5 hits, carries farther', ...tornado(5, 7.5, 300), dmgMul: 1.15 } },
      '2S': { kind: 'special', name: 'Last Spurt Tackle', input: '↓ + S', motion: '41236', cd: 180, note: 'Armored charge, absorbs a hit or projectile', vnote: 'L shorter',
        seq: [[0, 3, '701'], [1, 3, '701'], [2, 3, '701'], [3, 3, '701'], [0, 3, '111'], [1, 3, '111'], [2, 3, '111'], [3, 3, '111'], [4, 4, '111'], [5, 6, '111'], [6, 14, '111']],
        vel: [[1, 26, 11]], armor: [1, 15], hurtFrom: 13, hurt: [-30, -75, 100, 75],
        hits: [H({ f: [14, 27], box: [0, -95, 98, 72], dmg: 1200, hs: 26, bs: 14, lvl: 3, kd: true, launch: [7, -7], chip: 0.1 })],
        v: { L: { vel: [[1, 20, 9]] } },
        ex: { note: '2-hit armor, faster and farther, wall bounce', armorHits: 2, vel: [[1, 28, 13]], dmgMul: 1.25, hit: { wb: true } } },
      'SU': superMove('Shooting Star of Japan', ['341', 0],
        [['920', 0, 6, 350], ['920', 1, 6, 350], ['920', 2, 6, 350], ['930', 2, 4], ['930', 3, 8, 500], ['930', 4, 5],
         ['930', 5, 10, 600], ['840', 0, 4], ['840', 1, 4], ['880', 0, 12, 1300, 'fin'], ['880', 1, 26]]),
    }),
  },

  // ---- Silence Suzuka (hit and run)
  suz: {
    name: 'SILENCE SUZUKA', short: 'SUZ', arch: 'HIT AND RUN', color: '#3fbf6a', color2: '#ffb38a',
    blurb: 'Hit and run. Lands one big hit and gets out before you can answer, but has low health.',
    hp: 8500, walk: 3.5, back: 3.2, dash: 10, jumpV: -15.2, jumpX: 4.8, grav: 0.78,
    airDash: true, backdash: { vx: 9, vy: -5.5, inv: 6, total: 22 }, dmgMul: 1.1,
    throwAnim: '850', win: '210', winFrames: 4, intro: '940',
    look: {
      idleSpeed: 7, walkSpeed: 5, runSpeed: 3, idle2: '601', squash: 0.7,
      taunt: '550', tauntLine: '...', intros: ['940', '540'], wins: ['210', '520'],
      fxColor: '#5be08a', fxAlt: '#e9fff0', motif: 'leaves',
      fx: {
        '5S': [{ t: 3, type: 'motif', y: -80, n: 6, spread: 50 }],
        '2S': [{ t: 12, type: 'vanish', y: -75 }],
        '4S': [{ t: 3, type: 'pillar', x: 16, w: 42, h: 235 }, { t: 4, type: 'motif', x: 16, y: -120, n: 8, spread: 60 }],
        '6S': [{ t: 5, type: 'spiral', dur: 26, y: -38, r: 48, flat: 0.45 }],
        'jS': [{ t: 2, type: 'streak', dur: 40 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Starter', seq: '5L 5M 236L', note: 'Great Escape L stops in front of them' },
      { name: 'Hit and away', seq: '2L 5M 214M', note: 'Silent Flicker hits, then she hops out of range' },
      { name: 'Low roll', seq: '2L 2M 41236M', note: 'Ends in a knockdown with her far away' },
      { name: 'Launcher air combo', seq: '5M 5H jc j.M j.H', note: 'Jump-cancel the second hit of 5H' },
      { name: 'Escape through', seq: '5M 5H 236M', note: 'M version runs through them to the far side' },
    ],
    moves: baseNormals({
      '5L': { kind: 'normal', str: 1, anim: '820', seq: [[0, 3], [1, 10]],
        hits: [H({ f: [4, 6], box: [25, -102, 70, 30], dmg: 300, hs: 13, bs: 9, lvl: 0, push: 5 })] },
      '5M': { kind: 'normal', str: 2, anim: '870', seq: [[0, 6], [1, 14]], vel: [[2, 7, 5]],
        hits: [H({ f: [7, 10], box: [30, -100, 102, 32], dmg: 640, hs: 17, bs: 10, lvl: 1 })] },
      '5H': { kind: 'normal', str: 3, anim: '920', seq: [[0, 4], [1, 4], [2, 4], [3, 5], [4, 5], [5, 15]], vel: [[5, 11, 3]], jc: true,
        hits: [H({ f: [9, 12], box: [30, -105, 82, 34], dmg: 700, hs: 18, bs: 12, lvl: 2, push: 2 }),
               H({ f: [18, 22], box: [0, -180, 90, 140], dmg: 480, hs: 22, bs: 12, lvl: 2, launch: [2, -12.5] })] },
      'dL': { kind: 'normal', str: 1, name: 'Dash Jab', seq: [[0, 2, '900'], [1, 2, '900'], [0, 4, '820'], [1, 11, '820']], vel: [[1, 8, 10]],
        hits: [H({ f: [5, 8], box: [20, -104, 80, 32], dmg: 380, hs: 15, bs: 10, lvl: 1, push: 6 })] },
      'dM': { kind: 'normal', str: 2, name: 'Slipstream Lunge', seq: [[2, 3, '900'], [3, 3, '900'], [0, 5, '870'], [1, 15, '870']], vel: [[1, 10, 11]],
        hits: [H({ f: [8, 12], box: [25, -102, 108, 36], dmg: 720, hs: 19, bs: 12, lvl: 2, push: 8 })] },
      '2M': { kind: 'normal', str: 2, crouch: true, anim: '300', seq: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [7, 5]],
        vel: [[4, 15, 9]], hurt: [-35, -60, 95, 60],
        hits: [H({ f: [7, 15], box: [10, -55, 88, 45], dmg: 580, hs: 18, bs: 12, lvl: 1, guard: 'low', push: 4 })] },
      '5S': { kind: 'special', name: 'Great Escape', input: 'S', motion: '236', cd: 150, note: 'Sprint strike', vnote: 'L stops in front · M runs through and away',
        seq: [[0, 3, '701'], [1, 3, '701'], [2, 3, '701'], [3, 3, '701'], [4, 3, '701'], [5, 3, '701'], [6, 3, '701'], [7, 3, '701'], [0, 3, '701'], [1, 3, '701'], [5, 14, '801']],
        vel: [[4, 30, 13]], noPush: [4, 33],
        hits: [H({ f: [6, 22], box: [-20, -120, 92, 120], dmg: 850, hs: 24, bs: 14, lvl: 2, chip: 0.1 })],
        v: { L: { seq: [[0, 3, '701'], [1, 3, '701'], [2, 3, '701'], [3, 3, '701'], [4, 3, '701'], [5, 14, '801']], vel: [[4, 13, 10]], noPush: null } },
        ex: { note: 'Invincible, runs through and launches', inv: [4, 22], hit: { kd: true, launch: [3, -11] } } },
      '2S': { kind: 'special', name: 'Silent Flicker', input: '↓ + S', motion: '214', cd: 150, note: 'Kick, then hop far back out of reach', vnote: 'L shorter hop',
        seq: [[0, 3, '860'], [1, 5, '860'], [2, 4, '860'], [1, 16, '163'], [3, 8, '162']], vel: arc(12, -1, 1), hurtFrom: 12, hurtTo: 28, hurt: [-26, -125, 54, 100],
        hits: [H({ f: [5, 8], box: [20, -120, 88, 64], dmg: 780, hs: 20, bs: 12, lvl: 2, push: 3 })],
        v: { L: { vel: arc(12, -1, 0.6) } },
        ex: { note: 'Invincible start, knocks down, longer hop', inv: [1, 9], vel: arc(12, -1, 1.3), hit: { kd: true, launch: [4, -8] } } },
      '4S': { kind: 'special', name: 'Lead the Pack', input: '← + S', motion: '623', cd: 240, note: 'Invincible anti-air (weaker)', vnote: 'L less invincible',
        anim: '860', seq: [[0, 3], [1, 7], [2, 8], [3, 20]], inv: [1, 7],
        hits: [H({ f: [4, 10], box: [0, -210, 72, 200], dmg: 900, hs: 30, bs: 18, lvl: 3, kd: true, launch: [3, -14], chip: 0.1 })],
        v: { L: { inv: [1, 3], dmgMul: 0.8, seq: [[0, 3], [1, 7], [2, 8], [3, 14]] } },
        ex: { note: 'Longer invincibility, more damage', inv: [1, 12], dmgMul: 1.35 } },
      '6S': { kind: 'special', name: 'Turbine Roll', input: '→ + S', motion: '41236', cd: 180, note: '3-hit low roll', vnote: 'L short · M far',
        anim: '830', seq: [[0, 4], [1, 3], [2, 3], [0, 3], [1, 3], [2, 3], [0, 3], [1, 3], [2, 3], [0, 3], [1, 7]],
        vel: [[5, 30, 8]], hurt: [-30, -70, 60, 70],
        hits: [H({ f: [7, 9], box: [-10, -70, 82, 70], dmg: 300, hs: 20, bs: 12, lvl: 1, guard: 'low', push: 2, chip: 0.1 }),
               H({ f: [14, 16], box: [-10, -70, 82, 70], dmg: 300, hs: 20, bs: 12, lvl: 1, guard: 'low', push: 2, chip: 0.1 }),
               H({ f: [21, 24], box: [-10, -70, 82, 70], dmg: 360, hs: 22, bs: 12, lvl: 2, guard: 'low', kd: true, launch: [4, -7], chip: 0.1 })],
        v: { L: { vel: [[5, 30, 5.5]] } },
        ex: { note: 'Faster roll, more damage', vel: [[5, 30, 11]], dmgMul: 1.4 } },
      'jS': { kind: 'special', name: 'Silent Dive', input: 'S in the air', motion: '236', cd: 120, note: 'Overhead dive kick, once per jump', vnote: 'L shallow · M steep',
        air: true, anim: '163', seq: [[3, 90]], vel: [[1, 90, 7, 10]], landRec: 10,
        hits: [H({ f: [4, 90], box: [0, -60, 68, 62], dmg: 650, hs: 16, bs: 10, lvl: 1, guard: 'high' })],
        v: { L: { vel: [[1, 90, 9.5, 7]] } },
        ex: { note: 'Steeper dive that knocks down', vel: [[1, 90, 9, 13]], dmgMul: 1.4, hit: { kd: true, launch: [4, -6] } } },
      'SU': superMove('Silence of Speed', ['950', 1],
        [['920', 0, 5, 300], ['920', 1, 5, 300], ['920', 2, 5, 300], ['850', 0, 4], ['850', 1, 6, 450], ['850', 2, 6, 450],
         ['930', 3, 5], ['930', 4, 6, 500], ['950', 1, 6], ['950', 2, 10, 1300, 'fin'], ['950', 3, 26]]),
    }),
  },

  // ---- Gold Ship (rushdown)
  gs: {
    name: 'GOLD SHIP', short: 'GS', arch: 'RUSHDOWN', color: '#e0442f', color2: '#ffe08a',
    blurb: 'Rushdown. Fastest normals, a command dash with mixups, and the legendary dropkick.',
    hp: 9500, walk: 3.4, back: 2.6, dash: 9.8, jumpV: -14, jumpX: 4.6, grav: 0.8,
    lightChain: true, dashCancel: true,
    throwAnim: '840', win: '600', winFrames: 8, intro: '940',
    look: {
      idleSpeed: 6, walkSpeed: 5, runSpeed: 3, idle2: '601', squash: 1.4,
      taunt: '361', tauntLine: 'GOLSHI-CHAN IS HERE!', intros: ['940', '203'], wins: ['600', '510'],
      fxColor: '#ffd24a', fxAlt: '#ff5a3c', motif: 'bang',
      fx: {
        '5S': [{ t: 2, type: 'dustTrail', dur: 24 }],
        '4S': [{ t: 6, type: 'streak', dur: 14 }],
        '6S': [{ t: 14, type: 'ring', y: -80, r: 125 }, { t: 14, type: 'bang', y: -175, text: 'GOLSHI MODE!' }],
        'jS': [{ t: 2, type: 'streak', dur: 40 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Jab loop', seq: '2L 2L 2L 214M', note: 'Crouching jabs chain into themselves, then Barrage' },
      { name: 'Dash cancel', seq: '5M dc dL 5H', note: '→→ during 5M (10 Spurt), dash jab, heavy' },
      { name: 'Dropkick ender', seq: '5L 5M 5H 623M', note: 'Golshi Dropkick!! for big damage' },
      { name: 'Launcher air combo', seq: '2M 2H jc j.M j.H', note: 'Jump-cancel the launcher' },
    ],
    moves: baseNormals({
      '5L': { kind: 'normal', str: 1, anim: '820', seq: [[0, 3], [1, 9]],
        hits: [H({ f: [4, 6], box: [25, -102, 70, 30], dmg: 270, hs: 13, bs: 10, lvl: 0, push: 4 })] },
      '2L': { kind: 'normal', str: 1, crouch: true, anim: '821', seq: [[0, 3], [1, 9]],
        hits: [H({ f: [4, 6], box: [25, -62, 74, 26], dmg: 240, hs: 13, bs: 9, lvl: 0, guard: 'low', push: 2 })] },
      '5M': { kind: 'normal', str: 2, anim: '870', seq: [[0, 5], [1, 13]], vel: [[2, 6, 4]],
        hits: [H({ f: [6, 9], box: [30, -100, 92, 32], dmg: 620, hs: 17, bs: 11, lvl: 1 })] },
      '5H': { kind: 'normal', str: 3, anim: '930', seq: [[0, 4], [1, 4], [2, 3], [3, 4], [4, 5], [5, 14]], vel: [[5, 11, 3.5]], jc: true,
        hits: [H({ f: [9, 11], box: [30, -105, 82, 34], dmg: 650, hs: 18, bs: 12, lvl: 2, push: 2 }),
               H({ f: [16, 20], box: [0, -185, 88, 140], dmg: 500, hs: 22, bs: 12, lvl: 2, launch: [2, -12.5] })] },
      'dL': { kind: 'normal', str: 1, name: 'Dash Jab', seq: [[0, 2, '900'], [1, 2, '900'], [0, 3, '820'], [1, 10, '820']], vel: [[1, 7, 9.5]],
        hits: [H({ f: [5, 7], box: [20, -104, 80, 32], dmg: 380, hs: 15, bs: 11, lvl: 1, push: 5 })] },
      '5S': { kind: 'special', name: 'Golshi Rush', input: 'S', motion: '236', cd: 120, note: 'Command dash', vnote: 'L short · M long',
        fnote: 'during the dash: L low slide · M overhead · H grab · S stop',
        seq: [[0, 3, '102'], [1, 3, '102'], [2, 3, '102'], [3, 3, '102'], [4, 3, '102'], [5, 3, '102'], [0, 3, '102'], [1, 3, '102'], [0, 8, '800']],
        vel: [[2, 24, 10]], follow: { win: [6, 24], L: '5S~L', M: '5S~M', H: '5S~H', S: 'stop' },
        v: { L: { vel: [[2, 14, 9]], follow: { win: [5, 15], L: '5S~L', M: '5S~M', H: '5S~H', S: 'stop' },
                  seq: [[0, 3, '102'], [1, 3, '102'], [2, 3, '102'], [3, 3, '102'], [4, 3, '102'], [0, 8, '800']] } },
        ex: { note: 'Invincible, longer dash', inv: [1, 12], vel: [[2, 30, 11.5]], follow: { win: [6, 30], L: '5S~L', M: '5S~M', H: '5S~H', S: 'stop' } } },
      '5S~L': { kind: 'special', followOf: '5S', name: 'Golshi Slide', seq: [[0, 2, '300'], [1, 2, '300'], [2, 2, '300'], [3, 3, '300'], [4, 3, '300'], [5, 3, '300'], [6, 4, '300'], [7, 8, '300']],
        vel: [[1, 14, 9]], hurt: [-35, -60, 95, 60],
        hits: [H({ f: [3, 14], box: [10, -55, 92, 45], dmg: 750, hs: 20, bs: 12, lvl: 2, guard: 'low', kd: true, launch: [4, -6], chip: 0.1 })] },
      '5S~M': { kind: 'special', followOf: '5S', name: 'Hop Chop', air: true, seq: [[0, 4, '850'], [1, 6, '850'], [2, 6, '850'], [3, 12, '850']],
        vel: [[1, 1, 5, -7.5]], landRec: 9,
        hits: [H({ f: [9, 18], box: [15, -110, 85, 75], dmg: 700, hs: 19, bs: 11, lvl: 2, guard: 'high', chip: 0.1 })] },
      '5S~H': { kind: 'throw', followOf: '5S', name: 'Golshi Grab', anim: '820', seq: [[0, 3], [1, 22]], vel: [[1, 6, 9]], grab: [2, 7], range: 105, throwDmg: 1500, noTech: true },
      '4S': { kind: 'special', name: 'Golshi Dropkick!!', input: '← + S', motion: '623', cd: 210, note: 'Huge damage, beats jump-ins, NOT invincible', vnote: 'L short · M far',
        ...dropkick(1.1, 1),
        v: { L: dropkick(0.7, 0.85) },
        ex: { note: '2-hit armor, wall bounce', armor: [1, 18], armorHits: 2, dmgMul: 1.3, hit: { launch: [8, -10], wb: true } } },
      '2S': { kind: 'special', name: 'Barrage', input: '↓ + S', motion: '214', cd: 150, note: 'Rapid jabs, plus on block', vnote: 'L 3 jabs (+5) · M 4 jabs (+3)',
        ...barrage(4, 1, 12),
        v: { L: barrage(3, 0.9, 14) },
        ex: { note: '8 jabs, very plus on block', ...barrage(8, 1, 16), dmgMul: 1.1 } },
      '6S': { kind: 'special', name: 'Golshi Mode', input: '→ + S', motion: '41236', cd: 600, cdAlways: true, note: 'Buff 6s: faster, +2 blockstun, +8% dmg (10s cooldown)',
        seq: [[0, 6, '202'], [1, 6, '202'], [2, 10, '202'], [0, 8, '203']], ev: { 14: 'gold' },
        ex: { note: 'Instant, lasts 10s', seq: [[0, 3, '202'], [2, 6, '202']], ev: { 4: 'goldEx' } } },
      'jS': { kind: 'special', name: 'Sky Dropkick', input: 'S in the air', motion: '236', cd: 120, note: 'Diving dropkick, overhead', vnote: 'L shallow · M steep',
        air: true, anim: '163', seq: [[3, 90]], vel: [[1, 90, 6, 13]], landRec: 12,
        hits: [H({ f: [3, 90], box: [0, -60, 72, 62], dmg: 650, hs: 17, bs: 11, lvl: 2, guard: 'high' })],
        v: { L: { vel: [[1, 90, 10, 8]] } },
        ex: { note: 'Knocks down', dmgMul: 1.4, hit: { kd: true, launch: [5, -7] } } },
      'SU': superMove('Golshi Grand Voyage', ['341', 0],
        [['920', 0, 4, 250], ['920', 1, 4, 250], ['820', 0, 3, 200], ['820', 1, 3, 200], ['920', 2, 4, 250], ['930', 3, 6, 400],
         ['850', 2, 6, 400], ['160', 0, 6], ['163', 3, 12, 1450, 'fin'], ['139', 0, 26]]),
    }),
  },

  // ---- Vodka (vortex)
  vo: {
    name: 'VODKA', short: 'VOD', arch: 'VORTEX', color: '#1fb5a3', color2: '#c9fff4',
    blurb: 'Vortex. Gets a hard knockdown, then makes you guess high, low, left, right or throw.',
    hp: 9500, walk: 3.3, back: 2.7, dash: 9.2, jumpV: -14.8, jumpX: 4.4, grav: 0.78,
    throwAnim: '840', win: '600', winFrames: 8, intro: '940', ai: 'vortex',
    look: {
      idleSpeed: 8, walkSpeed: 6, runSpeed: 4, idle2: '601', squash: 1.1,
      taunt: '202', tauntLine: 'COOL, RIGHT?', intros: ['940', '550'], wins: ['600', '210'],
      fxColor: '#5ff2dc', fxAlt: '#f7e14a', motif: 'bolt',
      fx: {
        '5S': [{ t: 9, type: 'dustTrail', dur: 14 }],
        '2S': [{ t: 4, type: 'streak', dur: 18 }],
        '6S': [{ t: 4, type: 'ring', x: 50, y: -80, r: 60 }],
        '4S': [{ t: 3, type: 'pillar', x: 16, w: 36, h: 210, color: '#5ff2dc' }],
        'jS': [{ t: 2, type: 'streak', dur: 40 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Hard knockdown', seq: '2L 2M 236M', note: 'Full Throttle is a hard knockdown, so you get a free mixup' },
      { name: 'Cross-up starter', seq: 'j.M 5M 5H 236M', note: 'j.M hits on either side of a crouching opponent' },
      { name: 'Launcher air combo', seq: '5M 5H jc j.M j.H', note: 'Jump-cancel the second hit of 5H' },
      { name: 'Rev Kick ender', seq: '2M 623M', note: 'Rev Kick launches. It beats jump-ins but isn\'t invincible' },
    ],
    moves: baseNormals({
      // cross-up air normals: the boxes reach behind her
      'jL': { kind: 'normal', str: 1, air: true, anim: '860', seq: [[0, 4], [0, 14]],
        hits: [H({ f: [4, 10], box: [-20, -82, 80, 50], dmg: 300, hs: 13, bs: 9, lvl: 0, guard: 'high' })] },
      'jM': { kind: 'normal', str: 2, air: true, anim: '850', seq: [[0, 4], [1, 8], [1, 10]],
        hits: [H({ f: [5, 12], box: [-38, -112, 112, 66], dmg: 600, hs: 16, bs: 11, lvl: 1, guard: 'high' })] },
      '5S': { kind: 'special', name: 'Full Throttle', input: 'S', motion: '236', cd: 150, note: 'Rushing knee, HARD knockdown (no quick rise)', vnote: 'L short · M long',
        seq: [[0, 6, '801'], [1, 5, '801'], [2, 4, '801'], [3, 8, '801'], [4, 8, '801'], [5, 10, '801']], vel: [[10, 22, 10]],
        hits: [H({ f: [12, 22], box: [15, -110, 82, 72], dmg: 1050, hs: 26, bs: 14, lvl: 2, kd: true, hard: true, launch: [3, -7], chip: 0.1 })],
        v: { L: { vel: [[10, 17, 8]] } },
        ex: { note: 'Invincible start, wall bounce', inv: [1, 11], dmgMul: 1.3, hit: { wb: true, launch: [7, -8] } } },
      '6S': { kind: 'throw', name: 'Pit Stop', input: '→ + S', motion: '41236', cd: 150, note: 'Command grab (untechable), leaves them right in front', special: true,
        anim: '820', seq: [[0, 4], [1, 20]], grab: [4, 6], range: 95, throwDmg: 1250, noTech: true, throwVx: 2,
        ex: { note: 'Longer range, more damage', range: 125, throwDmg: 1650 } },
      '2S': { kind: 'special', name: 'Drift Hop', input: '↓ + S', motion: '214', cd: 120, note: 'Hop kick overhead', vnote: 'L lands in front · M crosses over',
        air: true, seq: [[0, 4, '160'], [1, 6, '850'], [2, 6, '850'], [3, 16, '850']], vel: [[1, 1, 7, -9]], landRec: 7,
        hits: [H({ f: [12, 30], box: [-28, -95, 104, 72], dmg: 650, hs: 18, bs: 11, lvl: 2, guard: 'high', chip: 0.1 })],
        v: { L: { vel: [[1, 1, 2.2, -9]] } },
        ex: { note: 'Invincible start, knocks down', inv: [1, 10], dmgMul: 1.35, hit: { kd: true, hard: true, launch: [3, -7] } } },
      '4S': { kind: 'special', name: 'Rev Kick', input: '← + S', motion: '623', cd: 200, note: 'Anti-air knee, NOT invincible on the ground', vnote: 'L faster recovery',
        anim: '860', seq: [[0, 3], [1, 6], [2, 8], [3, 22]], aaInv: [3, 12],
        hits: [H({ f: [4, 11], box: [0, -205, 76, 195], dmg: 1000, hs: 28, bs: 16, lvl: 3, kd: true, launch: [3, -13], chip: 0.1 })],
        v: { L: { dmgMul: 0.8, seq: [[0, 3], [1, 6], [2, 8], [3, 15]] } },
        ex: { note: 'Fully invincible start', inv: [1, 10], dmgMul: 1.25 } },
      'jS': { kind: 'special', name: 'Drift Drop', input: 'S in the air', motion: '236', cd: 120, note: 'Fast low-angle dive kick, overhead', vnote: 'L flatter · M steeper',
        air: true, anim: '163', seq: [[3, 90]], vel: [[1, 90, 9, 9]], landRec: 9,
        hits: [H({ f: [3, 90], box: [0, -62, 72, 62], dmg: 600, hs: 17, bs: 11, lvl: 1, guard: 'high' })],
        v: { L: { vel: [[1, 90, 11, 5.5]] } },
        ex: { note: 'Hard knockdown', dmgMul: 1.35, hit: { kd: true, hard: true, launch: [4, -6] } } },
      'SU': superMove('Top Speed Overdrive', ['341', 0],
        [['801', 3, 5, 300], ['820', 0, 4, 250], ['820', 1, 4, 250], ['870', 0, 4, 300], ['870', 1, 6], ['930', 3, 6, 450],
         ['850', 2, 6, 450], ['860', 1, 4], ['880', 0, 12, 1350, 'fin'], ['880', 1, 26]]),
    }),
  },

  // ---- Daiwa Scarlet (zoner)
  ds: {
    name: 'DAIWA SCARLET', short: 'DAI', arch: 'ZONER', color: '#e2304a', color2: '#ffd7df',
    blurb: 'Zoner. Shoots straight, up, low and from the air, and has a reflector. Weak up close.',
    hp: 9000, walk: 3.0, back: 2.9, dash: 7.8, jumpV: -15.2, jumpX: 4.2, grav: 0.76,
    projMax: 2, backdash: { vx: 8.5, vy: -5, inv: 5, total: 22 }, dmgMul: 0.88,
    throwAnim: '850', win: '210', winFrames: 4, intro: '940', ai: 'zoner',
    look: {
      idleSpeed: 9, walkSpeed: 6, runSpeed: 4, idle2: '601', squash: 0.9,
      taunt: '510', tauntLine: 'FIRST PLACE IS MINE!', intros: ['940', '202'], wins: ['210', '520'],
      fxColor: '#ff5872', fxAlt: '#ffe2ea', motif: 'petals',
      fx: {
        '5S': [{ t: 12, type: 'ring', x: 55, y: -95, r: 36 }, { t: 12, type: 'motif', x: 55, y: -95, n: 6 }],
        '2S': [{ t: 8, type: 'motif', x: 30, y: -130, n: 6 }],
        '4S': [{ t: 3, type: 'ring', y: -85, r: 105 }, { t: 3, type: 'motif', y: -90, n: 12, spread: 90 }],
        '6S': [{ t: 9, type: 'motif', x: 40, y: -20, n: 6 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Poke into shot', seq: '5M 236M', note: 'Cancel her long 5M into Scarlet Shot' },
      { name: 'Low into ground wave', seq: '2L 2M 41236M', note: 'Ground Rose is a low projectile' },
      { name: 'Close-range escape', seq: '5L 5M 623M', note: 'Rose Barrier knocks them away to shooting range' },
      { name: 'Anti-air shot', seq: '2H jc j.M j.H', note: 'Launch, then air combo' },
    ],
    moves: baseNormals({
      '5L': { kind: 'normal', str: 1, anim: '820', seq: [[0, 4], [1, 11]],
        hits: [H({ f: [5, 7], box: [25, -102, 84, 30], dmg: 270, hs: 13, bs: 9, lvl: 0, push: 6 })] },
      '5M': { kind: 'normal', str: 2, anim: '870', seq: [[0, 7], [1, 15]], vel: [[3, 7, 2]],
        hits: [H({ f: [8, 11], box: [30, -100, 122, 32], dmg: 570, hs: 17, bs: 11, lvl: 1, push: 8 })] },
      '5H': { kind: 'normal', str: 3, anim: '930', seq: [[0, 5], [1, 4], [2, 4], [3, 5], [4, 5], [5, 16]], vel: [[6, 12, 2]], jc: true,
        hits: [H({ f: [10, 13], box: [30, -105, 100, 34], dmg: 600, hs: 18, bs: 12, lvl: 2, push: 2 }),
               H({ f: [19, 22], box: [0, -190, 100, 145], dmg: 430, hs: 22, bs: 12, lvl: 2, launch: [2, -12.5] })] },
      '2H': { kind: 'normal', str: 3, anim: '880', seq: [[0, 4, '840'], [1, 4, '840'], [0, 6], [1, 18]], aaInv: [6, 16], jc: true,
        hits: [H({ f: [9, 14], box: [0, -220, 90, 205], dmg: 850, hs: 20, bs: 14, lvl: 2, launch: [2, -13] })] },
      '5S': { kind: 'special', name: 'Scarlet Shot', input: 'S', motion: '236', cd: 75, note: 'Projectile (two on screen)', vnote: 'L slow · M fast',
        seq: [[0, 4, '802'], [1, 4, '802'], [2, 4, '802'], [3, 20, '802']], ev: { 12: 'proj' },
        proj: { style: 'rose', vx: 7.5, life: 160, box: [-24, -24, 48, 48], hit: H({ dmg: 520, hs: 18, bs: 12, lvl: 1, chip: 0.1 }) },
        v: { L: { proj: { vx: 4.5 } } },
        ex: { note: 'Two fast shots', ev: { 12: 'proj', 19: 'proj2' }, proj: { vx: 9.5 }, proj2: { style: 'rose', vx: 9.5, life: 160, box: [-24, -24, 48, 48], hit: H({ dmg: 520, hs: 18, bs: 12, lvl: 1, chip: 0.1 }) }, dmgMul: 1.15 } },
      '2S': { kind: 'special', name: 'High Top Line', input: '↓ + S', motion: '214', cd: 90, note: 'Anti-air shot angled upward', vnote: 'L flatter · M steeper',
        anim: '860', seq: [[0, 6], [1, 6], [2, 20]], ev: { 8: 'proj' },
        proj: { style: 'rose', vx: 4.5, vy: -6.5, y0: -140, x0: 40, life: 60, box: [-24, -24, 48, 48], hit: H({ dmg: 600, hs: 20, bs: 12, lvl: 2, kd: true, launch: [2, -9], chip: 0.1 }) },
        v: { L: { proj: { vx: 6.5, vy: -3.5 } } },
        ex: { note: 'Fires both angles', ev: { 8: 'proj', 12: 'proj2' }, proj2: { style: 'rose', vx: 6.5, vy: -3.5, y0: -130, x0: 40, life: 60, box: [-24, -24, 48, 48], hit: H({ dmg: 600, hs: 20, bs: 12, lvl: 2, kd: true, launch: [2, -9], chip: 0.1 }) }, dmgMul: 1.1 } },
      '6S': { kind: 'special', name: 'Ground Rose', input: '→ + S', motion: '41236', cd: 120, note: 'Low projectile along the ground', vnote: 'L short range · M full screen',
        seq: [[0, 5, '821'], [1, 6, '821'], [1, 18, '821']], ev: { 9: 'proj' },
        proj: { style: 'wave', vx: 6, life: 130, y0: -22, x0: 50, box: [-26, -22, 52, 44], hit: H({ dmg: 460, hs: 18, bs: 12, lvl: 1, guard: 'low', chip: 0.1 }) },
        v: { L: { proj: { life: 55 } } },
        ex: { note: 'Faster, hits twice', proj: { vx: 8.5, hits: 2 }, dmgMul: 1.3 } },
      '4S': { kind: 'special', name: 'Rose Barrier', input: '← + S', motion: '623', cd: 200, note: 'Reflects projectiles, pushes them away', vnote: 'L shorter window',
        anim: '950', seq: [[0, 3], [1, 6], [2, 8], [3, 14]], inv: [1, 6], reflect: { f: [3, 18], box: [-10, -180, 105, 180] },
        hits: [H({ f: [4, 9], box: [0, -165, 92, 165], dmg: 450, hs: 20, bs: 16, lvl: 2, kd: true, launch: [7, -6], push: 10 })],
        v: { L: { reflect: { f: [3, 11], box: [-10, -180, 105, 180] }, seq: [[0, 3], [1, 6], [2, 6], [3, 10]] } },
        ex: { note: 'Invincible, longer reflect window, wall bounce', inv: [1, 14], reflect: { f: [3, 24], box: [-10, -180, 115, 180] }, dmgMul: 1.3, hit: { wb: true } } },
      'jS': { kind: 'special', name: 'Sky Shot', input: 'S in the air', motion: '236', cd: 90, note: 'Air shot angled downward, once per jump', vnote: 'L flatter · M steeper',
        air: true, seq: [[0, 4, '850'], [1, 16, '850']], vel: [[1, 8, 0.5, -1.5]], ev: { 6: 'proj' }, landRec: 6,
        proj: { style: 'rose', vx: 6, vy: 5, y0: -70, x0: 30, life: 80, box: [-22, -22, 44, 44], hit: H({ dmg: 450, hs: 16, bs: 10, lvl: 1, guard: 'high', chip: 0.1 }) },
        v: { L: { proj: { vx: 8, vy: 3 } } },
        ex: { note: 'Two shots', ev: { 6: 'proj', 11: 'proj2' }, proj2: { style: 'rose', vx: 8, vy: 3, y0: -70, x0: 30, life: 80, box: [-22, -22, 44, 44], hit: H({ dmg: 450, hs: 16, bs: 10, lvl: 1, guard: 'high', chip: 0.1 }) } } },
      // Number One Finish: five shots and a big finisher, each its own projectile
      'SU': { kind: 'super', name: 'Number One Finish', input: 'S + H (full Spurt)', inv: [1, 20],
        seq: [[0, 6, '950'], [1, 7, '950'],
              [1, 2, '802'], [2, 3, '802'], [1, 2, '802'], [2, 3, '802'], [1, 2, '802'], [2, 3, '802'], [1, 2, '802'], [2, 3, '802'], [1, 2, '802'], [2, 3, '802'],
              [0, 4, '950'], [1, 4, '950'], [2, 5, '802'], [3, 18, '802']],
        ev: { 14: 'shot0', 19: 'shot1', 24: 'shot2', 29: 'shot3', 34: 'shot4', 45: 'shot5' },
        shots: [
          ...[[-1.0, -0.35], [-0.6, 0.25], [-1.1, -0.15], [-0.7, 0.35], [-0.9, 0]].map(([dy, vy]) =>
            ({ style: 'rose', sup: true, vx: 13, vy, y0: -95 + dy * 10, x0: 55, life: 85, box: [-24, -24, 48, 48],
               hit: H({ dmg: 400, hs: 22, bs: 14, lvl: 2, push: 3, chip: 0.08, launch: [1.5, -3] }) })),
          { style: 'rose', sup: true, size: 1.8, vx: 12, y0: -95, x0: 60, life: 95, box: [-40, -40, 80, 80],
            hit: H({ dmg: 1900, hs: 30, bs: 18, lvl: 3, push: 10, chip: 0.08, kd: true, hard: true, launch: [6, -10] }) },
        ] },
    }),
  },

  // ---- Mejiro McQueen (bait and punish)
  mm: {
    name: 'MEJIRO McQUEEN', short: 'McQ', arch: 'BAIT AND PUNISH', color: '#9b7bf0', color2: '#efe6ff',
    blurb: 'Bait and punish. Long pokes, a counter stance, and extra damage on anyone caught recovering.',
    hp: 10500, walk: 2.9, back: 2.9, dash: 8.4, jumpV: -14.6, jumpX: 4.1, grav: 0.76,
    punisher: true, throwAnim: '840', win: '600', winFrames: 8, intro: '940', ai: 'bait',
    look: {
      idleSpeed: 10, walkSpeed: 7, runSpeed: 4, idle2: '601', squash: 0.8,
      taunt: '960', tauntLine: 'Just... one bite of cake.', intros: ['940', '540'], wins: ['600', '520'],
      fxColor: '#b48cff', fxAlt: '#fff2c4', motif: 'gems',
      fx: {
        '5S': [{ t: 10, type: 'streak', dur: 8 }],
        '2S': [{ t: 2, type: 'ring', y: -85, r: 62 }, { t: 2, type: 'motif', y: -95, n: 5, spread: 40 }],
        '2S~C': [{ t: 1, type: 'ring', y: -90, r: 110 }, { t: 12, type: 'motif', x: 40, y: -150, n: 10, spread: 70 }],
        '2S~E': [{ t: 1, type: 'ring', y: -90, r: 130 }, { t: 12, type: 'motif', x: 40, y: -150, n: 14, spread: 80 }],
        '4S': [{ t: 5, type: 'pillar', x: 20, w: 48, h: 245 }, { t: 6, type: 'motif', x: 20, y: -130, n: 8, spread: 80 }],
        '6S': [{ t: 3, type: 'dustTrail', dur: 20 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Poke into lance', seq: '5M 236M', note: 'Her long 5M cancels into Stayer\'s Lance' },
      { name: 'Punish starter', seq: '2M 5H 623M', note: 'Use after a blocked move: PUNISH! adds 20% damage' },
      { name: 'Low stride', seq: '5L 2M 41236M', note: 'Ends in the long low slide' },
      { name: 'Launcher air combo', seq: '2H jc j.M j.H', note: 'Jump-cancel the launcher' },
    ],
    moves: baseNormals({
      '5M': { kind: 'normal', str: 2, anim: '870', seq: [[0, 8], [1, 15]], vel: [[3, 8, 3]],
        hits: [H({ f: [9, 12], box: [30, -100, 120, 32], dmg: 640, hs: 17, bs: 10, lvl: 1, push: 7 })] },
      '2M': { kind: 'normal', str: 2, crouch: true, anim: '300', seq: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [7, 6]],
        vel: [[4, 13, 8]], hurt: [-35, -60, 95, 60],
        hits: [H({ f: [7, 14], box: [10, -55, 96, 45], dmg: 600, hs: 18, bs: 12, lvl: 1, guard: 'low', push: 4 })] },
      '5S': { kind: 'special', name: 'Stayer\'s Lance', input: 'S', motion: '236', cd: 120, note: 'Long kick for punishing from range', vnote: 'L faster · M longer',
        anim: '870', seq: [[0, 10], [1, 6], [1, 16]], vel: [[3, 9, 3]],
        hits: [H({ f: [11, 15], box: [40, -100, 140, 34], dmg: 820, hs: 22, bs: 12, lvl: 2, push: 7 })],
        v: { L: { seq: [[0, 8], [1, 5], [1, 12]], hits: [H({ f: [9, 12], box: [40, -100, 112, 34], dmg: 700, hs: 21, bs: 11, lvl: 2, push: 6 })] } },
        ex: { note: 'Passes through projectiles, wall bounce', projInv: [1, 28], dmgMul: 1.35, hit: { kd: true, launch: [7, -8], wb: true } } },
      '2S': { kind: 'special', name: 'Noble Parry', input: '↓ + S', motion: '214', cd: 150, note: 'Counter stance: catches a strike and answers it', vnote: 'L shorter window',
        fnote: 'a caught strike triggers Noble Riposte (invincible, 2 hits)',
        anim: '330', seq: [[0, 3], [0, 22], [1, 4], [2, 11]], counter: { f: [3, 24], to: '2S~C' },
        v: { L: { seq: [[0, 3], [0, 12], [1, 4], [2, 9]], counter: { f: [3, 14], to: '2S~C' } } },
        ex: { note: 'Longer window, also parries projectiles, bigger riposte', seq: [[0, 2], [0, 27], [1, 4], [2, 11]], counter: { f: [2, 28], to: '2S~E', proj: true } } },
      '2S~C': riposte(550, 950),
      '2S~E': { ...riposte(700, 1300, { hard: true }), name: 'Noble Riposte EX' },
      '4S': { kind: 'special', name: 'Mejiro Ascension', input: '← + S', motion: '623', cd: 240, note: 'Invincible anti-air', vnote: 'L less invincible, safer',
        seq: [[0, 3, '840'], [1, 2, '840'], [0, 8, '880'], [1, 24, '880']], inv: [1, 9],
        hits: [H({ f: [6, 13], box: [0, -215, 78, 210], dmg: 1150, hs: 30, bs: 18, lvl: 3, kd: true, launch: [3, -15], chip: 0.1 })],
        v: { L: { inv: [1, 4], dmgMul: 0.75, seq: [[0, 3, '840'], [1, 2, '840'], [0, 8, '880'], [1, 17, '880']], hit: { launch: [3, -12] } } },
        ex: { note: 'Invincible until it hits, big damage', inv: [1, 14], dmgMul: 1.4, hit: { launch: [3, -18] } } },
      '6S': { kind: 'special', name: 'Long-Distance Stride', input: '→ + S', motion: '41236', cd: 180, note: 'Very long low slide (unsafe on block)', vnote: 'L shorter',
        anim: '300', seq: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [7, 12]], vel: [[3, 22, 12]], hurt: [-35, -60, 95, 60],
        hits: [H({ f: [6, 22], box: [10, -55, 96, 45], dmg: 950, hs: 24, bs: 14, lvl: 2, guard: 'low', kd: true, launch: [4, -6], chip: 0.1 })],
        v: { L: { vel: [[3, 15, 9]] } },
        ex: { note: 'Passes through projectiles, hard knockdown', projInv: [1, 22], dmgMul: 1.3, hit: { hard: true } } },
      'SU': superMove('Mejiro Pride', ['341', 0],
        [['870', 0, 5, 300], ['870', 1, 6, 350], ['920', 0, 4, 250], ['920', 1, 4, 250], ['920', 2, 5, 300], ['930', 3, 6, 400],
         ['840', 0, 4], ['840', 1, 4], ['880', 0, 12, 1400, 'fin'], ['880', 1, 26]]),
    }),
  },

  // ---- Tokai Teio (glass cannon)
  // 991-998 are Teio's own extra frames (unnamed in her sprite pack) split into short animations:
  // 991 point/hop · 992 lunge punch · 993 uppercut · 994 run · 995 crouch · 996/997 punch strings · 998 victory V
  tt: {
    name: 'TOKAI TEIO', short: 'TEI', arch: 'GLASS CANNON', color: '#3d7cf2', color2: '#e6f0ff',
    blurb: 'Glass cannon. Her specials chain into each other for huge damage, but she has the lowest health.',
    hp: 8000, walk: 3.5, back: 2.8, dash: 9.6, jumpV: -15, jumpX: 4.5, grav: 0.78,
    dmgMul: 1.12, specialChain: true, lowHpBoost: true,
    throwAnim: '840', win: '998', winFrames: 4, intro: '940',
    look: {
      idleSpeed: 7, walkSpeed: 5, runSpeed: 3, idle2: '601', squash: 1.2,
      taunt: '991', tauntLine: 'THE INVINCIBLE TEIO-SAMA!', intros: ['940', '991'], wins: ['998', '600'],
      fxColor: '#4a8dff', fxAlt: '#ffffff', motif: 'sparkle',
      fx: {
        '5S': [{ t: 2, type: 'dustTrail', dur: 12 }],
        '2S': [{ t: 2, type: 'motif', x: 50, y: -100, n: 4, spread: 30 }],
        '4S': [{ t: 6, type: 'pillar', x: 18, w: 44, h: 240 }, { t: 7, type: 'motif', x: 18, y: -140, n: 8, spread: 70 }],
        '6S': [{ t: 4, type: 'streak', dur: 20 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Step chain', seq: '5M 236M 214M', note: 'Teio Step hits, then chain straight into Imperial Rush' },
      { name: 'Low into rise', seq: '2L 2M 214M 623M', note: 'Imperial Rush launches, Emperor\'s Rise follows them up' },
      { name: 'Full chain', seq: '5L 5M 5H 236M 214M 623M', note: 'Each special can only be used once per combo' },
      { name: 'Launcher air combo', seq: '2M 2H jc j.M j.H', note: 'Jump-cancel the launcher' },
    ],
    moves: baseNormals({
      '5S': { kind: 'special', name: 'Teio Step', input: 'S', motion: '236', cd: 120, note: 'Dashing punch, chains into other specials', vnote: 'L short · M long',
        seq: [[0, 3, '994'], [1, 3, '994'], [2, 3, '994'], [3, 3, '994'], [0, 4, '992'], [1, 15, '992']], vel: [[2, 13, 11]],
        hits: [H({ f: [13, 17], box: [25, -105, 95, 40], dmg: 750, hs: 22, bs: 12, lvl: 2, push: 5 })],
        v: { L: { seq: [[0, 3, '994'], [1, 3, '994'], [0, 4, '992'], [1, 13, '992']], vel: [[2, 7, 9]],
                  hits: [H({ f: [7, 11], box: [25, -105, 90, 40], dmg: 680, hs: 22, bs: 12, lvl: 2, push: 5 })] } },
        ex: { note: 'Passes through projectiles, wall bounce', projInv: [1, 14], dmgMul: 1.3, hit: { kd: true, launch: [7, -8], wb: true } } },
      '2S': { kind: 'special', name: 'Imperial Rush', input: '↓ + S', motion: '214', cd: 150, note: 'Flurry of punches ending in a launcher', vnote: 'L 3 hits · M 4 hits',
        anim: '997', seq: [[0, 3], [1, 3], [2, 3], [3, 4], [4, 4], [5, 13]], vel: [[1, 12, 3.5]],
        hits: [H({ f: [3, 4], box: [20, -112, 88, 45], dmg: 230, hs: 18, bs: 12, lvl: 1, push: 1 }),
               H({ f: [6, 7], box: [20, -112, 88, 45], dmg: 230, hs: 18, bs: 12, lvl: 1, push: 1 }),
               H({ f: [9, 10], box: [20, -112, 88, 45], dmg: 260, hs: 18, bs: 12, lvl: 1, push: 1 }),
               H({ f: [13, 17], box: [5, -190, 92, 170], dmg: 560, hs: 24, bs: 14, lvl: 2, kd: true, launch: [1, -13], push: 1, chip: 0.1 })],
        v: { L: { seq: [[0, 3], [1, 3], [3, 4], [4, 4], [5, 11]],
                  hits: [H({ f: [3, 4], box: [20, -112, 88, 45], dmg: 230, hs: 18, bs: 12, lvl: 1, push: 1 }),
                         H({ f: [6, 7], box: [20, -112, 88, 45], dmg: 230, hs: 18, bs: 12, lvl: 1, push: 1 }),
                         H({ f: [10, 14], box: [5, -190, 92, 170], dmg: 500, hs: 24, bs: 14, lvl: 2, kd: true, launch: [1, -13], push: 1, chip: 0.1 })] } },
        ex: { note: '7 hits, more damage', anim: undefined, dmgMul: 1.3,
              seq: [[0, 3, '996'], [1, 3, '996'], [2, 3, '996'], [3, 3, '996'], [0, 3, '997'], [1, 3, '997'], [2, 3, '997'], [3, 4, '997'], [4, 4, '997'], [5, 13, '997']],
              vel: [[1, 24, 3]],
              hits: [3, 6, 9, 12, 15, 18, 21].map(f => H({ f: [f, f + 1], box: [20, -112, 88, 45], dmg: 200, hs: 18, bs: 12, lvl: 1, push: 1 }))
                .concat([H({ f: [25, 29], box: [5, -190, 92, 170], dmg: 560, hs: 24, bs: 14, lvl: 2, kd: true, launch: [1, -14], push: 1, chip: 0.1 })]) } },
      '4S': { kind: 'special', name: 'Emperor\'s Rise', input: '← + S', motion: '623', cd: 200, note: 'Uppercut, beats jump-ins, NOT invincible', vnote: 'L recovers faster',
        seq: [[0, 3, '995'], [0, 4, '993'], [1, 8, '993'], [1, 20, '993']], aaInv: [3, 14],
        hits: [H({ f: [7, 13], box: [0, -215, 80, 205], dmg: 1000, hs: 26, bs: 16, lvl: 3, kd: true, launch: [2, -14], chip: 0.1 })],
        v: { L: { dmgMul: 0.8, seq: [[0, 3, '995'], [0, 4, '993'], [1, 8, '993'], [1, 13, '993']] } },
        ex: { note: 'Invincible start', inv: [1, 12], dmgMul: 1.35 } },
      '6S': { kind: 'special', name: 'Miracle Leap', input: '→ + S', motion: '41236', cd: 150, note: 'Leaping overhead kick', vnote: 'L short hop · M long',
        air: true, seq: [[0, 4, '991'], [1, 5, '991'], [2, 5, '850'], [3, 22, '850']], vel: [[1, 1, 5.5, -9.5]], landRec: 9,
        hits: [H({ f: [12, 36], box: [10, -100, 86, 80], dmg: 820, hs: 20, bs: 12, lvl: 2, guard: 'high', chip: 0.1 })],
        v: { L: { vel: [[1, 1, 3, -9.5]] } },
        ex: { note: 'Invincible start, knocks down', inv: [1, 9], dmgMul: 1.3, hit: { kd: true, launch: [3, -8] } } },
      'SU': superMove('Absolute Emperor', ['341', 0],
        [['994', 2, 4], ['992', 0, 4, 300], ['992', 1, 4], ['996', 0, 4, 250], ['996', 1, 4, 250], ['996', 2, 4, 300], ['996', 3, 6, 350],
         ['993', 0, 4], ['993', 1, 12, 1450, 'fin'], ['998', 1, 26]]),
    }),
  },

  // ---- Kitasan Black (shoto)
  kb: {
    name: 'KITASAN BLACK', short: 'KIT', arch: 'SHOTO', color: '#e0402e', color2: '#ffe3a0',
    blurb: 'Shoto. Fireball, invincible uppercut, a spin kick that also works in the air, and a step-in punch.',
    hp: 10000, walk: 3.2, back: 2.7, dash: 9.0, jumpV: -15, jumpX: 4.4, grav: 0.76,
    throwAnim: '840', win: '600', winFrames: 8, intro: '940',
    look: {
      idleSpeed: 9, walkSpeed: 6, runSpeed: 4, idle2: '601', squash: 1.1,
      taunt: '510', tauntLine: 'WASSHOI! WASSHOI!', intros: ['940', '540'], wins: ['600', '202'],
      fxColor: '#ff4d3d', fxAlt: '#ffd24a', motif: 'flames',
      fx: {
        '5S': [{ t: 10, type: 'ring', x: 58, y: -95, r: 40 }, { t: 10, type: 'motif', x: 58, y: -95, n: 6 }],
        '4S': [{ t: 3, type: 'pillar', x: 20, w: 54, h: 255 }, { t: 4, type: 'motif', x: 20, y: -140, n: 10, spread: 90 }],
        '2S': [{ t: 5, type: 'spiral', dur: 30, y: -95, r: 64 }],
        'jS': [{ t: 5, type: 'spiral', dur: 30, y: -80, r: 60 }],
        '6S': [{ t: 2, type: 'dustTrail', dur: 12 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Textbook', seq: '5L 5M 5H 236M', note: 'Chain light > medium > heavy into Festival Drum' },
      { name: 'Uppercut finish', seq: '2M 5H 623M', note: 'Matsuri Uppercut after the heavy' },
      { name: 'Whirlwind', seq: '2L 2M 214M', note: 'Both lows into Festival Whirlwind' },
      { name: 'Step-in', seq: '5M 41236M', note: 'Kitasan Straight carries them toward the corner' },
      { name: 'Launcher air combo', seq: '2M 2H jc j.M j.H', note: 'Jump-cancel the launcher' },
    ],
    moves: baseNormals({
      '5S': { kind: 'special', name: 'Festival Drum', input: 'S', motion: '236', cd: 80, note: 'Fireball, quick recovery', vnote: 'L slow · M fast',
        anim: '822', seq: [[0, 8], [1, 4], [1, 16]], ev: { 10: 'proj' },
        proj: { style: 'flame', vx: 7.5, life: 150, box: [-24, -24, 48, 48], hit: H({ dmg: 620, hs: 18, bs: 12, lvl: 1, chip: 0.1 }) },
        v: { L: { proj: { vx: 4.5 } } },
        ex: { note: 'Fast 2-hit fireball that knocks down', proj: { vx: 9.5, hits: 2 }, hit: { kd: true, launch: [4, -8], hs: 22 } } },
      '4S': { kind: 'special', name: 'Matsuri Uppercut', input: '← + S', motion: '623', cd: 240, note: 'Invincible uppercut, strongest in the cast', vnote: 'L less invincible',
        seq: [[2, 3, '930'], [3, 5, '930'], [4, 8, '930'], [5, 22, '930']], inv: [1, 10],
        hits: [H({ f: [4, 12], box: [0, -220, 80, 215], dmg: 1300, hs: 30, bs: 18, lvl: 3, kd: true, launch: [3, -15], chip: 0.1 })],
        v: { L: { inv: [1, 5], dmgMul: 0.75, seq: [[2, 3, '930'], [3, 5, '930'], [4, 8, '930'], [5, 15, '930']], hit: { launch: [3, -12] } } },
        ex: { note: 'Invincible until it hits, big damage', inv: [1, 16], dmgMul: 1.4, hit: { launch: [3, -18] } } },
      '2S': { kind: 'special', name: 'Festival Whirlwind', input: '↓ + S', motion: '214', cd: 150, note: 'Advancing spin kick, passes over lows', vnote: 'L 2 spins · M 3 spins',
        ...whirl(3, 5.5, 330),
        v: { L: whirl(2, 4.5, 330) },
        ex: { note: '5 spins, carries farther', ...whirl(5, 7, 300), dmgMul: 1.15 } },
      'jS': { kind: 'special', name: 'Sky Whirlwind', input: 'S in the air', motion: '214', cd: 120, note: 'Air spin kick, once per jump', vnote: 'L 1 spin · M 2 spins',
        ...whirl(2, 4.5, 300, true),
        v: { L: whirl(1, 4, 300, true) },
        ex: { note: '3 spins, knocks down', ...whirl(3, 5, 300, true), dmgMul: 1.2 } },
      '6S': { kind: 'special', name: 'Kitasan Straight', input: '→ + S', motion: '41236', cd: 150, note: 'Step-in punch, nearly safe on block', vnote: 'L short · M long',
        seq: [[0, 3, '900'], [1, 3, '900'], [2, 3, '900'], [0, 3, '920'], [1, 4, '920'], [2, 16, '920']], vel: [[1, 10, 10]],
        hits: [H({ f: [12, 15], box: [25, -110, 95, 40], dmg: 950, hs: 22, bs: 16, lvl: 2, push: 8 })],
        v: { L: { vel: [[1, 6, 8]] } },
        ex: { note: 'Passes through projectiles, wall bounce', projInv: [1, 22], dmgMul: 1.3, hit: { kd: true, launch: [7, -8], wb: true } } },
      'SU': superMove('Matsuri Grand Finale', ['341', 0],
        [['920', 0, 4, 250], ['920', 1, 4, 250], ['920', 2, 4, 300], ['802', 0, 2], ['802', 1, 2], ['802', 2, 2, 300], ['802', 3, 2],
         ['802', 0, 2, 300], ['930', 3, 5], ['930', 4, 10, 1500, 'fin'], ['930', 5, 26]]),
    }),
  },
};

// EX move = base move + its `ex` overrides; id is base id + 'X'. Costs 50 Spurt, no cooldown.
function buildEx(m, id) {
  const e = m.ex, mul = e.dmgMul || 1.3;
  const x = { ...m, ...e, exOf: id, isEx: true, name: (m.name || id) + ' EX' };
  delete x.ex; delete x.dmgMul; delete x.hit;
  if (!m.cdAlways) x.cd = 0;
  const baseHits = e.hits || m.hits;
  if (baseHits) x.hits = baseHits.map(h => ({ ...h, dmg: Math.round(h.dmg * mul), ...(e.hit || {}) }));
  delete x.v;
  if (m.proj) x.proj = { ...m.proj, ...(e.proj || {}), hit: { ...m.proj.hit, dmg: Math.round(m.proj.hit.dmg * mul), ...(e.hit || {}) } };
  if (e.proj2) x.proj2 = { ...e.proj2, hit: { ...e.proj2.hit, dmg: Math.round(e.proj2.hit.dmg * mul), ...(e.hit || {}) } };
  return x;
}
// Strength variants: motion + L/M/H picks id + '.L' / '.H' (M is the base move).
function buildVariant(m, id, b) {
  const e = m.v[b], mul = e.dmgMul || 1;
  const x = { ...m, ...e, varOf: id, name: m.name };
  delete x.v; delete x.ex; delete x.dmgMul; delete x.hit;
  if (e.hits === undefined && m.hits) x.hits = m.hits.map(h => ({ ...h, dmg: Math.round(h.dmg * mul), ...(e.hit || {}) }));
  else if (e.hits) x.hits = e.hits.map(h => ({ ...h, dmg: Math.round(h.dmg * mul) }));
  if (m.proj) x.proj = { ...m.proj, ...(e.proj || {}), hit: { ...m.proj.hit, dmg: Math.round(m.proj.hit.dmg * mul), ...(e.hit || {}) } };
  return x;
}
for (const c of Object.values(CHARS)) {
  c.techMap = {};
  for (const [k, m] of Object.entries(c.moves)) {
    if (m.ex) c.moves[k + 'X'] = buildEx(m, k);
    if (m.v) for (const b of Object.keys(m.v)) c.moves[k + '.' + b] = buildVariant(m, k, b);
    if (m.motion) c.techMap[(m.air ? 'a' : 'g') + m.motion] = k;
  }
}

// ---------------------------------------------------------------- effects & taunts
// Every hit gets an effect chosen from its hitbox shape: high boxes -> upward arc,
// low boxes -> ground sweep, everything else -> a forward smear. Fast specials get
// speed lines, EX moves a gold ring. A character's look.fx adds signature effects
// on top (keyed by base move id, so they also apply to L/H variants and EX).
const LOOK_DEFAULT = { idleSpeed: 9, walkSpeed: 6, runSpeed: 4, idle2: '601', squash: 1, taunt: '510', tauntLine: '', intros: ['940'], wins: ['600'],
  fxColor: '#ffffff', fxAlt: '#ffe066', motif: 'stars', fx: {} };
function autoFx(m) {
  const out = [];
  if (m.kind === 'throw' || m.kind === 'taunt' || m.kind === 'gc') return out;
  for (const h of (m.hits || [])) {
    if (h.cine) continue;
    const [bx, by, bw, bh] = h.box, cy = by + bh / 2, size = 0.85 + h.lvl * 0.22, t = Math.max(1, h.f[0] - 1);
    if (by < -165 && bh > 100) out.push({ t, type: 'swipe', x: bx + bw * 0.35, y: cy, r: Math.max(55, bh * 0.42) * size, a0: 0.6, a1: -1.95, w: 6 + h.lvl * 3 });
    else if (by + bh > -10 && by > -75) out.push({ t, type: 'swipe', x: bx + 12, y: -26, r: 62 * size, a0: 1.45, a1: 0.05, w: 5 + h.lvl * 2, flat: 0.42 });
    else out.push({ t, type: 'thrust', x: bx + bw * 0.5, y: cy, len: bw * size, w: 9 + h.lvl * 4 });
  }
  if (m.vel && (m.kind === 'special' || m.kind === 'super'))
    for (const v of m.vel) if (Math.abs(v[2]) >= 9 && v[1] - v[0] >= 6) { out.push({ t: v[0], type: 'speed', dur: v[1] - v[0] }); break; }
  if (m.isEx) out.push({ t: 1, type: 'ring', y: -80, r: 95, color: '#ffd24a' });
  return out;
}
for (const [cid, c] of Object.entries(CHARS)) {
  c.look = { ...LOOK_DEFAULT, ...(c.look || {}) };
  // taunt (L+H): loops look.taunt for ~50 frames and gives a little Spurt
  const n = (typeof ASSETS !== 'undefined' && ASSETS[cid] && ASSETS[cid].anims[c.look.taunt]) ? ASSETS[cid].anims[c.look.taunt][1] : 2;
  const seq = []; let tt = 0;
  while (tt < 48) for (let i = 0; i < n && tt < 48; i++) { seq.push([i, 6]); tt += 6; }
  seq.push([n - 1, 10]);
  c.moves.taunt = { kind: 'taunt', name: 'Taunt', anim: c.look.taunt, seq, ev: { 30: 'taunt' } };
  for (const [k, m] of Object.entries(c.moves)) {
    const base = m.exOf || m.varOf || m.followOf || null;
    m.fxAll = [...autoFx(m), ...((c.look.fx[k] || c.look.fx[base] || []))];
  }
}

// Precompute totals and first-active frames.
for (const c of Object.values(CHARS)) {
  for (const [k, m] of Object.entries(c.moves)) {
    m.id = k;
    m.total = m.seq.reduce((a, s) => a + s[1], 0);
    m.first = m.hits ? Math.min(...m.hits.map(h => h.f[0])) : (m.grab ? m.grab[0] : 999);
    // last frame that does anything: after this the move is in recovery (used for PUNISH)
    m.lastActive = Math.max(0, ...(m.hits || []).map(h => h.f[1]), m.grab ? m.grab[1] : 0, m.counter ? m.counter.f[1] : 0,
      m.reflect ? m.reflect.f[1] : 0, ...Object.keys(m.ev || {}).map(Number));
    if (m.air || (m.kind === 'super' && m.cine)) m.lastActive = 999;
    if (!m.str) m.str = m.kind === 'special' ? 4 : m.kind === 'super' ? 5 : 0;
  }
}
