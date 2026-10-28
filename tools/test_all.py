import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, json, sys
from playwright.async_api import async_playwright
LIB = r"""
window.T = {};
T.N = () => ({...NEUTRAL});
T.dirIn = (a, ch) => { const f = a.facing === 1 ? 'r' : 'l', b = f === 'r' ? 'l' : 'r';
  return ({ '6': {[f]:1}, '4': {[b]:1}, '2': {d:1}, '3': {d:1,[f]:1}, '1': {d:1,[b]:1}, '8': {u:1}, '9': {u:1,[f]:1}, '7': {u:1,[b]:1} })[ch] || {}; };
T.tokenInputs = (a, tok) => {
  const N = T.N, f = a.facing === 1 ? 'r' : 'l';
  if (tok === 'jc') return [{...N(), u:1, [f]:1}, {...N(), u:1, [f]:1}];
  if (tok === 'dc') return [{...N(), [f]:1}, N(), {...N(), [f]:1}, {...N(), [f]:1}];
  let m = tok.match(/^(\d{3,5})([LMH])$/);
  if (m) { const out = []; for (const ch of m[1]) { out.push({...N(), ...T.dirIn(a, ch)}, {...N(), ...T.dirIn(a, ch)}); } out[out.length-1][m[2]] = 1; return out; }
  m = tok.match(/^d([LMH])$/);
  if (m) return a.state === 'dash' ? [{...N(), [f]:1, [m[1]]:1}] : [{...N(), [f]:1}, N(), {...N(), [f]:1, [m[1]]:1}];
  m = tok.match(/^(j\.|2|5|6)([LMH])$/);
  if (m) { const pre = m[1] === '2' ? {d:1} : m[1] === '6' ? {[f]:1} : {}; return [{...N(), ...pre, [m[2]]:1}]; }
  throw new Error('bad token ' + tok);
};
// Perform a combo against an open dummy. Success = every token executed and the combo never dropped.
T.runCombo = (cid, seqStr, oppId, ax) => {
  startMatch('training', cid, oppId || 'spe'); G.training.meter = false;
  const [a, d] = G.p; a.x = ax || 900; d.x = a.x + 85; a.meter = 100;
  const raw = seqStr.split(' '), toks = [], links = [], N = T.N;
  for (const t of raw) { if (t === ',') links[toks.length] = true; else toks.push(t); }
  let ti = 0, queue = [], maxCombo = 0, started = false, dropped = false, log = [], lastFeed = -99;
  if (toks[0].startsWith('j.')) { a.x = 790; a.setState('air'); a.y = GY - 160; a.vx = 4.2 * a.facing; a.vy = -2; }
  if (toks.length === 1) { d.x = 1120; d.setState('air'); d.y = GY - 140; d.vx = -4; d.vy = -1; }
  let fedMove = null, fedAt = -1, restarted = false, pMove = null, pT = 0;
  const ready = (prev) => {
    if (queue.length) return false;
    if (links[ti] && queue.length === 0) return restarted && a.actionable() && a.state !== 'air' && !a.airborne;
    // the previous input must have actually started a new move before we judge it
    if (ti > 0 && prev !== 'jc' && prev !== 'dc' && (!restarted || a.state !== 'attack') && !(prev.startsWith('j.') && toks[ti] && !toks[ti].startsWith('j.'))) return false;
    if (ti === 0) return toks[0].startsWith('j.') ? (a.vy > 1 && Math.abs(a.x - d.x) < 130) : (toks.length === 1 ? Math.abs(a.x - d.x) < 95 : true);
    const next = toks[ti];
    if (prev === 'jc') return a.state === 'air' && a.t >= (next === 'j.L' ? 3 : 5);
    if (prev === 'dc') return a.state === 'dash' && a.t >= 2;
    if (prev.startsWith('j.') && toks[ti - 2] === 'jc' || prev.startsWith('j.') && next.startsWith('j.')) return a.state === 'attack' && a.connected;
    if (prev.startsWith('j.') && !next.startsWith('j.')) return !a.airborne && ['idle','walk','crouch','land','attack'].includes(a.state) && (a.state !== 'attack' || a.connected);
    return a.state === 'attack' && a.connected && a.t >= a.move.first && (!(a.c.specialChain && a.move.kind === 'special') || a.hitDone.filter(Boolean).length >= (a.move.hits || []).length);
  };
  for (let fr = 0; fr < 420; fr++) {
    if (ti < toks.length && ready(toks[ti - 1])) { queue = T.tokenInputs(a, toks[ti]); log.push(toks[ti] + '@' + fr); fedMove = a.move; restarted = false; fedAt = fr; lastFeed = fr; ti++; }
    let inp = queue.length ? queue.shift() : N();
    if (toks[ti - 1] === 'jc' && !queue.length && a.state !== 'air') inp = {...N(), u: 1, [a.facing === 1 ? 'r' : 'l']: 1};
    step([inp, N()]);
    if (a.state === 'attack' && (a.move !== pMove || a.t < pT)) restarted = true; pMove = a.state === 'attack' ? a.move : null; pT = a.t;
    if (d.combo > 0) started = true;
    if (started && d.combo === 0 && ti < toks.length) dropped = true;
    maxCombo = Math.max(maxCombo, d.combo);
    if (ti >= toks.length && !queue.length && fr > lastFeed + 100) break;
  }
  return { ok: ti === toks.length && !dropped && maxCombo >= toks.filter(t => t !== 'jc' && t !== 'dc').length, hits: maxCombo, dmg: G.dmgInfo ? G.dmgInfo.combo : 0, dropped, done: ti + '/' + toks.length };
};
"""
TESTS = r"""() => {
  const out = [], N = T.N, R = (k, v) => out.push(k + ': ' + (typeof v === 'string' ? v : JSON.stringify(v)));
  // 1. every move of every character recovers
  for (const cid of ROSTER) {
    const bad = [];
    for (const id of Object.keys(CHARS[cid].moves)) for (const g of [0, 1]) {
      startMatch('training', cid, 'spe'); const [a, d] = G.p; a.x = 900; d.x = 990; a.meter = 100;
      if (CHARS[cid].moves[id].air) { a.setState('air'); a.y = GY - 110; }
      startMove(a, id, true);
      for (let f = 0; f < 240; f++) step([N(), g ? {...N(), r: 1} : N()]);
      if (a.state === 'attack' || isNaN(a.x) || isNaN(d.x) || G.p.some(p => p.hp < 0)) bad.push(id);
    }
    R('moves ' + cid + ' (' + Object.keys(CHARS[cid].moves).length + ')', bad.length ? 'STUCK ' + bad.join(',') : 'ok');
  }
  // 2. EX rework: motion+H with meter = EX, without meter = M version, motion+S = simple shortcut (no EX)
  const ex = (meter, btn) => { startMatch('training', 'spe', 'suz'); const [a] = G.p; a.x = 700; G.p[1].x = 1400; a.meter = meter; G.training.meter = false;
    const s = [...T.tokenInputs(a, '236' + (btn === 'S' ? 'L' : btn))]; if (btn === 'S') { delete s[s.length-1].L; s[s.length-1].S = 1; }
    let got = null; for (let f = 0; f < 20; f++) { step([s[f] || N(), N()]); if (a.state === 'attack' && !got) got = a.move.id; } return got + ' meter ' + Math.round(a.meter); };
  R('236H with 100 Spurt', ex(100, 'H')); R('236H with 0 Spurt', ex(0, 'H')); R('236L', ex(0, 'L')); R('236+S', ex(100, 'S'));
  // 3. block straight out of a dash by holding back
  { startMatch('training', 'spe', 'gs'); const [a, d] = G.p; a.x = 900; d.x = 1150; let res = '';
    const dash = [{...N(), l: 1}, N(), {...N(), l: 1}, ...Array(6).fill({...N(), l: 1})];
    let swung = false;
    for (let f = 0; f < 80; f++) { const inp2 = (f < dash.length || !swung) ? (f < dash.length ? dash[f] : {...N(), l: 1}) : {...N(), r: 1}; if (!swung && Math.abs(d.x - a.x) < 150) { startMove(a, '5M'); swung = true; } step([N(), inp2]); if (d.state === 'dash') res = res || 'dashing'; if (d.state === 'block') { res += ' -> BLOCKED'; break; } if (d.state === 'hit') { res += ' -> HIT'; break; } }
    R('dash then hold back vs 5M', res); }
  // 4. projectiles
  const shoot = (cid, id, crouch, setup) => { startMatch('training', cid, 'spe'); const [a, d] = G.p; a.x = 700; d.x = 1000; setup && setup(a, d); startMove(a, id, true);
    let r = 'whiff'; for (let f = 0; f < 150; f++) { step([N(), crouch === null ? N() : {...N(), r: 1, d: crouch ? 1 : 0}]); if (d.state === 'block' && r === 'whiff') r = 'BLOCK'; if (['hit','airHit'].includes(d.state) && r === 'whiff') r = 'HIT'; } return r; };
  R('Daiwa Ground Rose vs standing block', shoot('ds', '6S', false)); R('Daiwa Ground Rose vs crouch block', shoot('ds', '6S', true));
  R('Daiwa EX shot (2 projectiles)', (() => { startMatch('training', 'ds', 'spe'); const [a] = G.p; a.x = 600; G.p[1].x = 1500; a.meter = 100; startMove(a, '5SX', true); let mx = 0; for (let f = 0; f < 30; f++) { step([N(), N()]); mx = Math.max(mx, G.projs.length); } return mx + ' on screen'; })());
  R('Daiwa anti-air shot vs jumper', shoot('ds', '2S', null, (a, d) => { d.x = 860; d.setState('air'); d.y = GY - 210; d.vy = -1; d.vx = -2; }));
  R('Daiwa air shot from a jump', shoot('ds', 'jS', null, (a, d) => { a.setState('air'); a.y = GY - 170; d.x = 860; }));
  R('Daiwa barrier reflects Spe fireball', (() => { startMatch('training', 'spe', 'ds'); const [a, d] = G.p; a.x = 700; d.x = 1000; startMove(a, '5S', true);
    let refl = false, hitSpe = false; for (let f = 0; f < 140; f++) { if (f === 32) startMove(d, '4S', true); step([N(), N()]); if (G.projs.some(q => q.owner === 1)) refl = true; if (['hit','airHit'].includes(a.state)) hitSpe = true; }
    return 'reflected=' + refl + ' hit Special Week=' + hitSpe; })());
  // 5. Vodka
  R('Vodka Full Throttle: quick rise blocked', (() => { startMatch('training', 'vo', 'spe'); const [a, d] = G.p; a.x = 900; d.x = 1060; startMove(a, '5S', true);
    let downAt = -1, wakeAt = -1; for (let f = 0; f < 200; f++) { const dn = d.state === 'down'; step([N(), dn ? {...N(), L: 1} : N()]); if (d.state === 'down' && downAt < 0) downAt = f; if (d.state === 'wake' && wakeAt < 0) wakeAt = f; }
    return 'down for ' + (wakeAt - downAt) + 'f (quick rise would be 10)'; })());
  R('Vodka Pit Stop grab vs blocking', (() => { startMatch('training', 'vo', 'spe'); const [a, d] = G.p; a.x = 900; d.x = 985; startMove(a, '6S', true); let thr = false, dist = 0;
    for (let f = 0; f < 120; f++) { step([N(), {...N(), r: 1}]); if (a.state === 'throwing') thr = true; if (d.state === 'down') dist = Math.round(Math.abs(d.x - a.x)); } return 'grabbed=' + thr + ' lands ' + dist + 'px away'; })());
  for (const b of ['L', 'M']) R('Vodka Drift Hop ' + b + ' on knocked-down foe', (() => { startMatch('training', 'vo', 'spe'); const [a, d] = G.p; a.x = 900; d.x = 990; d.setState('down'); d.t = 18;
    startMove(a, b === 'L' ? '2S.L' : '2S', true); for (let f = 0; f < 40; f++) step([N(), N()]); return a.x < d.x ? 'lands in front' : 'lands BEHIND (cross-up)'; })());
  // 6. Suzuka hit and run + air dash rules
  R('Suzuka Silent Flicker distance after', (() => { startMatch('training', 'suz', 'spe'); const [a, d] = G.p; a.x = 900; d.x = 990; startMove(a, '2S', true); for (let f = 0; f < 40; f++) step([N(), {...N(), r: 1}]); return Math.round(Math.abs(d.x - a.x)) + 'px'; })());
  R('Suzuka air dash too low', (() => { startMatch('training', 'suz', 'spe'); const [a] = G.p; a.x = 600; G.p[1].x = 1500; const s = [{...N(), u: 1}, N(), N(), N(), N(), {...N(), r: 1}, N(), {...N(), r: 1}]; let st = new Set(); for (let f = 0; f < 30; f++) { step([s[f] || N(), N()]); st.add(a.state); } return [...st].join(','); })());
  R('Suzuka air dash at height', (() => { startMatch('training', 'suz', 'spe'); const [a] = G.p; a.x = 600; G.p[1].x = 1500; const s = [{...N(), u: 1}, ...Array(9).fill(N()), {...N(), r: 1}, N(), {...N(), r: 1}]; let st = new Set(); for (let f = 0; f < 60; f++) { step([s[f] || N(), N()]); st.add(a.state); } return [...st].join(',') + ' landRec ' + a.landRec; })());
  // 7. combos
  for (const cid of ROSTER) for (const cb of CHARS[cid].combos) { const r = T.runCombo(cid, cb.seq); R('combo ' + cid + ' "' + cb.seq + '"', (r.ok ? 'OK ' : 'FAIL ') + r.hits + ' hits ' + r.dmg + ' dmg' + (r.dropped ? ' DROPPED' : '') + ' ' + r.done); }
  return out.join('\n');
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/build/uma-versus.html'); await pg.wait_for_timeout(800)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; }")
        await pg.evaluate(LIB + "\n;0")
        print(await pg.evaluate(TESTS)); print('ERR', errs[:5]); await b.close()
if __name__ == "__main__": asyncio.run(main())
