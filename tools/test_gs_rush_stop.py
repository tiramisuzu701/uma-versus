import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Gold Ship: a normal cancelled into Golshi Rush and stopped with S is a dash cancel, so it costs 50 Spurt (not usable
# below 50) and has the same 10-frame lock before she can attack. A raw Golshi Rush stop (from neutral) costs the same.
from playwright.sync_api import sync_playwright
JS = r"""([meter, fromNormal, mv]) => { tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', 'gs', 'kb'); G.training.meter = false; const [a, d] = G.p; a.x = 900; d.x = 960; a.meter = meter;
  G.phase = 'fight'; for (const p of G.p) p.setState('idle');
  if (fromNormal) { startMove(a, '5M', true); for (let f = 0; f < 9; f++) step([N(), N({ r: 1, d: 1 })]); a.connected = true; a.hitOK = true; }
  startMove(a, mv || '5S.L', true); let stopped = -1, attackAt = -1, blockF = -1;
  for (let f = 0; f < 60; f++) {
    const ia = stopped < 0 ? N(f >= 6 && f <= 8 ? { S: 1 } : {}) : N({ L: (f - stopped) % 2 });
    step([ia, N({ r: 1, d: 1 })]);
    if (stopped < 0 && a.state === 'idle') stopped = f;
    if (stopped >= 0 && attackAt < 0 && a.state === 'attack') attackAt = f - stopped;
  }
  return { stopped: stopped >= 0 && stopped <= 10, stopF: stopped, meter: Math.round(a.meter), attackAfter: attackAt }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/build/uma-versus.html'); pg.wait_for_timeout(800); ok = n = 0
    for label, args, check in [
        ('5M > 236L > S with 100 Spurt', [100, True], lambda r: r['stopped'] and r['meter'] <= 56 and r['attackAfter'] >= 10),
        ('5M > 236L > S with 40 Spurt', [40, True], lambda r: not r['stopped']),
        ('5M > 236L > S with 0 Spurt', [0, True], lambda r: not r['stopped']),
        ('raw 236L > S with 0 Spurt', [0, False], lambda r: not r['stopped']),
        ('raw 236M > S with 0 Spurt', [0, False, '5S'], lambda r: not r['stopped']),
        ('raw 236M > S with 100 Spurt', [100, False, '5S'], lambda r: r['stopped'] and r['meter'] <= 56 and r['attackAfter'] >= 10),
        ('raw 236H (EX) > S with 100 Spurt', [100, False, '5SX'], lambda r: r['stopped'] and r['meter'] <= 6 and r['attackAfter'] >= 10),
        ('raw 236L > S with 100 Spurt', [100, False], lambda r: r['stopped'] and r['meter'] <= 56 and r['attackAfter'] >= 10)]:
        r = pg.evaluate(JS, args); good = check(r); ok += good; n += 1
        print('OK ' if good else 'BAD', f'{label:36}', r)
    print(f'{ok}/{n}', 'ERR', errs); b.close()
