import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Throw tech pushes both players apart, in the corner too: whatever the cornered player can't travel goes to the
# other one, so the thrower can't walk up and throw again right after a tech (it used to end ~100 px apart in the corner).
import asyncio, sys
from playwright.async_api import async_playwright
JS = r"""(file) => {
  const N = () => ({...NEUTRAL}), out = [];
  for (const [label, ax, dx] of [['mid', 900, 980], ['def cornered', 1820, 1900], ['att cornered', 1900, 1820], ['def left corner', 120, 40]]) {
    startMatch('versus', 'spe', 'spe'); G.phase = 'fight'; for (const p of G.p) p.setState('idle');
    const [a, d] = G.p; a.x = ax; d.x = dx; a.facing = Math.sign(dx - ax); d.facing = -a.facing;
    startMove(a, 'throw', true); let teched = false, f = 0, info = null;
    for (; f < 120; f++) {
      const dIn = d.state === 'thrown' && d.t >= 2 && d.t <= 4 ? {...N(), L: 1, M: 1} : N();
      step([N(), dIn]);
      if (d.state === 'tech') teched = true;
      if (teched && a.state === 'idle' && d.state === 'idle' && !info) { info = { f, dist: Math.round(Math.abs(a.x - d.x)) };
        for (let g = 0; g < 40; g++) { step([g < 2 ? {...N(), L: 1, M: 1, [a.facing > 0 ? 'r' : 'l']: 0} : N(), N()]); if (d.state === 'thrown') { info.rethrow = true; break; } }
        if (!info.rethrow) { // walk forward 8 frames then throw
          for (let g = 0; g < 50; g++) { const fw = a.facing > 0 ? {r: 1} : {l: 1}; step([g < 8 ? {...N(), ...fw} : g < 10 ? {...N(), L: 1, M: 1} : N(), N()]); if (d.state === 'thrown') { info.walkThrow = true; break; } } }
        break; }
    }
    out.push([label, teched, info]);
  }
  return out;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + (sys.argv[1] if len(sys.argv) > 1 else ROOT+'/index.html')); await pg.wait_for_timeout(800)
        res = await pg.evaluate(JS, ''); n = 0
        for label, teched, info in res:
            ok = teched and info and info['dist'] >= 130 and not info.get('rethrow') and not info.get('walkThrow'); n += ok
            print('OK ' if ok else 'BAD', f'{label:16}', info)
        print(f'{n}/{len(res)}', 'ERR', errs); await b.close()
asyncio.run(main())
