import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, sys
from playwright.async_api import async_playwright
JS = r"""(pairs) => {
  const out = [];
  for (const [c1, l1, c2, l2, seed] of pairs) {
    startMatch('cpu', c1, c2); rs = seed; let f = 0;
    const st = [0, 1].map(() => ({ combos: [], supers: 0, supAir: 0, instRev: 0, hitsTaken: 0, blocks: 0, lastStun: -99, prevState: '', prevCombo: 0 }));
    let timeouts = 0;
    while (G.phase !== 'match' && f < 60 * 99 * 5 + 4000) {
      const ins = [cpuInput(G.p[0], l1), cpuInput(G.p[1], l2)]; step(ins); f++;
      G.p.forEach((p, i) => {
        const s = st[i], o = opp(p), so = st[1 - i];
        if (['hit', 'airHit', 'block', 'down', 'wake'].includes(p.state)) s.lastStun = f;
        if (p.state === 'attack' && p.move.kind === 'super' && s.prevState !== 'attack-su') { s.supers++; if (o.airborne) s.supAir++; if (f - s.lastStun <= 2) s.instRev++; }
        if (p.state === 'block' && s.prevState !== 'block') s.blocks++;
        if (p.combo === 0 && s.prevCombo > 0) so.combos.push(s.prevCombo);
        if (p.combo > s.prevCombo && s.prevCombo === 0) s.hitsTaken++;
        s.prevCombo = p.combo; s.prevState = p.state === 'attack' && p.move.kind === 'super' ? 'attack-su' : p.state;
      });
      if (G.phase === 'ko' && G.phaseT === 1 && G.koType === 'time') timeouts++;
    }
    const sum = s => s.combos.length ? (s.combos.reduce((a, b) => a + b, 0) / s.combos.length).toFixed(1) : '-';
    const w = G.p[0].wins > G.p[1].wins ? 0 : G.p[1].wins > G.p[0].wins ? 1 : -1;
    out.push({ c1, l1, c2, l2, w, res: G.p.map(p => p.wins).join('-'), f, timeouts,
      avg: [sum(st[0]), sum(st[1])], max: st.map(s => Math.max(0, ...s.combos)), sup: st.map(s => s.supers), supAir: st.map(s => s.supAir), inst: st.map(s => s.instRev),
      blockRate: st.map(s => (s.blocks / Math.max(1, s.blocks + s.hitsTaken)).toFixed(2)) });
  }
  return JSON.stringify(out);
}"""
import json, itertools, random
async def main():
    random.seed(4)
    R = ['spe', 'suz', 'gs', 'vo', 'ds', 'mm', 'tt', 'kb', 'jp', 'at', 'mc', 'df']
    pairs = []
    for lvl in [(4, 1), (1, 4), (3, 2), (2, 3), (4, 4), (2, 2), (3, 3), (4, 3), (3, 4)]:
        for k in range(len(R)):
            a, b = R[k], R[(k + 5) % len(R)]
            pairs.append([a, lvl[0], b, lvl[1], 100 + k + lvl[0] * 10 + lvl[1]])
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(2000)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; Sfx.play = () => {}; }")
        res = json.loads(await pg.evaluate(JS, pairs))
        print('ERR', errs[:3]); await b.close()
    by = {}
    for r in res:
        key = (r['l1'], r['l2']); by.setdefault(key, []).append(r)
    for (l1, l2), rs in by.items():
        w1 = sum(1 for r in rs if r['w'] == 0); w2 = sum(1 for r in rs if r['w'] == 1)
        avgc = [sum(float(r['avg'][i]) for r in rs if r['avg'][i] != '-') / max(1, sum(1 for r in rs if r['avg'][i] != '-')) for i in (0, 1)]
        print(f"L{l1} vs L{l2}: wins {w1}-{w2}  avg combo {avgc[0]:.1f}/{avgc[1]:.1f}  max {max(r['max'][0] for r in rs)}/{max(r['max'][1] for r in rs)}  supers {sum(r['sup'][0] for r in rs)}/{sum(r['sup'][1] for r in rs)} (vs airborne {sum(r['supAir'][0]+r['supAir'][1] for r in rs)}, instant reversal {sum(r['inst'][0]+r['inst'][1] for r in rs)})  block {sum(float(r['blockRate'][0]) for r in rs)/len(rs):.2f}/{sum(float(r['blockRate'][1]) for r in rs)/len(rs):.2f}  timeouts {sum(r['timeouts'] for r in rs)}  avg len {sum(r['f'] for r in rs)/len(rs)/60:.0f}s")
    print('per-character (all levels):')
    cw = {}
    for r in res:
        for i, c in ((0, r['c1']), (1, r['c2'])):
            d = cw.setdefault(c, [0, 0]); d[1] += 1; d[0] += r['w'] == i
    print('  ' + '  '.join(f"{c} {v[0]}/{v[1]}" for c, v in cw.items()))
asyncio.run(main())
