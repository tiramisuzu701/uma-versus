import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# 2.0.1 Gold Ship: no gapless 2L loop, dash cancel isn't hugely plus on block, Barrage L/M are +2/+1.
from playwright.sync_api import sync_playwright
LOOP = r"""() => { tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', 'gs', 'kb'); G.training.meter = false; const [a, d] = G.p; d.x = STAGE_W - 45; a.x = d.x - 60;
  G.phase = 'fight'; for (const p of G.p) p.setState('idle'); let blockF = 0, free = 0;
  for (let f = 0; f < 300; f++) { step([N({ d: 1, L: f % 2 }), N({ r: 1, d: 1 })]); if (d.state === 'block') blockF++; else if (d.actionable()) free++; }
  return [blockF, free]; }"""
ADV = r"""([mv, dc]) => { tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', 'gs', 'kb'); G.training.meter = false; const [a, d] = G.p; a.x = 900; d.x = 960; a.meter = 100;
  G.phase = 'fight'; for (const p of G.p) p.setState('idle');
  const btn = mv.slice(-1), dir = mv[0] === '2' ? { d: 1 } : {}; let blockF = -1, aFree = -1, dFree = -1, dcF = -1;
  for (let f = 0; f < 120; f++) { let ia = N(f === 0 ? { ...dir, [btn]: 1 } : dir);
    if (dc && blockF >= 0 && dcF < 0) ia = N(f === blockF + 2 ? {} : { r: 1 });
    if (dcF >= 0) ia = N({ l: 1 });
    step([ia, N({ r: 1, d: 1 })]);
    if (blockF < 0 && d.state === 'block') blockF = f; if (dc && dcF < 0 && a.state === 'dash') dcF = f;
    if (blockF >= 0 && aFree < 0 && f > blockF && (['idle', 'crouch', 'walk'].includes(a.state) || (a.state === 'dash' && !(a.dcLock > 0)))) aFree = f;
    if (blockF >= 0 && dFree < 0 && f > blockF && d.state !== 'block') dFree = f; }
  return dFree - aFree; }"""
BAR = r"""(b) => { tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', 'gs', 'kb'); G.training.meter = false; const [a, d] = G.p; a.x = 900; d.x = 960; G.phase = 'fight'; for (const p of G.p) p.setState('idle');
  const seq = [N({ d: 1 }), N({ d: 1 }), N({ d: 1, l: 1 }), N({ d: 1, l: 1 }), N({ l: 1, [b]: 1 })]; let blockF = -1, aFree = -1, dFree = -1;
  for (let f = 0; f < 150; f++) { step([seq[f] || N(), N({ r: 1, d: 1 })]); if (blockF < 0 && d.state === 'block') blockF = f;
    if (blockF >= 0 && aFree < 0 && a.state !== 'attack' && a.actionable()) aFree = f; if (blockF >= 0 && dFree < 0 && f > blockF && d.state !== 'block') dFree = f; }
  return dFree - aFree; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/build/uma-versus.html'); pg.wait_for_timeout(800); ok = n = 0
    bf, free = pg.evaluate(LOOP); good = free > 0; ok += good; n += 1
    print('OK ' if good else 'BAD', f'mashing 2L in the corner: {bf} frames blocking, {free} free frames for the defender')
    for mv in ['5L', '2L', '5M', '2M', '5H']:
        adv = pg.evaluate(ADV, [mv, True]); good = adv <= 3; ok += good; n += 1
        print('OK ' if good else 'BAD', f'{mv} dash cancel on block: {adv:+d}')
    for btn, want in (('L', 2), ('M', 0)):
        adv = pg.evaluate(BAR, btn); good = adv == want; ok += good; n += 1
        print('OK ' if good else 'BAD', f'Barrage {btn} on block: {adv:+d} (want +{want})')
    print(f'{ok}/{n}', 'ERR', errs); b.close()
