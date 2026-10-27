import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# 2.0.1: a skill done with its motion input can't be repeated until TECH_CD frames after it ends (other skills are fine).
from playwright.sync_api import sync_playwright
JS = r"""() => {
  tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', 'kb', 'ds'); G.training.meter = false; const [a, d] = G.p; a.x = 600; d.x = 1100;
  const DP = [N({ r: 1 }), N({ r: 1 }), N({ d: 1 }), N({ d: 1 }), N({ d: 1, r: 1 }), N({ d: 1, r: 1, L: 1 })];
  const starts = []; let f = 0, was = false;
  const run = seq => { for (const i of seq) { step([i, N()]); f++; const now = a.state === 'attack' && a.move && a.move.id.startsWith('4S'); if (now && !was) starts.push(f); was = now; } };
  // input the DP over and over for 6 seconds, as fast as the motion allows
  for (let k = 0; k < 60; k++) { run(DP); run([N(), N()]); }
  const gaps = starts.slice(1).map((s, i) => s - starts[i]);
  const len = CHARS.kb.moves['4S'].seq.reduce((x, s) => x + s[1], 0);
  return [starts.length, Math.min(...gaps), len, TECH_CD];
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(800)
    n, gap, length, cd = pg.evaluate(JS)
    ok = gap >= length + cd
    print('OK ' if ok else 'BAD', f'Kitasan DP spammed: {n} DPs in 6 s, closest two {gap}f apart (move {length}f + cooldown {cd}f)')
    print('ERR', errs); b.close()
