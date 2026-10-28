import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# 2.0.1: getting hit or thrown clears your projectiles (fireballs and Tachyon's set potions); blocking doesn't.
from playwright.sync_api import sync_playwright
JS = r"""([c1, mv, how]) => {
  tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', c1, 'kb'); G.training.meter = false; const [a, d] = G.p; a.x = 700; d.x = 1150; a.meter = d.meter = 0;
  // a throws out her projectile and lets it travel / land, then the opponent dashes in and hits, throws or gets blocked
  let f = 0; const run = (n, fa, fd) => { for (let i = 0; i < n; i++, f++) step([fa(i), fd(i)]); };
  const btn = mv === '2S' ? N({ d: 1, S: 1 }) : N({ S: 1 });
  run(1, () => btn, () => N()); run(40, () => N(), () => N());
  const before = G.projs.filter(q => q.owner === 0).length;
  d.x = a.x + 70; d.facing = -1; a.facing = 1;
  if (how === 'hit') run(30, i => N(), i => i === 0 ? N({ M: 1 }) : N());
  if (how === 'throw') run(40, i => N(), i => i === 0 ? N({ L: 1, M: 1 }) : N());
  if (how === 'block') run(30, i => N({ l: 1 }), i => i === 0 ? N({ M: 1 }) : N());
  return [before, G.projs.filter(q => q.owner === 0).length, a.state];
}"""
CASES = [('kb', '5S', 'hit', True), ('spe', '5S', 'hit', True), ('at', '5S', 'hit', True), ('at', '2S', 'throw', True), ('kb', '5S', 'block', False)]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/build/uma-versus.html'); pg.wait_for_timeout(800)
    ok = 0
    for c, mv, how, clears in CASES:
        before, after, st = pg.evaluate(JS, [c, mv, how])
        good = before > 0 and ((after == 0) if clears else (after == before))
        ok += good
        print('OK ' if good else 'BAD', f'{c} {mv} then {how}: projectiles {before} -> {after}')
    print(f'{ok}/{len(CASES)}', 'ERR', errs); b.close()
