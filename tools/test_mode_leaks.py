import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Nothing from Combo Trials, Training, the Tutorial, Arcade or a replay may carry into another match.
# (Players went Trials -> main menu -> a match and had "Reset positions", which refilled health; hitboxes
#  switched on in a replay stayed on in online play.)
import asyncio
from playwright.async_api import async_playwright
JS = r"""() => {
  const out = {}, labels = () => pauseItems().map(x => x[0]);
  const local = (mode) => { UI.screen = 'mode'; UI.pendingMode = mode; UI.sel = [0, 1]; beginLocalMatch(); };
  // trials, then leave through the main menu (TR.on used to stay true)
  local('training'); trialStart('spe', 0); UI.screen = 'mode';
  local('versus'); out.versus = labels(); out.versusTR = TR.on;
  local('training'); trialStart('spe', 0); UI.screen = 'mode';
  arcBegin(ROSTER[0], 0); arcFight(); out.arcade = labels(); out.arcTR = TR.on; out.arcOn = ARC.on;
  // arcade abandoned through the main menu, then Versus: the arcade tick must not run
  UI.screen = 'mode'; local('versus'); out.arcAfter = ARC.on;
  // tutorial -> versus
  tutStart(0); UI.screen = 'mode'; local('cpu'); out.cpu = labels(); out.tut = TUT.on;
  // hitboxes on (as a replay or training leaves them) -> online match
  G.showBoxes = true;
  startNetMatch({ m: 1, c: [ROSTER[0], ROSTER[1]], pal: [0, 0], delay: 2, stage: 0, music: ROSTER[0], key: 'leaktest' });
  out.onlineBoxes = G.showBoxes; G.showBoxes = true; let drew = false; const o = drawBoxes; drawBoxes = () => { drew = true; }; renderGame(); drawBoxes = o; out.onlineDrew = drew;
  // hitboxes still work in training
  local('training'); G.showBoxes = true; drew = false; drawBoxes = () => { drew = true; }; renderGame(); drawBoxes = o; out.trainingDrew = drew;
  // practice flag cleared once you leave for another mode
  Net.practice = true; local('versus'); out.practice = Net.practice;
  return out;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 960, 'height': 540}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(1500)
        o = await pg.evaluate(JS)
        bad = [k for k in ('versus', 'arcade', 'cpu') if 'Reset positions' in o[k] or 'Watch demo' in o[k]]
        ok = not bad and not o['versusTR'] and not o['arcTR'] and o['arcOn'] and not o['arcAfter'] and not o['tut'] \
             and not o['onlineBoxes'] and not o['onlineDrew'] and o['trainingDrew'] and not o['practice'] and not errs
        print('OK ' if ok else 'BAD', o)
        print('ERR', errs); await b.close()
asyncio.run(main())
