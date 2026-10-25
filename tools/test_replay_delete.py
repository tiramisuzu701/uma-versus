import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Replays menu: delete one replay (press twice), the prompt times out, delete all, and the list scrolls.
from playwright.sync_api import sync_playwright
JS = r"""() => {
  const out = [], R = (n, v) => out.push(n + ': ' + v);
  const fake = i => ({ v: 1, b: BUILD, mode: 'versus', c: ['spe', 'gs'], names: ['Special Week', 'Gold Ship'], winner: 0, date: new Date(Date.UTC(2026, 9, 1, 12, i)).toISOString(), f: [] });
  localStorage.removeItem(REPLAY_KEY); lastReplay = null;
  for (let i = 0; i < 8; i++) storeReplay(fake(i));
  UI.screen = 'replays'; RM.idx = 2; RM.del = -1;
  const E = (o = {}) => ({ u: 0, d: 0, l: 0, r: 0, L: 0, M: 0, H: 0, S: 0, ...o });
  const tick = (e, ed = []) => replaysMenuTick(E(e), false, false, ed);
  const target = replayMenuItems()[2].rep.date;
  tick({}, ['KeyX']); R('after one press', `${loadStored().length} stored, asking=${RM.del === 2}`);
  tick({}, ['KeyX']); R('after two presses', `${loadStored().length} stored, gone=${!loadStored().some(r => r.date === target)}`);
  tick({}, ['Delete']); for (let i = 0; i < 200; i++) tick({}); tick({}, ['Delete']);
  R('prompt timed out, then one press', `${loadStored().length} stored (should still be 7), asking=${RM.del === 2}`);
  tick({ M: 1 }); R('gamepad Y confirms', `${loadStored().length} stored`);
  let items = replayMenuItems(); RM.idx = items.findIndex(it => it.all); RM.del = -1;
  tick({ L: 1 }); R('delete all, first press', `${loadStored().length} stored`);
  tick({ L: 1 }); items = replayMenuItems(); R('delete all, second press', `${loadStored().length} stored, rows: ${items.map(i => i.label).join(' | ')}`);
  const errs = [];
  if (loadStored().length !== 0) errs.push('delete all failed');
  return [out, errs];
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 960, 'height': 540})
    pe = []; pg.on('pageerror', lambda e: pe.append(str(e)))
    pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(1500)
    out, errs = pg.evaluate(JS)
    for l in out: print(l)
    # scrolling: 8 replays + extras must keep the selected row on screen
    pg.evaluate("() => { for (let i = 0; i < 8; i++) storeReplay({ v: 1, b: BUILD, mode: 'cpu', c: ['kb', 'ds'], names: ['Kitasan Black', 'Daiwa Scarlet'], winner: 1, date: new Date(Date.UTC(2026, 9, 2, 9, i)).toISOString(), f: [] }); UI.screen = 'replays'; RM.idx = replayMenuItems().length - 2; RM.del = -1; }")
    pg.wait_for_timeout(300)
    top = pg.evaluate("() => RM.top"); print('scrolled to show the last rows, top row', top)
    if top <= 0: errs.append('list did not scroll')
    pg.keyboard.press('KeyX'); pg.wait_for_timeout(100)
    pg.screenshot(path='/tmp/claude-0/-home-claude/beead88c-29e2-5633-85fe-f20dc7826420/scratchpad/shots/repdel.png')
    pg.evaluate("() => { localStorage.removeItem(REPLAY_KEY); }")
    b.close()
print('ERR', errs + pe)
