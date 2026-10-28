import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
JS = r"""() => {
  const cs = () => { const k = rs; rs = 0; const c = checksum() + "|" + G.p.map(p => [p.hp, Math.round(p.x * 64), p.state, p.wins, Math.round(p.meter*64)].join()).join(";"); rs = k; return c; };
  const out = [], ROS = ROSTER, wins = {}; for (const c of ROS) wins[c] = [0, 0];
  const pairs = [['mm','tt'],['tt','kb'],['kb','mm'],['mm','ds'],['tt','gs'],['kb','spe'],['mc','at'],['at','jp'],['jp','df'],['df','mc'],['mc','mc'],['at','at'],['jp','jp'],['df','df'],['mc','vo'],['at','suz']];
  for (const [c1, c2] of pairs) for (let rep = 0; rep < 2; rep++) {
    const [x1, x2] = rep ? [c2, c1] : [c1, c2];
    startMatch('versus', x1, x2); rs = 11 + rep; const log = []; let f = 0, snap = null, snapF = 1500, sumAt = null;
    while (G.phase !== "match" && f < 60 * 99 * 5 + 4000) {
      const ins = [cpuInput(G.p[0], 3), cpuInput(G.p[1], 3)]; log.push(ins);
      if (f === snapF) snap = snapshot();
      step(ins); f++;
      if (f === snapF + 300) sumAt = cs();
    }
    const end = cs(), res = G.p.map(p => p.wins).join('-');
    if (G.p[0].wins > G.p[1].wins) wins[x1][0]++; else wins[x2][0]++; wins[x1][1]++; wins[x2][1]++;
    // replay from the input log
    startMatch('versus', x1, x2); rs = 11 + rep; for (const ins of log) step(ins);
    const rep2 = cs();
    // rollback: restore the snapshot and re-simulate 300 frames
    startMatch('versus', x1, x2); rs = 11 + rep; for (let i = 0; i < snapF; i++) step(log[i]);
    restore(snap); G.resim = true; for (let i = snapF; i < snapF + 300; i++) step(log[i]); G.resim = false;
    out.push(`${x1} vs ${x2}: ${res} in ${f}f  replay ${rep2 === end ? 'exact' : 'MISMATCH'}  rollback ${cs() === sumAt ? 'exact' : 'MISMATCH'}`);
  }
  out.push('CPU wins: ' + Object.entries(wins).filter(([k, v]) => v[1]).map(([k, v]) => k + ' ' + v[0] + '/' + v[1]).join('  '));
  return out.join('\n');
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/build/uma-versus.html'); await pg.wait_for_timeout(800)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; }")
        print(await pg.evaluate(JS)); print('ERR', errs[:5]); await b.close()
asyncio.run(main())
