import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Dash button macro through the real input path: works from standing, while walking forward or back,
# and holding Dash never repeats it (each dash needs a new press).
from playwright.sync_api import sync_playwright
JS = r"""() => {
  const out = [], errs = [];
  const run = (frames) => {   // frames: list of {fwd, back, dash}; returns states seen
    startMatch('versus', 'spe', 'gs'); UI.screen = 'game'; UI.paused = false; G.phase = 'fight'; G.p.forEach(p => p.setState('idle'));
    const p = G.p[0]; p.x = 700; G.p[1].x = 1300; p.facing = 1; DM[0] = { q: [], held: false };
    let dashes = 0, bdashes = 0, prev = '';
    for (const f of frames) {
      const raw = [{ ...NEUTRAL, r: f.fwd ? 1 : 0, l: f.back ? 1 : 0, DASH: f.dash ? 1 : 0 }, { ...NEUTRAL }];
      applyDash(raw); step(raw);
      if (p.state === 'dash' && prev !== 'dash') dashes++;
      if (p.state === 'backdash' && prev !== 'backdash') bdashes++;
      prev = p.state;
    }
    return { dashes, bdashes };
  };
  const rep = (n, o) => Array.from({ length: n }, () => ({ ...o }));
  const cases = [
    ['tap Dash from standing', [...rep(10, {}), ...rep(2, { dash: 1 }), ...rep(30, {})], { dashes: 1 }],
    ['tap Dash while walking forward', [...rep(20, { fwd: 1 }), ...rep(2, { fwd: 1, dash: 1 }), ...rep(30, { fwd: 1 })], { dashes: 1 }],
    ['tap Dash while walking back', [...rep(20, { back: 1 }), ...rep(2, { back: 1, dash: 1 }), ...rep(40, { back: 1 })], { bdashes: 1 }],
    ['back + Dash from standing', [...rep(10, {}), ...rep(2, { back: 1, dash: 1 }), ...rep(40, {})], { bdashes: 1 }],
    ['hold Dash + back for 2 seconds', [...rep(10, {}), ...rep(120, { back: 1, dash: 1 }), ...rep(20, {})], { bdashes: 1 }],
    ['hold Dash, then walk back', [...rep(5, { dash: 1 }), ...rep(120, { back: 1, dash: 1 })], { bdashes: 0 }],
    ['three Dash presses while walking back', [...rep(20, { back: 1 }), ...[0, 1, 2].flatMap(() => [...rep(2, { back: 1, dash: 1 }), ...rep(40, { back: 1 })])], { bdashes: 3 }],
    ['two Dash presses while walking forward', [...rep(20, { fwd: 1 }), ...[0, 1].flatMap(() => [...rep(2, { fwd: 1, dash: 1 }), ...rep(40, { fwd: 1 })])], { dashes: 2 }],
  ];
  for (const [name, frames, want] of cases) {
    const got = run(frames); out.push(`${name}: dashes ${got.dashes}, backdashes ${got.bdashes}`);
    for (const k in want) if (got[k] !== want[k]) errs.push(`${name}: ${k} ${got[k]}, want ${want[k]}`);
  }
  return [out, errs];
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pe = []; pg.on('pageerror', lambda e: pe.append(str(e)))
    pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("() => { tick = () => {}; render = () => {}; Sfx.play = () => {}; }")
    out, errs = pg.evaluate(JS); b.close()
for l in out: print(l)
print('ERR', errs + pe)
