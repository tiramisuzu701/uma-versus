import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Every runner against every other at one CPU level, both sides. A rough balance guide, nothing more.
import asyncio, json, sys
from playwright.async_api import async_playwright
src = open(ROOT+'/tools/test_cpu.py').read()
JS = src[src.index('JS = r"""') + 9:src.index('"""', src.index('JS = r"""') + 9)]
async def main():
    lv = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page()
        await pg.goto('file://' + ROOT + '/index.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(3000)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; Sfx.play = () => {}; }")
        R = await pg.evaluate("() => ROSTER")
        pairs = []
        for i, a in enumerate(R):
            for j, b in enumerate(R):
                if i < j: pairs.append([a, lv, b, lv, 7 + i * 13 + j]); pairs.append([b, lv, a, lv, 9 + i * 7 + j * 3])
        res = []
        for k in range(0, len(pairs), 22): res += json.loads(await pg.evaluate(JS, pairs[k:k + 22]))
        await br.close()
    w = {c: [0, 0] for c in R}
    for r in res:
        w[r['c1']][1] += 1; w[r['c2']][1] += 1
        if r['w'] == 0: w[r['c1']][0] += 1
        if r['w'] == 1: w[r['c2']][0] += 1
    print(f'round robin, L{lv} vs L{lv}, 2 games per pair:')
    print('  ' + '  '.join(f"{c} {v[0]}/{v[1]}" for c, v in sorted(w.items(), key=lambda x: -x[1][0])))
asyncio.run(main())
