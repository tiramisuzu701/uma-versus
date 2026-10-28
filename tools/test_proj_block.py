import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Multi-hit projectiles are blocked from the side they travel from, even point-blank (Kitasan EX Festival Drum).
from playwright.sync_api import sync_playwright
JS = r"""([gap, hold]) => {
  tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', 'kb', 'ds'); G.training.meter = false; const [a, d] = G.p; a.x = 800; d.x = 800 + gap; a.meter = 100;
  const DP = [N({ d: 1 }), N({ d: 1 }), N({ d: 1, r: 1 }), N({ d: 1, r: 1 }), N({ r: 1, H: 1 })];   // 236H = EX
  let hits = 0, blocks = 0, move = null, wasHit = false, wasBlock = false;
  for (let f = 0; f < 90; f++) { step([DP[f] || N(), N(hold === 'dr' ? { d: 1, r: 1 } : { [hold]: 1 })]);
    if (a.move && !move) move = a.move.id;
    const h = ['hit', 'airHit', 'down'].includes(d.state), bl = d.state === 'block'; if (h && !wasHit) hits++; if (bl && !wasBlock) blocks++; wasHit = h; wasBlock = bl; }
  return [move, hits, blocks, d.hp];
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/build/uma-versus.html'); pg.wait_for_timeout(800)
    ok = 0; n = 0
    for hold, name in (('r', 'standing'), ('dr', 'crouching')):
      for gap in (20, 40, 60, 80, 110, 200, 400):
        mv, hits, blocks, hp = pg.evaluate(JS, [gap, hold])
        good = hits == 0 and blocks >= 1; ok += good; n += 1
        print('OK ' if good else 'BAD', f'EX Festival Drum at {gap}px vs {name} block: move {mv}, hits {hits}, block-stun entries {blocks}')
    mv, hits, blocks, hp = pg.evaluate(JS, [80, 'l'])
    good = hits >= 1; ok += good; n += 1
    print('OK ' if good else 'BAD', f'same, not blocking: hits {hits}')
    print(f'{ok}/{n}', 'ERR', errs); b.close()
