"""Stress test: random-input and CPU matches across every matchup, checking engine invariants every frame."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, sys
from playwright.async_api import async_playwright
JS = r"""(seed) => {
  let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const motions = ['236', '214', '623', '41236', '66', '44', '22'];
  const masher = (p, st) => {   // mostly-sensible random inputs: motions, buttons, holds
    if (st.q.length) return st.q.shift();
    const f = p.facing === 1 ? 'r' : 'l', b = f === 'r' ? 'l' : 'r', N = { ...NEUTRAL }, r = R();
    if (r < 0.18) { const m = motions[Math.floor(R() * motions.length)], btn = ['L', 'M', 'H', 'S'][Math.floor(R() * 4)];
      for (const ch of m) { const d = { ...NEUTRAL }; if ('369'.includes(ch) || ch === '6') d[f] = 1; if ('147'.includes(ch) || ch === '4') d[b] = 1; if ('123'.includes(ch)) d.d = 1; st.q.push(d, { ...d }); }
      st.q[st.q.length - 1][btn] = 1; return st.q.shift(); }
    if (r < 0.22) { N.S = N.H = 1; return N; }
    if (r < 0.26) { N.L = N.M = 1; return N; }
    if (r < 0.5) { for (let i = 0; i < 4 + R() * 20; i++) st.q.push({ ...NEUTRAL, [b]: 1, d: R() < 0.5 ? 1 : 0 }); return st.q.shift(); }
    if (r < 0.62) { N.u = 1; if (R() < 0.6) N[f] = 1; return N; }
    if (r < 0.8) { N[['L', 'M', 'H'][Math.floor(R() * 3)]] = 1; if (R() < 0.4) N.d = 1; return N; }
    if (r < 0.9) { N[f] = 1; return N; }
    return N;
  };
  const issues = [], seen = new Set(), add = (k, v) => { if (!seen.has(k)) { seen.add(k); issues.push(k + ' ' + v); } };
  let frames = 0;
  for (const c1 of ROSTER) for (const c2 of ROSTER) {
    const mode = R() < 0.5 ? 'mash' : 'mixed';
    startMatch('versus', c1, c2); rs = Math.floor(R() * 1e6) + 1;
    const st = [{ q: [] }, { q: [] }], stuck = [{ s: '', n: 0 }, { s: '', n: 0 }];
    let f = 0;
    while (G.phase !== 'match' && f < 60 * 99 * 5 + 4000) {
      for (const p of G.p) p.meter = Math.max(p.meter, R() < 0.002 ? 100 : 0);   // hand out supers now and then
      const ins = [masher(G.p[0], st[0]), mode === 'mash' ? masher(G.p[1], st[1]) : cpuInput(G.p[1], 1 + Math.floor(R() * 4))];
      step(ins); f++; frames++;
      G.p.forEach((p, i) => {
        const tag = p.cid + '/' + p.state;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) add('NaN position', tag);
        if (p.x < 0 || p.x > STAGE_W) add('out of stage', tag + ' x=' + Math.round(p.x));
        if (p.y > GY + 0.01) add('below floor', tag + ' y=' + p.y);
        if (p.y < -400) add('flew off', tag + ' y=' + Math.round(p.y));
        if (p.hp < 0 || p.hp > p.c.hp) add('hp out of range', tag + ' ' + p.hp);
        if (p.meter < -0.01 || p.meter > 100.01) add('meter out of range', tag + ' ' + p.meter);
        if (p.combo > 60) add('combo counter runaway', tag + ' ' + p.combo);
        if (p.state === 'attack' && p.t > (p.move.total || 0) + 120 && !p.move.air) add('move never ended', p.cid + ' ' + p.move.id + ' t=' + p.t);
        if (p.state === 'air' && p.t > 400) add('stuck airborne', tag);
        const k = p.state; if (k === stuck[i].s && !['idle', 'walk', 'crouch', 'block', 'win', 'lose', 'intro'].includes(k) && G.phase === 'fight') { if (++stuck[i].n > 900) add('stuck state', tag); } else { stuck[i].s = k; stuck[i].n = 0; }
        if (Math.abs(G.p[0].x - G.p[1].x) > W + 40 && G.phase === 'fight') add('players further apart than the screen', Math.round(Math.abs(G.p[0].x - G.p[1].x)));
      });
      if (G.projs.length > 12) add('projectile pile-up', G.projs.length);
      if (G.freeze > 120) add('long freeze', G.freeze);
    }
    if (G.phase !== 'match') add('match never finished', c1 + ' vs ' + c2 + ' phase=' + G.phase + ' r=' + G.round);
  }
  return 'frames ' + frames + '\n' + (issues.join('\n') || 'no invariant violations');
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(800)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; }")
        for seed in (int(a) for a in sys.argv[1:]) if len(sys.argv) > 1 else (7, 1234, 42, 2026):
            print('seed', seed); print(await pg.evaluate(JS, seed))
        print('ERR', errs[:8]); await b.close()
asyncio.run(main())
