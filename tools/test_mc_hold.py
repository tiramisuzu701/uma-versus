import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# 2.0.1: Manhattan Cafe can't act while the Friend carries out her skill, so Friend skills are no longer plus on block.
from playwright.sync_api import sync_playwright
MOT = {'236': [{'d':1},{'d':1,'r':1},{'r':1}], '214': [{'d':1},{'d':1,'l':1},{'l':1}], '623': [{'r':1},{'d':1},{'d':1,'r':1}], '41236': [{'l':1},{'l':1,'d':1},{'d':1},{'d':1,'r':1},{'r':1}]}
JS = r"""([mot, btn, gap]) => {
  tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
  startMatch('training', 'mc', 'kb'); G.training.meter = false; const [a, d] = G.p; a.x = 900; d.x = 900 + gap; a.meter = 100;
  G.phase = 'fight'; for (const p of G.p) p.setState('idle');
  const seq = mot.map(o => N(o)); seq[seq.length - 1] = N({ ...mot[mot.length - 1], [btn]: 1 });
  let blockF = -1, lastBlock = -1, aFree = -1, dFree = -1, mv = null;
  for (let f = 0; f < 200; f++) { step([seq[f] || N(), N({ r: 1, d: 1 })]);
    if (a.move && !mv) mv = a.move.name;
    if (d.state === 'block') { if (blockF < 0) blockF = f; lastBlock = f; }
    if (blockF >= 0 && aFree < 0 && a.state !== 'attack' && a.actionable()) aFree = f;
  }
  // defender free = first frame after the LAST block
  dFree = lastBlock + 1;
  return [mv, blockF >= 0 ? dFree - aFree : null];
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(800)
    ok = n = 0
    for mot, gap in (('236', 200), ('214', 120), ('623', 70)):
        for btn in 'LMH':
            name, adv = pg.evaluate(JS, [MOT[mot], btn, gap]); good = adv is not None and adv <= 1; ok += good; n += 1
            print('OK ' if good else 'BAD', f'{mot}{btn} {name}: {adv:+d} on block' if adv is not None else f'{mot}{btn} {name}: never blocked')
    held = pg.evaluate("""() => { tick = () => {}; const N = (o = {}) => ({ ...NEUTRAL, ...o });
      startMatch('training', 'mc', 'kb'); const [a, d] = G.p; a.x = 900; d.x = 1100; G.phase = 'fight'; for (const p of G.p) p.setState('idle');
      const seq = [N({ d: 1 }), N({ d: 1, r: 1 }), N({ r: 1, M: 1 })]; let bad = 0, seen = 0;
      for (let f = 0; f < 90; f++) { step([seq[f] || N({ L: 1 }), N()]); if (a.pupState === 'act' && a.state !== 'hit') { seen++; if (a.state !== 'attack') bad++; } }
      return [seen, bad]; }""")
    good = held[0] > 0 and held[1] == 0; ok += good; n += 1
    print('OK ' if good else 'BAD', f'Cafe stays in her skill while the Friend acts ({held[0]} frames, {held[1]} free)')
    print(f'{ok}/{n}'); b.close()
