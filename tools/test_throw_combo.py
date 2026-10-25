import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Normal throws can't be comboed off (corner or midscreen); command grabs keep whatever follow-ups they had.
from playwright.sync_api import sync_playwright
JS = r"""() => {
  const out = [], errs = [];
  const N = () => ({ ...NEUTRAL });
  function tryAfter(cid, opp, grabId, corner, follow) {
    let best = 0, hits = 0;
    for (let delay = 0; delay <= 40; delay += 2) {
      startMatch('versus', cid, opp); G.phase = 'fight'; G.p.forEach(p => p.setState('idle'));
      const [a, b] = G.p; a.x = corner ? STAGE_W - 200 : 900; b.x = a.x + 70; a.facing = 1; b.facing = -1;
      if (grabId === 'throw') startMove(a, 'throw', true); else startMove(a, grabId, true);
      let thrownSeen = false, landed = -1, hp0 = 0, f = 0;
      for (; f < 200; f++) {
        if (b.state === 'thrown') thrownSeen = true;
        if (thrownSeen && landed < 0 && a.state !== 'throwing' && b.state !== 'thrown') { landed = f; hp0 = b.hp; }
        let ia = N();
        if (landed >= 0 && f === landed + delay && a.actionable()) { const t = follow; if (t === '2H') ia = { ...N(), d: 1, H: 1 }; else if (t === '5M') ia = { ...N(), M: 1 }; else ia = { ...N(), d: 1, L: 1 }; }
        if (landed >= 0 && f > landed + delay && f < landed + delay + 4 && !['5M'].includes(follow)) ia = { ...ia, [follow === '2H' || follow === '2L' ? 'd' : 'x']: 1 };
        // walk in toward them between the throw and the attack
        if (landed >= 0 && f < landed + delay) ia = { ...N(), r: 1 };
        step([ia, N()]);
      }
      if (!thrownSeen) continue;
      const extra = hp0 - b.hp; if (extra > 0) { hits++; best = Math.max(best, extra); }
    }
    return { hits, best };
  }
  for (const cid of ['spe', 'kb', 'gs', 'tt', 'mm', 'jp']) for (const corner of [true, false]) for (const fol of ['2H', '5M', '2L']) {
    const r = tryAfter(cid, 'suz', 'throw', corner, fol);
    out.push(`${cid} throw ${corner ? 'corner' : 'midscreen'} then ${fol}: ${r.hits ? 'COMBOED ' + r.best : 'no follow-up'}`);
    if (r.hits) errs.push(`${cid} ${corner ? 'corner' : 'mid'} ${fol} comboed after a normal throw`);
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
