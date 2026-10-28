import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Manhattan Cafe's Friend skills chain into each other on hit, like Teio's specials: after the Friend's last hit
# lands, input another skill and it comes out right away. Each skill once per chain; nothing on block.
from playwright.sync_api import sync_playwright
JS = r"""([first, next, block]) => { tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', 'mc', 'kb'); G.training.meter = false; const [a, d] = G.p; a.x = 900; d.x = 1010; a.meter = 0;
  G.phase = 'fight'; for (const p of G.p) p.setState('idle');
  const mot = { '214': [2, 1, 4], '236': [2, 3, 6], '623': [6, 2, 3], '41236': [4, 1, 2, 3, 6] };
  const dirIn = k => ({ 1: { d: 1, l: 1 }, 2: { d: 1 }, 3: { d: 1, r: 1 }, 4: { l: 1 }, 6: { r: 1 } })[k];
  startMove(a, first, true); let hitF = -1, chained = null, q = [], maxCombo = 0;
  for (let f = 0; f < 150; f++) {
    if (hitF < 0 && a.hitOK && a.connected) { hitF = f; q = mot[next].flatMap(k => [dirIn(k), dirIn(k)]); q[q.length - 1] = { ...q[q.length - 1], M: 1 }; }
    const ia = q.length ? N(q.shift()) : N();
    step([ia, block ? N({ r: 1, d: 0 }) : N()]);
    if (hitF >= 0 && !chained && a.state === 'attack' && baseId(a.move.id) !== baseId(first)) chained = { id: a.move.id, f: f - hitF };
    maxCombo = Math.max(maxCombo, d.combo);
  }
  return { hitF, chained, maxCombo }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    import sys; pg.goto('file://' + (sys.argv[1] if len(sys.argv) > 1 else ROOT+'/build/uma-versus.html')); pg.wait_for_timeout(800); ok = n = 0
    for label, args, want in [('Phantom Rush > Shadow Sweep', ['5S', '214', False], True), ('Shadow Sweep > Rising Shade', ['2S', '623', False], True),
                              ('Phantom Rush > Night Drop (comes out)', ['5S', '41236', False], None), ('blocked Phantom Rush: no chain', ['5S', '214', True], False)]:
        r = pg.evaluate(JS, args); good = bool(r['chained']) if want is None else bool(r['chained']) == want and (not want or r['maxCombo'] >= 2); ok += good; n += 1
        print('OK ' if good else 'BAD', f'{label:32}', r)
    print(f'{ok}/{n}', 'ERR', errs); b.close()
