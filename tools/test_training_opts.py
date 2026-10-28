import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# 2.0.1 Training options: Spurt and health settings, counter hit, dummy throw tech and wake-up.
from playwright.sync_api import sync_playwright
JS = r"""(opts) => {
  tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  UI.pendingMode = 'training'; UI.sel = [7, 4]; UI.pal = [0, 0]; beginLocalMatch();
  Object.assign(G.training, { dummy: 'stand', block: 'none', meter: true, p1Spurt: 'full', dummySpurt: 'full', p1Hp: 'refill', dummyHp: 'refill', counter: 'off', tech: 'off', wakeup: 'normal' }, opts.set);
  G.phase = 'fight'; const [a, d] = G.p; a.x = 900; d.x = 900 + (opts.gap || 70); for (const p of G.p) p.setState('idle');
  const seen = { counter: false, tech: false, quick: false };
  const hook = () => { if (G.texts.some(t => /COUNTER/.test(t.txt)) || (typeof CALLOUTS !== 'undefined' && 0)) seen.counter = true; if (d.state === 'tech') seen.tech = true; if (d.state === 'wake' && d.t === 0) seen.quick = seen.quick || d.prevDownT; };
  let f = 0, downAt = -1, wakeAt = -1;
  for (; f < (opts.n || 120); f++) {
    step(gameInputs([opts.inp(f, N), N()]));
    if (d.state === 'tech') seen.tech = true;
    if (d.state === 'down' && downAt < 0) downAt = f; if (downAt >= 0 && wakeAt < 0 && d.state === 'wake') wakeAt = f;
    if (d.counterHit || (d.lastCounter)) seen.counter = true;
  }
  return { p1m: Math.round(a.meter), dm: Math.round(d.meter), php: a.hp, dhp: d.hp, dmax: d.c.hp, tech: seen.tech, down: downAt, wake: wakeAt, prorate: d.prorate };
}"""
INP = {
  'idle': "(f, N) => N()",
  'throw': "(f, N) => f === 2 ? N({ L: 1, M: 1 }) : N()",
  'hit': "(f, N) => f === 2 ? N({ M: 1 }) : N()",
  'sweep': "(f, N) => f === 2 ? N({ d: 1, H: 1 }) : N()",
}
CASES = [
  ('Spurt half both', {'p1Spurt': 'half', 'dummySpurt': 'half'}, 'idle', lambda r: r['p1m'] == 50 and r['dm'] == 50),
  ('Spurt empty both', {'p1Spurt': 'empty', 'dummySpurt': 'empty'}, 'idle', lambda r: r['p1m'] == 0 and r['dm'] == 0),
  ('Dummy health low', {'dummyHp': 'low'}, 'idle', lambda r: r['dhp'] == round(r['dmax'] * 0.3)),
  ('Dummy health no refill', {'dummyHp': 'off'}, 'hit', lambda r: r['dhp'] < r['dmax']),
  ('Dummy health refill', {}, 'hit', lambda r: r['dhp'] == r['dmax']),
  ('Dummy throw tech always', {'tech': 'always'}, 'throw', lambda r: r['tech']),
  ('Dummy throw tech off', {}, 'throw', lambda r: not r['tech']),
]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/build/uma-versus.html'); pg.wait_for_timeout(800)
    ok = 0
    for name, st, inp, check in CASES:
        r = pg.evaluate(JS.replace('opts.inp(f, N)', f'({INP[inp]})(f, N)'), {'set': st})
        good = check(r); ok += good
        print('OK ' if good else 'BAD', f'{name:28s}', r)
    # counter hit: with the option on, the first hit gets counter-hit damage (+10%)
    dm = []
    for c in ('off', 'on'):
        r = pg.evaluate(JS.replace('opts.inp(f, N)', f'({INP["hit"]})(f, N)'), {'set': {'counter': c, 'dummyHp': 'off'}})
        dm.append(r['dmax'] - r['dhp'])
    good = dm[1] > dm[0]; ok += good; print('OK ' if good else 'BAD', f'{"Counter hit on":28s} damage off/on {dm}')
    # wake-up: quick gets up sooner than normal, late later
    w = {}
    for c in ('quick', 'normal', 'late'):
        r = pg.evaluate(JS.replace('opts.inp(f, N)', f'({INP["sweep"]})(f, N)'), {'set': {'wakeup': c}, 'n': 200})
        w[c] = r['wake'] - r['down'] if r['down'] >= 0 and r['wake'] >= 0 else None
    good = None not in w.values() and w['quick'] < w['normal'] < w['late']; ok += good
    print('OK ' if good else 'BAD', f'{"Dummy wake-up timing":28s} frames down {w}')
    print(f'{ok}/{len(CASES) + 2}', 'ERR', errs); b.close()
